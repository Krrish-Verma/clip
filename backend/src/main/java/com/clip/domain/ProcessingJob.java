package com.clip.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "processing_jobs")
public class ProcessingJob {
  public enum State { QUEUED, RUNNING, SUCCEEDED, FAILED }
  @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
  @OneToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "video_id") private Video video;
  @Enumerated(EnumType.STRING) @Column(nullable = false) private State state = State.QUEUED;
  @Column(nullable = false) private int attempts;
  @Column(name = "next_attempt_at", nullable = false) private Instant nextAttemptAt = Instant.now();
  @Column(name = "locked_at") private Instant lockedAt;
  @Column(name = "worker_id") private String workerId;
  @Column(name = "last_error") private String lastError;
  @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt = Instant.now();
  @Column(name = "updated_at", nullable = false) private Instant updatedAt = Instant.now();
  protected ProcessingJob() {}
  public ProcessingJob(Video video) { this.video = video; }
  public UUID getId() { return id; }
  public Video getVideo() { return video; }
  public State getState() { return state; }
  public int getAttempts() { return attempts; }
  public String getLastError() { return lastError; }
  public void claim(String worker) { state = State.RUNNING; attempts++; workerId = worker; lockedAt = Instant.now(); updatedAt = Instant.now(); }
  public void succeed() { state = State.SUCCEEDED; lockedAt = null; updatedAt = Instant.now(); }
  public void retryOrFail(String error, int maxAttempts) {
    lastError = error.substring(0, Math.min(1000, error.length())); lockedAt = null; updatedAt = Instant.now();
    if (attempts >= maxAttempts) state = State.FAILED;
    else { state = State.QUEUED; nextAttemptAt = Instant.now().plusSeconds(30L * (1L << Math.max(0, attempts - 1))); }
  }
  public void requeue() { state = State.QUEUED; lockedAt = null; workerId = null; nextAttemptAt = Instant.now(); updatedAt = Instant.now(); }
  public void manualRetry() { attempts = 0; lastError = null; requeue(); }
}
