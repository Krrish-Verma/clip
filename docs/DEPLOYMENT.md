# Future deployment and service limits

No deployment or paid-plan activation is part of this repository. The following candidates were checked against official vendor material on 2026-09-27; pricing and limits can change, so re-check before launch.

## Recommended small hosted shape

- **Authentication: Clerk Hobby.** The published plan includes 50,000 monthly retained users per app, three dashboard seats, a fixed seven-day session lifetime, and one day of application logs; Clerk says no credit card is required. Over the limit requires a paid plan. Source: [Clerk pricing](https://clerk.com/pricing).
- **Database: Neon Free PostgreSQL.** The latest official material at review time describes 50 CU-hours/month and 0.5 GB database storage per project, 5 GB egress/month, and scale-to-zero; Neon advertises signup without a credit card. Treat it as a launch candidate, not permanent free hosting, and confirm the current [Neon pricing](https://neon.com/pricing) and [official plan explanation](https://neon.com/blog/new-usage-based-pricing) before provisioning.
- **Objects: Cloudflare R2 Standard.** The monthly free tier is 10 GB-month storage, one million Class A operations, ten million Class B operations, and free direct egress. Usage above those amounts is billed with unit rounding. R2 is a usage-billed service; Cloudflare may require/validate a payment method and may preauthorize it. Configure spending notifications and do not enable it until that risk is acceptable. Sources: [R2 pricing](https://developers.cloudflare.com/r2/pricing/) and [Cloudflare billing policy](https://developers.cloudflare.com/billing/understand/billing-policy/).
- **API, media, and speech compute:** use container-capable services for the API, worker, and private faster-whisper service. The API and worker share an image; very small installations can combine them with `WORKER_ENABLED=true`. FFmpeg and speech recognition are CPU/memory-heavy and have no dependable permanently-free recommendation. Measure duration, concurrency, memory, model-cache persistence, timeout, and egress before choosing capacity. Do not put these jobs in short-timeout serverless functions.

No CDN is required initially: R2's S3 endpoint serves short-lived GET URLs and supports range requests. A CDN can be added later only if playback economics or latency justify it.

## Production variables

Replace local database and S3 values in `backend/.env.example`. For R2:

- `S3_ENDPOINT` and `S3_PRESIGN_ENDPOINT`: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- `S3_REGION`: `auto`
- `S3_BUCKET`: the private bucket name
- `S3_ACCESS_KEY` / `S3_SECRET_KEY`: scoped R2 API token credentials, secret

Apply bucket CORS for exact frontend origins and `GET`, `HEAD`, and `PUT`. Presigned URLs are bearer credentials and should stay at the existing 15-minute default or shorter.

For Neon, use the JDBC URL in `DATABASE_URL` and its generated role/password in `DATABASE_USERNAME` / `DATABASE_PASSWORD`. Require TLS in the hosted connection string.

Set `TRANSCRIPTION_URL` to a private service-to-service origin. Do not expose the speech container publicly; it accepts raw audio and has no end-user authentication because the worker is its trust boundary. Persist its model cache or bake the selected model into the deployment so restarts do not repeatedly download it.

## Deployment order

1. Create Clerk production instance and exact frontend origins.
2. Create PostgreSQL and run the API once so Flyway applies migrations.
3. Create a private bucket, scoped credentials, and CORS.
4. Deploy the API with `WORKER_ENABLED=false` and verify health.
5. Deploy the private speech service, verify `/health`, and set the worker's `TRANSCRIPTION_URL`.
6. Deploy the worker from the backend image with `WORKER_ENABLED=true`.
7. Build the frontend with the public production API URL and Clerk publishable key.
8. Exercise upload/edit/share/transcript smoke workflows before accepting user uploads.

Before launch, configure database backups, an object lifecycle/retention policy, monitoring for API/worker/transcriber health and job failures, and a tested restore procedure. If the API scales past one instance, move request limiting to a shared service or the platform edge.

## Operational acceptance checks

- Monitor HTTPS and API `/actuator/health/readiness` from the public side. Check the worker's health endpoint and the speech service's `/health` on the private network. A speech health response can precede model loading. Run a speech fixture after a cold start to verify that downloads and inference work.
- Alert on sustained processing or transcription failures, rising job age, and container restarts. Confirm that a test alert reaches the on-call destination. Retain the API, worker, and speech logs according to the deployment's retention policy and avoid logging bearer tokens or presigned URLs.
- Schedule encrypted PostgreSQL backups and test a restore to a separate database. Run Flyway against the restored copy, verify readiness, and use a test workspace to check that restored video records still reference playable objects.
- Configure object retention around the recovery window. Expire incomplete multipart uploads after the upload recovery window. Keep live media and retained revisions out of age-based deletion rules. Test the lifecycle policy with a disposable prefix before applying it to the private bucket.
- Keep one API replica until a shared or edge write limiter is configured and verified. Test that the same limit applies across replicas before scaling.
