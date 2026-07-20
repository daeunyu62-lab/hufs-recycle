# HUFS Eco Mileage API

FastAPI backend for the HUFS campus recycling mileage service.

## Local Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m app.db.seed
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Swagger is available at `http://localhost:8000/docs`.

## Checks

```powershell
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m pytest -q
```

## Database

Alembic migrations are stored in `backend/alembic`.

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
```

The seed command is idempotent. It creates an admin user and one test disposal
location only when the related `SEED_*` environment variables are set.

```powershell
.\.venv\Scripts\python.exe -m app.db.seed
```

## Environment Variables

Copy `.env.example` to `.env` for local development. Do not commit `.env`.

Render production variables:

- `APP_NAME=HUFS Recycle API`
- `APP_ENV=production`
- `DEBUG=false`
- `API_V1_PREFIX=/api/v1`
- `BUSINESS_TIMEZONE=Asia/Seoul`
- `DATABASE_URL`
- `JWT_SECRET_KEY`
- `QR_SIGNING_SECRET`
- `JWT_ALGORITHM=HS256`
- `ACCESS_TOKEN_EXPIRE_MINUTES=120`
- `ALLOWED_EMAIL_DOMAINS=hufs.ac.kr`
- `FRONTEND_ORIGINS`
- `FRONTEND_BASE_URL`
- `EMAIL_VERIFICATION_MODE=smtp`
- `EMAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT=587`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_USE_TLS=true`
- `DAILY_SUBMISSION_LIMIT=2`
- `SUBMISSION_COOLDOWN_MINUTES=60`
- `POINTS_PER_APPROVAL=1`
- `DEFAULT_ALLOWED_RADIUS_M=30`
- `MAX_GPS_ACCURACY_M=100`
- `MAX_IMAGE_SIZE_MB=5`
- `SIGNED_IMAGE_URL_EXPIRE_SECONDS=300`
- `STORAGE_BACKEND=supabase`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET=submission-images`

Production rejects SQLite and local file storage.

## Supabase

1. Create a Supabase project.
2. Use the PostgreSQL connection string from the shared pooler/session mode when deploying from Render.
3. Convert the SQLAlchemy URL to `postgresql+psycopg://...`.
4. Create a private Storage bucket named `submission-images`.
5. Allowed MIME types are `image/jpeg`, `image/png`, and `image/webp`.
6. Keep `SUPABASE_SERVICE_ROLE_KEY` only in backend server environment variables.

## Render

The root `render.yaml` defines the backend service.

Render setup:

1. Connect `https://github.com/daeunyu62-lab/hufs-recycle`.
2. Select Blueprint or Web Service using `render.yaml`.
3. Fill every `sync: false` environment variable.
4. Set `ALLOWED_ORIGINS` to deployed frontend origins, comma-separated.
5. Deploy after CI checks pass.

Render runs:

```powershell
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## Security Notes

- Development and test signups return the email verification token in the API
  response. The frontend can use it to complete the local demo flow automatically.
  Unverified users can request a replacement through
  `POST /api/v1/auth/resend-verification`. Production uses SMTP settings to send the
  verification URL.
- QR URLs use `bin_id` plus an HMAC signed token. Rotate `QR_SIGNING_SECRET`
  only after planning QR re-generation.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.
- Never commit `.env`, database passwords, JWT secrets, or API keys.
- Store uploaded production images in Supabase private Storage, not Render local disk.
- Use long random values for `JWT_SECRET_KEY`.

## QR And Geofencing

An admin can download a scannable PNG from
`GET /api/v1/admin/locations/{location_id}/qr-code`. The QR contains a signed
frontend URL with `bin_id` and `token`; it does not contain or trust the user's
GPS coordinates. Geofencing runs on the backend after the phone submits its
current coordinates and GPS accuracy.
