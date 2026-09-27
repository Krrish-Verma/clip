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

The browser must send the same normalized `Content-Type` that was signed. Re-run `minio-init` after changing origins: `docker compose up minio-init`. For R2, apply equivalent bucket CORS and use the R2 S3 API endpoint, not a public custom domain.

## Video stays in processing

Run `docker compose logs worker`. Confirm the worker uses the same database and bucket as the API. A worker restarts stale jobs after 15 minutes. Three failures move the video to `FAILED`, where the UI offers a retry.

## Browser cannot seek

Playback uses a private S3 GET URL and depends on Range support. MinIO and R2 support it. If a proxy is added later, it must preserve `Range`, `Accept-Ranges`, `Content-Range`, and 206 responses.

## Docker ports are occupied

Defaults are PostgreSQL `5432`, MinIO API `9000`, MinIO console `9001`, API `8080`, and Next.js `3000`. Change both Compose port mappings and any corresponding endpoint environment variables together.
