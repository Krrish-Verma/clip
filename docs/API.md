# Clip HTTP API

The base URL is `NEXT_PUBLIC_API_URL`. JSON endpoints return `{ "message": "…" }` on handled errors. Owner endpoints require a Clerk session token in `Authorization: Bearer <token>`.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `PUT` | `/api/users/me` | signed in | Sync `{ email, displayName }` to the Clerk subject. |
| `GET` | `/api/videos` | owner | List the owner's videos. |
| `POST` | `/api/videos` | owner | Create an upload with `{ title, mimeType, sizeBytes }`; returns `{ videoId, uploadUrl }`. |
| `POST` | `/api/videos/{id}/upload-url` | owner | Refresh an expired/interrupted upload URL while status is `UPLOADING`. |
| `GET` | `/api/videos/{id}` | owner | Get processing and library metadata. |
| `POST` | `/api/videos/{id}/complete` | owner | Verify the uploaded object and queue processing. Idempotent after acceptance. |
| `POST` | `/api/videos/{id}/retry` | owner | Requeue a failed processing job. |
| `PATCH` | `/api/videos/{id}` | owner | Rename with `{ title }`. |
| `DELETE` | `/api/videos/{id}` | owner | Remove objects and cascade all related rows. |
| `GET` | `/api/videos/{id}/playback` | owner | Return `{ playbackUrl, expiresAt }`. |
| `POST` | `/api/videos/{id}/share` | owner | Create/rotate an unlisted link; returns `{ shareUrl }`. |
| `DELETE` | `/api/videos/{id}/share` | owner | Revoke the current link immediately. |
| `GET` | `/api/shares/{token}` | valid share | Sanitized metadata plus temporary playback URL. |
| `GET` | `/api/videos/{id}/comments` | owner or `?shareToken=` | Ordered comments. |
| `POST` | `/api/videos/{id}/comments` | owner or `?shareToken=` | Add `{ message, timestampSeconds, guestDisplayName? }`. |
| `POST` | `/api/videos/{id}/analytics/progress` | owner or `?shareToken=` | Upsert a bounded viewing session aggregate. |
| `GET` | `/api/videos/{id}/analytics` | owner | Aggregate views, unique viewers, watch percentage, completion, and watch time. |

Supported upload content types are `video/webm`, `video/mp4`, and `video/quicktime`. Parameters such as `video/webm;codecs=vp9,opus` are normalized before signing. Default limits are five videos, 200 MiB per source, 1 GiB declared storage per user, and ten minutes duration after inspection.

`POST /analytics/progress` accepts:

```json
{
  "sessionId": null,
  "anonymousViewerId": "browser-generated UUID",
  "positionSeconds": 12.5,
  "durationSeconds": 60.0,
  "eventType": "START"
}
```

`eventType` is `START`, `PROGRESS`, `PAUSE`, or `COMPLETE`. The API returns the durable `sessionId` for subsequent updates.
