# Clip HTTP API

The base URL is `NEXT_PUBLIC_API_URL`. Handled errors return `{ "message": "..." }`. Authenticated endpoints require a Clerk session JWT in `Authorization: Bearer <token>`. A Clerk Organization claim selects the active team workspace; otherwise requests use the personal workspace.

Shared endpoints accept `?shareToken=<token>`. For a protected share, also send `X-Clip-Share-Password`; the browser client sends a UTF-8 password as `b64:<base64>` so non-ASCII passwords survive headers. Expired, revoked, or mismatched tokens never grant access.

## Configuration and profile

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/config` | public | Return the backend quota policy used by the recorder. |
| `PUT` | `/api/users/me` | signed in | Sync `{ email, displayName }` to the Clerk subject. |

## Videos and uploads

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/videos` | signed in | List videos in the active personal or Organization workspace. |
| `POST` | `/api/videos` | signed in | Create `{ title, mimeType, sizeBytes }`; returns `{ videoId, uploadUrl }`. |
| `POST` | `/api/videos/{id}/upload-url` | creator/admin | Refresh a single-part upload URL while `UPLOADING`. |
| `POST` | `/api/videos/{id}/multipart` | creator/admin | Start/resume multipart upload; returns part size, signed URLs, and completed-part flags. |
| `POST` | `/api/videos/{id}/multipart/complete` | creator/admin | Validate all part numbers/sizes, complete S3 multipart upload, and queue processing. |
| `POST` | `/api/videos/{id}/complete` | creator/admin | Verify a completed object and queue processing; idempotent after acceptance. |
| `GET` | `/api/videos/{id}` | workspace member | Return processing and library metadata. |
| `POST` | `/api/videos/{id}/retry` | creator/admin | Requeue a failed processing job. |
| `PATCH` | `/api/videos/{id}` | creator/admin | Rename with `{ title }`. |
| `DELETE` | `/api/videos/{id}` | creator/admin | Abort multipart work, remove all source/version objects, and cascade rows. |
| `GET` | `/api/videos/{id}/playback` | workspace member | Return `{ playbackUrl, expiresAt }`. |

Supported upload types are `video/webm`, `video/mp4`, and `video/quicktime`. Codec parameters are normalized before signing. Defaults are five source videos, 200 MiB per source, 1 GiB declared source storage per creator, ten minutes after inspection, and 8 MiB multipart parts.

## Sharing and embeds

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/videos/{id}/share` | creator/admin | Rotate the link with optional `{ password, expiresAt }`; returns `{ shareUrl }`. |
| `DELETE` | `/api/videos/{id}/share` | creator/admin | Revoke the live link immediately. |
| `GET` | `/api/shares/{token}` | valid share | Sanitized metadata and temporary playback URL. |

Passwords are 8-72 UTF-8 bytes when present. Expiry must be in the future and at most one year away. `/s/{token}` is the conversation page and `/embed/{token}` is the frameable player. Generating a new link invalidates the previous token.

## Media studio and transcripts

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/videos/{id}/studio` | workspace member or valid share | Revision, render/transcript state, description, and CTA. Failure details are hidden from shared viewers. |
| `GET` | `/api/videos/{id}/studio/revisions` | workspace member or valid share | Owners/team members receive all versions; shared viewers receive only the published revision. |
| `POST` | `/api/videos/{id}/studio/edits` | creator/admin | Queue a revisioned media render. |
| `PATCH` | `/api/videos/{id}/studio` | creator/admin | Set `{ description, ctaLabel, ctaUrl }`. |
| `POST` | `/api/videos/{id}/studio/transcribe` | creator/admin | Queue private speech recognition for the published revision. |
| `PATCH` | `/api/videos/{id}/studio/transcript` | creator/admin | Replace ordered transcript segments for the current revision. |

An edit accepts up to 30 ordered source ranges from ready clips owned in the active workspace, up to 10 blur regions, up to 10 box regions, an optional crop, a 200-character overlay, `landscape`, `square`, or `portrait`, and a thumbnail time. Normalized crop/region coordinates are between 0 and 1. A clip supports ten rendered revisions; its existing published media stays live while the next revision renders.

```json
{
  "segments": [{ "videoId": "uuid", "start": 2.0, "end": 12.0 }],
  "crop": { "x": 0, "y": 0, "width": 1, "height": 1 },
  "blurs": [{ "x": 0.1, "y": 0.1, "width": 0.25, "height": 0.15 }],
  "boxes": [],
  "overlayText": "Next step",
  "aspect": "landscape",
  "thumbnailAt": 3.5
}
```

## Conversation and activity

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/folders` | signed in | List folders in the active workspace. |
| `POST` | `/api/folders` | signed in | Create `{ name }` (80 characters, maximum 50). |
| `DELETE` | `/api/folders/{id}` | creator/admin | Remove a folder without deleting its videos. |
| `PATCH` | `/api/videos/{id}/organization` | creator/admin | Set `{ folderId, favorite, archived }`. |
| `GET` | `/api/videos/{id}/participants` | workspace member or valid share | Creator and signed-in commenters, without emails. |
| `GET`, `POST` | `/api/videos/{id}/comments` | workspace member or valid share | List comments or add a timestamped root/reply. |
| `PATCH` | `/api/videos/{id}/comments/{commentId}` | signed-in author with access | Edit `{ message }`. |
| `DELETE` | `/api/videos/{id}/comments/{commentId}` | author or creator/admin | Delete a comment and nested replies. |
| `PATCH` | `/api/videos/{id}/comments/{commentId}/resolution` | creator/admin | Set `{ resolved }` on a root thread. |
| `GET` | `/api/videos/{id}/reactions` | workspace member or valid share | Reaction aggregates with the signed-in viewer's toggle state. |
| `POST` | `/api/videos/{id}/reactions` | signed in with access | Toggle `{ emoji, timestampSeconds }`. |
| `GET` | `/api/notifications` | signed in | Latest 100 notifications. |
| `POST` | `/api/notifications/read` | signed in | Mark notifications read. |

Comment creation accepts `{ message, timestampSeconds, guestDisplayName?, parentId?, mentionIds?, mediaRevision? }`. Replies inherit the root thread's revision. Mentions are limited to existing participants and never grant access. Guests can create messages but do not receive durable edit credentials. Read notifications older than 90 days and all notifications older than one year are removed by the worker.

## Analytics

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/videos/{id}/analytics/progress` | workspace member or valid share | Upsert bounded watched ranges for a viewing session. |
| `GET` | `/api/videos/{id}/analytics` | creator/admin | Revision-scoped views, unique viewers, coverage, completion, watch time, and engagement intervals. |

Progress accepts `START`, `PROGRESS`, `PAUSE`, or `COMPLETE` and returns a durable `sessionId`. The server validates duration, viewer identity, video, and media revision; seeking or replaying the same range does not inflate watch coverage.

```json
{
  "sessionId": null,
  "anonymousViewerId": "browser-generated UUID",
  "positionSeconds": 12.5,
  "durationSeconds": 60.0,
  "eventType": "PROGRESS"
}
```

Signed-in writes are limited to 90 requests per minute per Clerk subject. Guest comments, analytics, and protected-link attempts have separate in-process limits. Use a shared edge/service limiter before running multiple API instances.
