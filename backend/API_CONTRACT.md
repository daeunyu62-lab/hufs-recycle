# HUFS Recycle API 계약서

기본 주소:

- 로컬: `http://localhost:8000/api/v1`
- 배포: `https://<render-service>.onrender.com/api/v1`

인증 방식:

- `Authorization: Bearer <access_token>`
- 일반 사용자 권한: `USER`
- 관리자 권한: `ADMIN`

상태값:

- 제출 상태: `PENDING`, `APPROVED`, `REJECTED`
- 포인트 거래: `EARN`, `USE`, `CANCEL`

## 공통 오류 형식

```json
{
  "detail": {
    "code": "LOCATION_TOO_FAR",
    "message": "지정된 장소에서 너무 멀리 떨어져 있습니다.",
    "context": {
      "distance_m": 124.5,
      "allowed_radius_m": 30
    }
  }
}
```

주요 오류 코드:

- `AUTH_REQUIRED`
- `EMAIL_NOT_VERIFIED`
- `INVALID_QR`
- `BIN_INACTIVE`
- `LOCATION_TOO_FAR`
- `GPS_ACCURACY_TOO_LOW`
- `HOURLY_LIMIT`
- `DAILY_LIMIT`
- `INVALID_IMAGE`
- `ALREADY_REVIEWED`
- `ADMIN_REQUIRED`
- `EMAIL_DELIVERY_FAILED`
- `POINT_TRANSACTION_CONFLICT`

## 인증

### `POST /auth/register`

외대 이메일 회원가입. 개발/테스트 환경에서는 이메일 발송 대신
`email_verification_token`을 응답에 포함한다. 운영에서는 `EMAIL_VERIFICATION_MODE=smtp`
설정으로 실제 인증 메일을 발송한다.

```json
{
  "email": "student@hufs.ac.kr",
  "student_number": "202100000",
  "name": "홍길동",
  "password": "safe-password"
}
```

### `POST /auth/verify-email`

```json
{
  "token": "EMAIL_VERIFICATION_TOKEN"
}
```

### `POST /auth/login`

```json
{
  "email": "student@hufs.ac.kr",
  "password": "safe-password"
}
```

응답:

```json
{
  "access_token": "JWT_TOKEN",
  "token_type": "bearer"
}
```

### `GET /users/me`

인증: `USER` 또는 `ADMIN`

## QR 및 쓰레기통

QR 접속 URL:

```text
https://<frontend-service>/verify?bin_id=HUFS-001&token=<signed-token>
```

프론트엔드는 로그인 전후에 `bin_id`와 `token` query string을 보존해야 한다.

### `GET /trash-bins/{bin_id}`

QR URL의 `bin_id`로 쓰레기통 공개 정보를 조회한다.

### `GET /qr/verify`

인증: 불필요

쿼리:

- `bin_id`
- `token`
- `latitude`
- `longitude`
- `accuracy_m`

응답:

```json
{
  "bin": {
    "id": 1,
    "code": "HUFS-001",
    "name": "교내 테스트 분리수거함",
    "description": "개발 테스트 장소",
    "allowed_radius_m": 30,
    "is_active": true
  },
  "distance_m": 8.4,
  "allowed_radius_m": 30,
  "gps_accuracy_m": 12,
  "can_take_photo": true
}
```

프론트엔드는 이 API가 성공하고 `can_take_photo=true`일 때만 촬영 또는 파일 입력을
활성화한다.

## 사진 인증

### `POST /submissions`

인증: 이메일 인증 완료 사용자

요청 형식: `multipart/form-data`

필드:

- `bin_id`: QR URL의 쓰레기통 ID
- `token`: QR URL의 signed token
- `latitude`: 사용자 위도
- `longitude`: 사용자 경도
- `accuracy_m`: GPS 정확도
- `photo`: `image/jpeg`, `image/png`, `image/webp`

FormData 예시:

```ts
const formData = new FormData();
formData.append("bin_id", binId);
formData.append("token", token);
formData.append("latitude", String(position.coords.latitude));
formData.append("longitude", String(position.coords.longitude));
formData.append("accuracy_m", String(position.coords.accuracy));
formData.append("photo", photoFile);

await fetch(`${API_BASE_URL}/submissions`, {
  method: "POST",
  headers: { Authorization: `Bearer ${accessToken}` },
  body: formData,
});
```

성공 응답:

```json
{
  "submission_id": 15,
  "status": "PENDING",
  "distance_m": 9.6,
  "remaining_today": 1,
  "message": "인증이 제출되었습니다. 관리자 검토 후 마일리지가 적립됩니다."
}
```

백엔드 검증:

1. JWT 사용자 확인
2. 이메일 인증 완료 여부 확인
3. `bin_id`와 signed `token` 검증
4. 쓰레기통 활성 여부 확인
5. 좌표 범위 검증
6. GPS 정확도 검증
7. Haversine 거리 계산과 허용 반경 검증
8. 하루 2회 제한 검증
9. 최근 제출 후 60분 제한 검증
10. MIME 타입과 이미지 헤더 검증
11. 이미지 용량 검증
12. private Storage 저장
13. `PENDING` DB 저장

### `GET /submissions/eligibility`

오늘 남은 제출 가능 횟수와 다음 제출 가능 시간을 조회한다.

```json
{
  "daily_limit": 2,
  "used_today": 1,
  "remaining_today": 1,
  "cooldown_minutes": 60,
  "next_submission_at": "2026-07-20T10:30:00Z",
  "can_submit_now": false
}
```

### `GET /users/me/submissions`

내 제출 목록 조회.

### `GET /submissions/{submission_id}`

내 제출 상세 조회. 일반 사용자는 자신의 제출만 조회할 수 있다.

## 관리자

모든 관리자 API 인증: `ADMIN`

### `GET /admin/locations`

관리자용 쓰레기통 목록 조회. 좌표, `bin_id`, QR URL을 포함한다.

### `POST /admin/locations`

쓰레기통 등록. `code`를 생략하면 서버가 `HUFS-XXXXXXXX` 형식으로 생성한다.

### `PATCH /admin/locations/{location_id}`

쓰레기통 수정 또는 비활성화.

### `POST /admin/locations/{location_id}/qr-token`

관리자용 QR URL 생성.

```json
{
  "bin_id": "HUFS-001",
  "token": "v1.SIGNED_TOKEN",
  "qr_url": "https://frontend.example.com/verify?bin_id=HUFS-001&token=v1.SIGNED_TOKEN"
}
```

### `GET /admin/submissions`

쿼리 필터:

- `status`
- `user_id`
- `location_id`
- `submitted_from`
- `submitted_to`
- `page`
- `page_size`

### `GET /admin/submissions/{submission_id}`

관리자 상세 조회. 사진은 private Storage signed URL로 제공한다.

### `PATCH /admin/submissions/{submission_id}/approve`

`PENDING`만 승인 가능하다. 승인, 마일리지 거래 생성, 사용자 잔액 증가는 하나의
DB transaction으로 처리한다. 같은 제출에는 `EARN` 거래가 한 번만 생성된다.

### `PATCH /admin/submissions/{submission_id}/reject`

```json
{
  "reason": "사진에서 올바른 분리배출 여부를 확인하기 어렵습니다."
}
```

거절된 제출에는 마일리지가 지급되지 않는다.

## 마일리지

### `GET /users/me/points`

현재 잔액과 적립 내역 조회. 잔액은 `users.mileage_balance`에 저장하고,
승인 시 `point_transactions`와 함께 갱신한다.

## 프론트엔드 처리 기준

- `AUTH_REQUIRED` 또는 HTTP 401: 로그인 화면으로 이동하고 QR query 보존
- `EMAIL_NOT_VERIFIED`: 이메일 인증 화면으로 이동
- `INVALID_QR`: QR을 다시 스캔하도록 안내
- `BIN_INACTIVE`: 사용 중지된 쓰레기통 안내
- `LOCATION_TOO_FAR`: 쓰레기통 가까이 이동 안내
- `GPS_ACCURACY_TOO_LOW`: GPS 정확도 개선 후 재시도 안내
- `HOURLY_LIMIT`: `retry_after_seconds` 기준 대기 안내
- `DAILY_LIMIT`: 오늘 제출 횟수 초과 안내
- `INVALID_IMAGE`: jpg, png, webp 사진 재촬영 안내
- `ALREADY_REVIEWED`: 이미 처리된 제출 안내

모바일 웹에서 위치와 카메라를 사용하려면 HTTPS와 사용자 권한 허용이 필요하다.
카메라는 사용자가 직접 촬영 버튼 또는 파일 입력을 누른 뒤 열어야 하며,
프론트엔드는 `accept="image/jpeg,image/png,image/webp"`와 `capture="environment"`로
후면 카메라를 우선 요청한다.
