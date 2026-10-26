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

## Library organization and conversation

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET`, `POST` | `/api/folders` | signed in | List personal folders or create with `{ name }` (80 characters, maximum 50 folders). |
| `DELETE` | `/api/folders/{id}` | folder owner | Remove the folder; leave videos in the library. |
| `PATCH` | `/api/videos/{id}/organization` | video owner | Set the complete `{ folderId: null or UUID, favorite: boolean, archived: boolean }` state. |
| `GET` | `/api/videos/{id}/participants` | owner or valid share token | Existing signed-in commenters and creator, without emails. |
| `PATCH` | `/api/videos/{id}/comments/{commentId}` | signed-in author + video access | Edit `{ message }`. |
| `DELETE` | `/api/videos/{id}/comments/{commentId}` | signed-in author or owner + video access | Delete a comment and its replies. |
| `PATCH` | `/api/videos/{id}/comments/{commentId}/resolution` | video owner | Set `{ resolved: boolean }` on a root thread. |
| `GET` | `/api/videos/{id}/reactions` | owner or valid share token | Aggregate `{ emoji, count, mine }` values. |
| `POST` | `/api/videos/{id}/reactions` | signed in + video access | Toggle `{ emoji, timestampSeconds }`. Supported emoji: 👍 ❤️ 🎉 👀 💡. |
| `GET` | `/api/notifications` | recipient | Latest 100 notifications, including read state and whether the owner route is accessible. |
| `POST` | `/api/notifications/read` | recipient | Mark the current user's notifications as read. |

The existing comment creation request also accepts `parentId` for a reply and `mentionIds` (up to ten participant UUIDs). Replies must point to a root on the same video. Mentions notify existing participants only and never grant access. Guest mention IDs are ignored. Comment responses include the author's public Clerk ID, parent ID, resolution state, and edit timestamp.

For shared access, pass `?shareToken=` on comment, participant, and reaction requests, including signed-in requests. Without a share token these operations require video ownership. Revoked links fail immediately. Archives do not change sharing or quotas.
