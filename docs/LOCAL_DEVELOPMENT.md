# Local development

## Requirements

- Node.js 22.13 or newer supported LTS. The package manifest enforces this minimum because current lint dependencies do not support earlier Node 22 releases.
- Docker Desktop (Windows/macOS) or Docker Engine with Compose v2 (Linux).
- Java 21 only when running Spring outside Docker. Maven and FFmpeg are not required system installs: `backend/mvnw` downloads Maven, while the worker image includes FFmpeg.
- Chrome or Edge for the broadest screen/system-audio capture support.
- A free Clerk development application for authenticated end-to-end use.

## Configure Clerk

1. In Clerk, create an application and keep personal accounts enabled.
   Enable Organizations if you want to exercise team workspaces, invitations, and admin/member roles.
2. Add `http://127.0.0.1:3000` and optionally `http://localhost:3000` as development origins/redirect hosts.
3. Copy `.env.example` to both `.env.local` and `.env`. Set frontend keys in `.env.local`; set the issuer/JWKS values in root `.env`, which Docker Compose reads automatically.
4. Keep both local origins in `CLERK_AUTHORIZED_PARTIES`.
5. Copy `backend/.env.example` to `backend/.env` only when running Spring directly outside Compose. Spring does not load dotenv files automatically, so export those values or configure your IDE's environment-file support.

No webhook is required. Clip creates a local user on the first valid session and syncs the visible profile from the signed-in browser.

## Start on Windows PowerShell

```powershell
Copy-Item .env.example .env.local
Copy-Item .env.example .env
# Edit .env.local and .env, then:
docker compose up -d --build
npm ci
npm run dev
```

## Start on macOS/Linux

```bash
cp .env.example .env.local
cp .env.example .env
# Edit .env.local and .env, then:
docker compose up -d --build
npm ci
npm run dev
```

Open `http://127.0.0.1:3000`. The local S3 gateway is available at `http://localhost:4566`; the `clip` bucket is created automatically with browser upload/playback CORS. The Compose worker reaches the private transcription service at `http://transcriber:8090`; the speech model downloads into the `clip-models` volume on first use.

Infrastructure alone can run without hosted credentials:

```bash
docker compose up -d postgres localstack
```

The API deliberately refuses to start without `CLERK_ISSUER`. Public frontend builds still work with empty environment variables and show an authentication setup state.

## Verify

```powershell
npm run verify
cd backend
.\mvnw.cmd test
```

On macOS/Linux use `./mvnw test`. With Docker available, the PostgreSQL/Testcontainers migration test runs automatically; otherwise it is reported as skipped.

For the real storage/database/FFmpeg workflow, start the Compose stack first. Then sign in at `http://localhost:3000`, open the browser console, and obtain a fresh token with `await window.Clerk.session.getToken({ skipCache: true })`. Immediately run:

```powershell
$env:CLIP_TEST_TOKEN = "<short-lived Clerk session token>"
.\scripts\verify-local-e2e.ps1
```

The script expects all Compose services to be healthy. Clerk session tokens are short-lived, so fetch the token only after the stack is running. It generates a synthetic audiovisual fixture, verifies multipart resume and FFmpeg processing, renders a revision with trim/crop/blur/overlay/thumbnail options, checks stable and protected sharing plus revision privacy, revokes the link, and deletes the video. It never provides a runtime authentication bypass.

Transcription is intentionally not included in the quick smoke because the first faster-whisper model download can be slow. After the `transcriber` health check is ready, generate a transcript from a ready clip in the video page and confirm the worker reaches `TRANSCRIPTION_URL`.

Screen capture itself remains a manual browser check because the operating-system picker and microphone grants are user-controlled.
