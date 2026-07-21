# HUFS ECO MILE 베타 프로토타입

한국외국어대학교 글로벌캠퍼스 분리배출 마일리지의 모바일 사용자 흐름을 보여주는 프론트엔드 전용 프로토타입입니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 아래 주소를 확인합니다.

- 서비스 소개: `http://localhost:3000/`
- 체크인: `http://localhost:3000/check-in?spotId=HUFS-GLOBAL-001`
- 베타 QR: `http://localhost:3000/beta-qr`
- 마이페이지: `http://localhost:3000/mypage`

## 데이터와 베타 도구

- 로그인 정보, 마일리지, 인증 내역은 브라우저 `localStorage`에만 저장됩니다.
- 카메라 사진은 브라우저 화면에만 표시되며 서버로 전송하지 않습니다.
- 개발 모드에서는 테스트 위치와 베타 데이터 초기화 버튼이 표시됩니다.
- 배포 환경에서도 시연 도구가 필요하면 `NEXT_PUBLIC_ENABLE_BETA_TOOLS=true`를 설정합니다. 실제 공개 배포에서는 이 값을 설정하지 않습니다.

## 검사

```bash
npm run typecheck
npm run lint
npm run build
```
