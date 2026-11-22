ALTER TABLE folders DROP CONSTRAINT folders_owner_id_name_key;
CREATE UNIQUE INDEX idx_personal_folder_name ON folders(owner_id,lower(name)) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX idx_team_folder_name ON folders(organization_id,lower(name)) WHERE organization_id IS NOT NULL;
ALTER TABLE videos ADD COLUMN published_revision integer NOT NULL DEFAULT 0;
ALTER TABLE comments ADD COLUMN media_revision integer NOT NULL DEFAULT 0;
CREATE TABLE media_versions (
 video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
 revision integer NOT NULL,
 duration_seconds double precision NOT NULL,
 playback_key varchar(512) NOT NULL,
 thumbnail_key varchar(512),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(video_id,revision)
);
INSERT INTO media_versions(video_id,revision,duration_seconds,playback_key,thumbnail_key)
 SELECT id,0,duration_seconds,playback_object_key,thumbnail_object_key FROM videos WHERE status='READY';
