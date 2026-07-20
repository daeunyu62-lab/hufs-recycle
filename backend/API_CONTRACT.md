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

- `EMAIL_ALREADY_EXISTS`
- `STUDENT_NUMBER_ALREADY_EXISTS`
- `INVALID_EMAIL_DOMAIN`
- `EMAIL_NOT_VERIFIED`
- `INVALID_CREDENTIALS`
- `INACTIVE_USER`
- `INVALID_TOKEN`
- `ADMIN_REQUIRED`
- `INVALID_QR_TOKEN`
- `INACTIVE_LOCATION`
- `INVALID_COORDINATES`
- `GPS_ACCURACY_TOO_LOW`
- `LOCATION_TOO_FAR`
- `DAILY_LIMIT_EXCEEDED`
- `COOLDOWN_NOT_FINISHED`
- `INVALID_IMAGE_TYPE`
- `IMAGE_TOO_LARGE`
- `STORAGE_ERROR`
- `SUBMISSION_NOT_FOUND`
- `FORBIDDEN_SUBMISSION_ACCESS`
- `ALREADY_REVIEWED`
- `INVALID_REJECTION_REASON`
- `POINT_TRANSACTION_CONFLICT`

## Health

### `GET /health`

인증: 불필요

응답:

```json
{
  "status": "ok",
  "service": "HUFS Recycle API",
  "environment": "development"
}
```

### `GET /health/db`

인증: 불필요

응답:

```json
{
  "status": "ok",
  "database": "ok"
}
```

## 인증

### `POST /auth/register`

인증: 불필요

요청:

```json
{
  "email": "student@hufs.ac.kr",
  "student_number": "202100000",
  "name": "홍길동",
  "password": "safe-password"
}
```

규칙:

- 회원가입 기본 권한은 항상 `USER`
- 공개 API에서 `ADMIN` 지정 불가
- `ALLOWED_EMAIL_DOMAINS`에 등록된 도메인만 가입 가능
- 이메일은 lowercase로 저장
- 이메일과 학번 중복 불가
- 비밀번호 원문 저장 금지
- 개발/테스트 환경에서는 이메일 발송 대신 `email_verification_token`을 응답에 포함

응답:

```json
{
  "user": {
    "id": 1,
    "email": "student@hufs.ac.kr",
    "student_number": "202100000",
    "name": "홍길동",
    "role": "USER",
    "is_active": true,
    "is_email_verified": false
  },
  "email_verification_required": true,
  "email_verification_token": "DEV_ONLY_TOKEN"
}
```

### `POST /auth/verify-email`

인증: 불필요

요청:

```json
{
  "token": "DEV_ONLY_TOKEN"
}
```

응답:

```json
{
  "status": "ok",
  "message": "이메일 인증이 완료되었습니다."
}
```

### `POST /auth/login`

인증: 불필요

요청:

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

응답:

```json
{
  "id": 1,
  "email": "student@hufs.ac.kr",
  "student_number": "202100000",
  "name": "홍길동",
  "role": "USER",
  "is_active": true,
  "email_verified_at": "2026-07-20T10:00:00Z"
}
```

## QR 장소

### `GET /locations/{qr_token}`

인증: 불필요

응답:

```json
{
  "id": 1,
  "name": "교내 테스트 분리수거함",
  "description": "개발 테스트 장소",
  "allowed_radius_m": 30,
  "is_active": true
}
```

규칙:

- 존재하지 않는 QR은 `404`
- 비활성 장소는 사용 불가
- 관리자 내부 정보는 과도하게 노출하지 않음

## 인증 제출

### `POST /submissions`

인증: `USER` 또는 `ADMIN`

요청 형식: `multipart/form-data`

필드:

- `qr_token`: string
- `latitude`: number, `-90 <= latitude <= 90`
- `longitude`: number, `-180 <= longitude <= 180`
- `accuracy_m`: number, `0 < accuracy_m <= MAX_GPS_ACCURACY_M`
- `photo`: file, `image/jpeg`, `image/png`, `image/webp`

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

검증 순서:

1. 로그인 사용자 확인
2. QR 존재 여부 확인
3. QR 장소 활성 여부 확인
4. 좌표 범위 검증
5. GPS 정확도 검증
6. 서버에서 Haversine 거리 계산
7. 허용 반경 검증
8. 하루 제출 제한 검증
9. 60분 쿨다운 검증
10. 이미지 MIME 검증
11. 이미지 용량 검증
12. Storage 저장
13. `PENDING` DB 저장

## 사용자 제출 조회

### `GET /submissions/{submission_id}`

인증: `USER` 또는 `ADMIN`

규칙:

- 일반 사용자는 자신의 제출만 조회 가능
- 다른 사용자의 제출 조회 시 `403`

### `GET /users/me/submissions`

인증: `USER` 또는 `ADMIN`

쿼리:

- `page`
- `page_size`

응답:

```json
{
  "items": [],
  "page": 1,
  "page_size": 20,
  "total": 0
}
```

## 관리자

모든 관리자 API 인증: `ADMIN`

### `GET /admin/locations`

관리자용 분리수거함 목록 조회. QR 토큰과 좌표를 포함한다.

### `POST /admin/locations`

관리자용 분리수거함 생성. QR 토큰은 서버에서 생성한다.

### `PATCH /admin/locations/{location_id}`

관리자용 분리수거함 이름, 설명, 좌표, 허용 반경, 활성 상태 수정.

### `GET /admin/submissions`

쿼리:

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

규칙:

- `PENDING`만 승인 가능
- 승인과 마일리지 `EARN` 생성은 하나의 DB transaction
- 동일 제출에 `EARN` 중복 생성 불가

### `PATCH /admin/submissions/{submission_id}/reject`

요청:

```json
{
  "reason": "사진에서 올바른 분리배출 여부를 확인하기 어렵습니다."
}
```

규칙:

- `reason`은 공백 불가
- `PENDING`만 거절 가능
- 마일리지 생성 금지

### `GET /admin/statistics`

응답 항목:

- `total_submissions`
- `pending_submissions`
- `approved_submissions`
- `rejected_submissions`
- `today_submissions`
- `today_approved`
- `active_users`
- `total_points_awarded`
- `submissions_by_location`

## 마일리지

### `GET /users/me/points`

인증: `USER` 또는 `ADMIN`

응답:

```json
{
  "balance": 1,
  "transactions": [],
  "page": 1,
  "page_size": 20,
  "total": 0
}
```

잔액은 `point_transactions.amount` 합계로 계산한다.
