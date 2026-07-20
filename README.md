# HUFS Eco Mileage App

한국외국어대학교 교내 쓰레기 분리배출 참여를 유도하는 마일리지 웹서비스입니다.

## 담당

- Backend: 김재웅
- Frontend: 다은

## 프로젝트 구조

- `backend/`: FastAPI 백엔드
- `frontend/`: Next.js 프론트엔드

## 협업 규칙

1. main 브랜치에는 직접 코드를 올리지 않습니다.
2. 각자 작업 브랜치에서 개발합니다.
3. 백엔드는 backend 폴더에서 작업합니다.
4. 프론트엔드는 frontend 폴더에서 작업합니다.
5. 작업 완료 후 Pull Request를 생성합니다.
6. 검토 후 main 브랜치에 병합합니다.
7. .env, API Key, 비밀번호는 GitHub에 올리지 않습니다.

# HUFS Recycle Monorepo

한국외국어대학교 교내 분리배출 인증과 마일리지 적립을 위한 웹서비스입니다.

## 프로젝트 구조

```text
hufs-recycle/
├── backend/   # FastAPI API 서버
├── frontend/  # Next.js 사용자 화면
├── render.yaml
└── .github/workflows/
```

## 역할

- Backend: FastAPI, PostgreSQL, Supabase Storage, JWT, 관리자 검토, 마일리지
- Frontend: Next.js, QR 토큰 입력/페이지, 위치 확인, 사진 제출 화면

## 브랜치 전략

- `main`: 최종 통합 브랜치
- `feature/backend-init`: 백엔드 및 통합 준비 브랜치
- `feature/frontend-init`: 프론트엔드 작업 브랜치
- `feature/backend-flow-implementation`: 백엔드 핵심 플로우 구현 브랜치

`main`에는 직접 커밋하지 않고 Pull Request로 병합합니다.

## 로컬 백엔드 실행

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

- Swagger: `http://localhost:8000/docs`
- Health: `http://localhost:8000/api/v1/health`

## 로컬 프론트엔드 실행

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

- Frontend: `http://localhost:3000`
- API base: `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1`

## 무료 배포 구조

- Backend: Render Web Service
- Database: Supabase PostgreSQL
- Image Storage: Supabase private Storage
- Frontend: Vercel 또는 Render Web Service

실제 비밀값은 GitHub에 올리지 않고 Render, Vercel, Supabase Dashboard에만 입력합니다.

---
