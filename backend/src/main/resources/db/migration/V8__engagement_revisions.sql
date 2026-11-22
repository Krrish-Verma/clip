ALTER TABLE viewing_sessions ADD COLUMN media_revision integer NOT NULL DEFAULT 0;
CREATE INDEX idx_viewing_sessions_revision ON viewing_sessions(video_id,media_revision);
CREATE INDEX idx_notifications_retention ON notifications(created_at);
