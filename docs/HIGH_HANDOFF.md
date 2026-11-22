# Clip: production handoff

## Locally implemented

- Screen, camera-only, and composed screen-plus-camera recording with device and quality controls, countdown, annotations, blur regions, cursor emphasis, screenshots, pause/resume, and local download.
- Durable IndexedDB recording drafts and resumable S3 multipart uploads.
- Clerk personal and Organization workspaces with tenant-scoped videos/folders and creator/admin mutation rules.
- Private S3-compatible storage, durable PostgreSQL processing jobs, FFmpeg inspection/transcoding, retry/recovery, and abandoned-upload cleanup.
- Revisioned trim/split/stitch/crop rendering, landscape/square/portrait output, blur and box regions, text overlays, custom thumbnails, and stable share URLs.
- Private faster-whisper transcription, editable transcript/captions, VTT and text export, transcript search, extractive summaries/chapters/tasks, privacy hints, and reviewable silence/filler cuts.
- Password-protected and expiring share links, embeds, descriptions, calls to action, revision-aware conversation timestamps, reactions, mentions, and activity retention.
- Seek-resistant engagement measurement with revision-scoped views, unique viewers, completion, watch coverage, time watched, and interval charts.
- Frontend lint, type checking, production build, seven Playwright browser checks, backend unit tests, Docker-gated PostgreSQL authorization/migration tests, and a real-stack smoke script.

## External work before production

1. Create/configure the production Clerk instance, enable Organizations, configure exact origins and roles, and use an owned custom domain.
2. Provision hosted PostgreSQL and a private S3-compatible bucket with exact CORS rules and scoped credentials.
3. Choose container compute for the API, worker, and speech service; measure FFmpeg/Whisper CPU, memory, timeout, and egress behavior before setting capacity.
4. Configure all variables listed in `README.md` and `backend/.env.example` through the hosting platform's secret manager.
5. Run Flyway migrations, health checks, the authenticated smoke script, Organization access tests, and manual screen/camera capture checks against the production origins.
6. Configure monitoring, alerts, log retention, PostgreSQL backups, object lifecycle policy, and a restore drill.

## Optional product expansion

- Cross-library transcript search, bulk library operations, and server-side pagination once quotas grow beyond the current small-workspace limits.
- Email/push notification delivery, deeper activity links, integrations, and analytics export.
- Distributed rate limiting when more than one API instance is deployed.
- Model-backed titles/summaries/redaction assistance only after budget, consent, and data-handling policies are defined.

## Verification commands

```powershell
cd C:\Clip
npm ci
npm run verify
cd backend
.\mvnw.cmd test
```

Docker is required for the eight Testcontainers cases and the real media lifecycle. With the Compose stack healthy and a fresh Clerk session token:

```powershell
$env:CLIP_TEST_TOKEN = "<current Clerk session token>"
.\scripts\verify-local-e2e.ps1 -Studio -Transcription
```

The smoke script covers multipart resume, FFmpeg processing, revision rendering, stable links, revision privacy, password unlock, revocation, and cleanup. The transcription option sends a synthetic speech fixture through the worker and checks that Whisper returns text. Allow extra time for the first model download. Operating-system capture pickers and permission prompts remain manual by browser design.

## Intentional boundaries

- Guests need a live share token; notifications never grant access.
- Team members can read their active Organization library. Clip creators and Organization admins manage media; personal content remains separate.
- Existing media remains published while a new revision renders. Shared viewers see only the published revision; owners can inspect prior revisions.
- Transcript highlights are deterministic suggestions, not factual guarantees. Privacy and cut suggestions require human review.
- The in-process rate limiter is appropriate for one API instance. Put a shared/edge limiter in front before scaling horizontally.
