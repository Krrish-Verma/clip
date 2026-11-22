CREATE TABLE transcript_jobs (
 video_id uuid PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
 revision integer NOT NULL,
 playback_key varchar(512) NOT NULL,
 state varchar(20) NOT NULL DEFAULT 'QUEUED',
 requested_at timestamptz NOT NULL DEFAULT now(),
 locked_at timestamptz,
 attempts integer NOT NULL DEFAULT 0,
 last_error varchar(300)
);
