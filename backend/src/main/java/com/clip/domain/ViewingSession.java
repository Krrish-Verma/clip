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
  protected ViewingSession() {}
  public ViewingSession(Video video, String viewerHash, String accessKind) { this.video = video; this.viewerHash = viewerHash; this.accessKind = accessKind; }
  public UUID getId() { return id; }
  public Video getVideo() { return video; }
  public String getViewerHash() { return viewerHash; }
  public double getMaxPositionSeconds() { return maxPositionSeconds; }
  public double getWatchTimeSeconds() { return watchTimeSeconds; }
  public boolean isCompleted() { return completed; }
  public void progress(double position, double duration, boolean complete) {
    double safe = Math.max(0, Math.min(position, duration));
    double delta = Math.max(0, Math.min(15, safe - lastPositionSeconds));
    watchTimeSeconds = Math.min(duration, watchTimeSeconds + delta);
    lastPositionSeconds = safe; maxPositionSeconds = Math.max(maxPositionSeconds, safe);
    completed = completed || complete || (duration > 0 && safe / duration >= .9);
    lastEventAt = Instant.now();
  }
}
