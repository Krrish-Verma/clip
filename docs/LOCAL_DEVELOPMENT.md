# Local development

## Requirements

- Node.js 22.13 or newer supported LTS. Node 22.9 is known to work but npm prints an engine warning for the current ESLint dependency.
- Docker Desktop (Windows/macOS) or Docker Engine with Compose v2 (Linux).
- Java 21 only when running Spring outside Docker. Maven and FFmpeg are not required system installs: `backend/mvnw` downloads Maven, while the worker image includes FFmpeg.
- Chrome or Edge for the broadest screen/system-audio capture support.
- A free Clerk development application for authenticated end-to-end use.

## Configure Clerk

1. In Clerk, create an application and keep personal accounts enabled.
2. Add `http://127.0.0.1:3000` and optionally `http://localhost:3000` as development origins/redirect hosts.
3. Copy `.env.example` to `.env.local` and set the publishable and secret keys.
4. Copy `backend/.env.example` to `backend/.env` and set the issuer and JWKS URL shown on Clerk's API keys/session-token pages. Keep both local origins in `CLERK_AUTHORIZED_PARTIES`.
5. Export `CLERK_ISSUER` and `CLERK_JWKS_URL` in the shell that starts Compose; Compose intentionally does not read `backend/.env` implicitly.

No webhook is required. Clip creates a local user on the first valid session and syncs the visible profile from the signed-in browser.

## Start on Windows PowerShell

```powershell
Copy-Item .env.example .env.local
Copy-Item backend/.env.example backend/.env
# Edit both files, then set the two Compose variables in this shell:
$env:CLERK_ISSUER = "https://your-instance.clerk.accounts.dev"
$env:CLERK_JWKS_URL = "$env:CLERK_ISSUER/.well-known/jwks.json"
docker compose up -d --build
npm ci
npm run dev
```

## Start on macOS/Linux

```bash
cp .env.example .env.local
cp backend/.env.example backend/.env
# Edit both files, then:
export CLERK_ISSUER='https://your-instance.clerk.accounts.dev'
export CLERK_JWKS_URL="$CLERK_ISSUER/.well-known/jwks.json"
docker compose up -d --build
npm ci
npm run dev
```

Open `http://127.0.0.1:3000`. MinIO's local console is at `http://localhost:9001` with the clearly non-production credentials `clip-local` / `clip-local-only`.

Infrastructure alone can run without hosted credentials:

```bash
docker compose up -d postgres minio minio-init
```

The API deliberately refuses to start without `CLERK_ISSUER`. Public frontend builds still work with empty environment variables and show an authentication setup state.

## Verify

```powershell
npm run lint
npm run typecheck
npm run build
cd backend
.\mvnw.cmd test
```

On macOS/Linux use `./mvnw test`. With Docker available, the PostgreSQL/Testcontainers migration test runs automatically; otherwise it is reported as skipped.

For the real storage/database/FFmpeg workflow, start the Compose stack first. Then sign in at `http://localhost:3000`, open the browser console, and obtain a fresh token with `await window.Clerk.session.getToken({ skipCache: true })`. Immediately run:

```powershell
$env:CLIP_TEST_TOKEN = "<short-lived Clerk session token>"
.\scripts\verify-local-e2e.ps1
```

The script expects the Compose services to already be healthy. Clerk session tokens are short-lived, so fetch the token only after the stack is running. The script generates a three-second synthetic audiovisual fixture inside the worker image, uploads it through the actual presigned URL, waits for FFmpeg, checks private playback and sharing, revokes the link, and deletes the video. It never provides a runtime authentication bypass.

Screen capture itself remains a manual browser check because the operating-system picker and microphone grants are user-controlled.
