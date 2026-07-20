# HUFS Recycle Frontend

Next.js frontend for the HUFS Global Campus recycling verification flow.

## Local setup

```powershell
cd frontend
Copy-Item .env.example .env.local
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`. The backend must be running on
`http://localhost:8000` unless `NEXT_PUBLIC_API_BASE_URL` is changed.

## Main routes

- `/`: account entry, mileage balance, eligibility, and recent submissions
- `/verify?bin_id=<code>&token=<signed-token>`: geofence, camera, and submission flow
- `/activity`: current user's submission history
- `/mileage`: mileage transaction history
- `/admin`: submission review, location management, and QR download

The account form asks for the HUFS email prefix, student number, and password. It
logs in an existing user or creates and verifies a development account when the
backend email mode is `console`. The JWT is stored in browser local storage to
restore the demo session; passwords are never stored in the browser or database
as plain text.

On mobile, the camera action uses `capture="environment"` to prefer the rear
camera. Camera and geolocation require user permission, and a phone opening the
site over the network must use HTTPS. The backend repeats QR, geofence, GPS,
cooldown, daily limit, and image validation before accepting a submission.

For a presentation flow, set `DEMO_AUTO_APPROVE_SUBMISSIONS=true` only in local
development. A valid submission then returns an approved status and the actual
updated mileage balance. Production rejects startup when that option is enabled.

## Checks

```powershell
npm.cmd run lint
npm.cmd run build
```
