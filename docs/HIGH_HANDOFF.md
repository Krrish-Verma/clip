# Clip: next implementation phase

## Completed in the Medium pass

- Library redesign: sidebar, overview metrics, responsive cards, useful empty/loading states, grid/list view, search and sorting.
- Persisted personal folders, per-video favorite and archive state, archive restoration, and safe folder removal.
- Video conversation panel with timestamped replies, editing, deletion, thread resolution, five reaction types, and participant mentions.
- Persisted activity inbox: owner comment/reaction notifications, reply notifications, mention recipients, unread count and mark-all-read.
- Keyboard navigation dialog (`Ctrl/Cmd+K`), explicit modal close buttons, and keyboard comment submission (`Ctrl/Cmd+Enter`).
- Updated landing/recorder presentation without changing the capture pipeline.
- Flyway V4 migration plus PostgreSQL integration coverage for ownership, foreign-folder rejection, cross-video replies, reactions, notifications, and revoked shares.
- README, HTTP API reference, and public-preview status.

## Start with High reasoning

1. **Recorder:** webcam bubble compositing, camera-only recording, device selectors, quality controls, countdown, drawing/cursor emphasis, sensitive-region blur, screenshots, durable recording drafts and resumable uploads.
2. **Editor:** trim/split/stitch/crop, custom thumbnails, overlays, versioned processing jobs and stable share URLs after replacement.
3. **Transcript and AI:** speech transcription, captions, transcript search/editing, titles, summaries, chapters, tasks, silence/filler removal, suggested redaction. Choose providers and define budget/data-handling choices before enabling paid processing.
4. **Team workspaces:** Clerk Organizations with personal accounts retained, tenant-scoped videos/folders, invitation/member roles, shared libraries and authorization tests. This is held for High because it changes the existing ownership model throughout the API. No Clerk organization setting was changed in this pass.
5. **Deployment:** confirm Vercel/Render/Neon authentication, provision PostgreSQL and private object storage, deploy API and FFmpeg worker, configure exact origins, then run the authenticated audiovisual smoke test. Production Clerk requires an owned custom domain; the free Vercel hostname supports a development demo only.
6. **Production hardening:** quotas consistent between frontend and backend, pagination in the API, notification retention, rate limits for signed-in write endpoints, SQL query/load tuning, retries/cancellation, observability, backup/restore and browser authenticated E2E tests.
7. **Extended collaboration:** email/push delivery, richer activity deep links, viewer permissions/passwords/expiring links, embeds, CTAs, integrations, detailed engagement heatmaps and exports.

## Important behavior

- Folders/favorites/archive are private to the owner. Archive does not revoke sharing or release quota.
- A thread has one level of replies. Deleting a root cascades its replies; only the owner resolves/reopens it.
- Guest comments/replies require a valid share token. Guests do not have durable edit credentials; they cannot edit/delete their own messages later.
- Reactions are one toggle per signed-in user, video, and emoji, with the time recorded in the database.
- Mentions accept explicit participant IDs from the video participant list; typing arbitrary `@text` alone does not send a notification.
- Notifications do not grant access. A non-owner must return through a still-valid share link.
- The library paginates display locally (12 cards); the API still returns the owner's full collection under the current five-video quota.

## Verification commands

```powershell
cd C:\Clip
npm ci
npm run lint
npm run typecheck
npm run build
npm run test:ui
cd backend
.\mvnw.cmd test
```

Docker must be running for the real PostgreSQL integration tests; otherwise Testcontainers skips them. UI presentation tests use Edge by default and a separate unauthenticated Next development server on port 3100. They do not exercise real Clerk sign-in, live media capture, or cloud upload. Validate those during the High deployment phase.
