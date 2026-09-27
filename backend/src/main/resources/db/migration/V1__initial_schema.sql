CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id varchar(255) NOT NULL UNIQUE,
  email varchar(320),
  display_name varchar(100) NOT NULL DEFAULT 'Clip user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL,
  status varchar(20) NOT NULL CHECK (status IN ('UPLOADING','PROCESSING','READY','FAILED')),
  visibility varchar(20) NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PRIVATE','UNLISTED')),
  declared_mime_type varchar(100) NOT NULL,
  declared_size_bytes bigint NOT NULL CHECK (declared_size_bytes > 0),
  source_object_key varchar(512) NOT NULL UNIQUE,
  playback_object_key varchar(512),
  thumbnail_object_key varchar(512),
  duration_seconds numeric(10,3),
  failure_reason varchar(500),
  upload_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version bigint NOT NULL DEFAULT 0
);
CREATE INDEX idx_videos_owner_created ON videos(owner_id, created_at DESC);
CREATE INDEX idx_videos_status_updated ON videos(status, updated_at);

CREATE TABLE share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL UNIQUE REFERENCES videos(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES app_users(id) ON DELETE SET NULL,
  guest_display_name varchar(100),
  message varchar(1000) NOT NULL,
  timestamp_seconds integer NOT NULL CHECK (timestamp_seconds >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (author_user_id IS NOT NULL OR guest_display_name IS NOT NULL)
);
CREATE INDEX idx_comments_video_created ON comments(video_id, created_at);

CREATE TABLE processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL UNIQUE REFERENCES videos(id) ON DELETE CASCADE,
  state varchar(20) NOT NULL CHECK (state IN ('QUEUED','RUNNING','SUCCEEDED','FAILED')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  worker_id varchar(200),
  last_error varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_processing_jobs_poll ON processing_jobs(state, next_attempt_at, created_at);

CREATE TABLE viewing_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  viewer_hash char(64) NOT NULL,
  access_kind varchar(20) NOT NULL CHECK (access_kind IN ('OWNER','SHARE')),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_event_at timestamptz NOT NULL DEFAULT now(),
  last_position_seconds numeric(10,3) NOT NULL DEFAULT 0,
  max_position_seconds numeric(10,3) NOT NULL DEFAULT 0,
  watch_time_seconds numeric(10,3) NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false
);
CREATE INDEX idx_viewing_sessions_video ON viewing_sessions(video_id, started_at);
CREATE INDEX idx_viewing_sessions_unique ON viewing_sessions(video_id, viewer_hash);
