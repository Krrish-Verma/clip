# Future deployment and service limits

No deployment or paid-plan activation is part of this repository. The following candidates were checked against official vendor material on 2026-09-27; pricing and limits can change, so re-check before launch.

## Recommended small hosted shape

- **Authentication: Clerk Hobby.** The published plan includes 50,000 monthly retained users per app, three dashboard seats, a fixed seven-day session lifetime, and one day of application logs; Clerk says no credit card is required. Over the limit requires a paid plan. Source: [Clerk pricing](https://clerk.com/pricing).
- **Database: Neon Free PostgreSQL.** The latest official material at review time describes 50 CU-hours/month and 0.5 GB database storage per project, 5 GB egress/month, and scale-to-zero; Neon advertises signup without a credit card. Treat it as a launch candidate, not permanent free hosting, and confirm the current [Neon pricing](https://neon.com/pricing) and [official plan explanation](https://neon.com/blog/new-usage-based-pricing) before provisioning.
- **Objects: Cloudflare R2 Standard.** The monthly free tier is 10 GB-month storage, one million Class A operations, ten million Class B operations, and free direct egress. Usage above those amounts is billed with unit rounding. R2 is a usage-billed service; Cloudflare may require/validate a payment method and may preauthorize it. Configure spending notifications and do not enable it until that risk is acceptable. Sources: [R2 pricing](https://developers.cloudflare.com/r2/pricing/) and [Cloudflare billing policy](https://developers.cloudflare.com/billing/understand/billing-policy/).
- **API and processing compute:** use one container-capable service initially and run the same image in API and worker roles, or combine roles with `WORKER_ENABLED=true` at very small scale. There is no dependable permanently-free recommendation for an always-available FFmpeg worker; choose a paid container/VM only at deployment time after measuring CPU, memory, timeout, and persistent-egress policy. Do not use a serverless function with a short request timeout for this worker.

No CDN is required initially: R2's S3 endpoint serves short-lived GET URLs and supports range requests. A CDN can be added later only if playback economics or latency justify it.

## Production variables

Replace local database and S3 values in `backend/.env.example`. For R2:

- `S3_ENDPOINT` and `S3_PRESIGN_ENDPOINT`: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- `S3_REGION`: `auto`
- `S3_BUCKET`: the private bucket name
- `S3_ACCESS_KEY` / `S3_SECRET_KEY`: scoped R2 API token credentials, secret

Apply bucket CORS for exact frontend origins and `GET`, `HEAD`, and `PUT`. Presigned URLs are bearer credentials and should stay at the existing 15-minute default or shorter.

For Neon, use the JDBC URL in `DATABASE_URL` and its generated role/password in `DATABASE_USERNAME` / `DATABASE_PASSWORD`. Require TLS in the hosted connection string.

## Deployment order

1. Create Clerk production instance and exact frontend origins.
2. Create PostgreSQL and run the API once so Flyway applies migrations.
3. Create a private bucket, scoped credentials, and CORS.
4. Deploy the API with `WORKER_ENABLED=false` and verify health.
5. Deploy the worker from the same image with `WORKER_ENABLED=true`.
6. Build the frontend with the public production API URL and Clerk publishable key.
7. Exercise the smoke workflow before accepting user uploads.
