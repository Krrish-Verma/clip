# Troubleshooting

## Public pages work but sign-in says configuration is needed

Set both `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and server-only `CLERK_SECRET_KEY` in `.env.local`, then fully restart Next.js. Public keys are bundled at build time.

## API exits during startup

`CLERK_ISSUER` is mandatory by design. Confirm it has the `https://…clerk.accounts.dev` value for the same Clerk instance as the frontend. Set `CLERK_JWKS_URL` explicitly if issuer discovery is unavailable.

## Every API request is 401

- Confirm frontend and backend use the same Clerk instance.
- Add the exact browser origin to `CLERK_AUTHORIZED_PARTIES`; scheme, host, and port matter.
- Do not mix `localhost` and `127.0.0.1` unless both are configured.
- Check the machine clock; token timestamps are validated.

## Direct upload fails with 403

The browser must send the same normalized `Content-Type` that was signed. Recreate LocalStack after changing `infra/localstack/cors.json`: `docker compose up -d --force-recreate localstack`. For R2, apply equivalent bucket CORS and use the R2 S3 API endpoint, not a public custom domain.

## Video stays in processing

Run `docker compose logs worker`. Confirm the worker uses the same database and bucket as the API. A worker restarts stale jobs after 15 minutes. Three failures move the video to `FAILED`, where the UI offers a retry.

## Transcript stays queued or fails

Run `docker compose logs transcriber worker`. The speech model is downloaded on first use and can take several minutes. Confirm `TRANSCRIPTION_URL=http://transcriber:8090` inside Compose, that the worker can reach `/health`, and that the clip has an audio track. A failed transcript can be requested again after the service is ready.

## Resumable upload cannot continue

Confirm LocalStack is healthy and the source video is still `UPLOADING`. Multipart state belongs to the same private object and expires when abandoned uploads are cleaned after 24 hours. Restarting the browser is safe when its IndexedDB recording draft is still present; deleting browser storage removes that local recovery copy.

## Team workspace is empty or access is denied

Confirm Clerk Organizations are enabled, select the intended Organization in the header, and refresh the session token. The backend reads `org_id`/`org_role` claims from the current token. Personal and Organization libraries are deliberately separate; members read team clips while creators and Organization admins perform media mutations.

## Next.js or ESLint reports an engine warning

Install Node.js 22.13 or newer, remove `node_modules`, and run `npm ci`. Earlier Node 22 releases do not satisfy the current lint dependency engine range.

## Browser cannot seek

Playback uses a private S3 GET URL and depends on Range support. LocalStack and R2 support it. If a proxy is added later, it must preserve `Range`, `Accept-Ranges`, `Content-Range`, and 206 responses.

## Docker ports are occupied

Defaults are PostgreSQL `5432`, LocalStack S3 `4566`, API `8080`, and Next.js `3000`. Change both Compose port mappings and any corresponding endpoint environment variables together.
