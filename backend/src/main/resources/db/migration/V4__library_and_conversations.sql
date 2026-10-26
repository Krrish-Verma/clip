CREATE TABLE folders (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, name)
);
ALTER TABLE videos ADD COLUMN folder_id uuid REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE videos ADD COLUMN favorite boolean NOT NULL DEFAULT false;
ALTER TABLE videos ADD COLUMN archived boolean NOT NULL DEFAULT false;
ALTER TABLE comments ADD COLUMN parent_id uuid REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE comments ADD COLUMN resolved boolean NOT NULL DEFAULT false;
ALTER TABLE comments ADD COLUMN edited_at timestamptz;
CREATE TABLE reactions (
  id uuid PRIMARY KEY,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  emoji varchar(20) NOT NULL,
  timestamp_seconds integer NOT NULL CHECK(timestamp_seconds >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(video_id, author_id, emoji)
);
CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  recipient_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  message varchar(300) NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, created_at DESC);
