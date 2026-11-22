package com.clip.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "viewing_sessions")
public class ViewingSession {
  @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "video_id") private Video video;
  @Column(name = "viewer_hash", nullable = false, length = 64) private String viewerHash;
  @Column(name = "access_kind", nullable = false) private String accessKind;
  @Column(name = "started_at", nullable = false, updatable = false) private Instant startedAt = Instant.now();
  @Column(name = "last_event_at", nullable = false) private Instant lastEventAt = Instant.now();
  @Column(name = "last_position_seconds", nullable = false) private double lastPositionSeconds;
  @Column(name = "max_position_seconds", nullable = false) private double maxPositionSeconds;
  @Column(name = "watch_time_seconds", nullable = false) private double watchTimeSeconds;
  @Column(nullable = false) private boolean completed;
  @Column(name="watched_ranges") private String watchedRanges;
  @Column(name="media_revision",nullable=false) private int mediaRevision;
  protected ViewingSession() {}
  public ViewingSession(Video video, String viewerHash, String accessKind) { this.video = video; this.viewerHash = viewerHash; this.accessKind = accessKind;mediaRevision=video.getPublishedRevision(); }
  public UUID getId() { return id; }
  public Video getVideo() { return video; }
  public String getViewerHash() { return viewerHash; }
  public double getMaxPositionSeconds() { return maxPositionSeconds; }
  public double getWatchTimeSeconds() { return watchTimeSeconds; }
  public boolean isCompleted() { return completed; }
  public int getMediaRevision(){return mediaRevision;}
  public java.util.BitSet watched(){return watchedRanges==null?new java.util.BitSet():java.util.BitSet.valueOf(java.util.Base64.getDecoder().decode(watchedRanges));}
  public double watchedPercentage(double duration){return Math.min(100,watched().cardinality()/Math.max(1,duration)*100);}
  public void progress(double position, double duration, boolean complete) {
    double safe = Math.max(0, Math.min(position, duration));
    double elapsed=Math.max(0,java.time.Duration.between(lastEventAt,Instant.now()).toMillis()/1000.0);
    double delta=safe-lastPositionSeconds;
    java.util.BitSet ranges=watched();
    // A seek is not watch time. Bound reported progress by wall time and supported playback speed.
    if(delta>0&&delta<=Math.min(32,elapsed*2.25+2))ranges.set((int)Math.floor(lastPositionSeconds),(int)Math.ceil(safe));
    watchedRanges=java.util.Base64.getEncoder().encodeToString(ranges.toByteArray());
    watchTimeSeconds=Math.min(duration,ranges.cardinality());
    lastPositionSeconds = safe; maxPositionSeconds = Math.max(maxPositionSeconds, safe);
    completed = completed || (duration>0&&safe/duration>=.9&&watchedPercentage(duration)>=90);
    lastEventAt = Instant.now();
  }
}
