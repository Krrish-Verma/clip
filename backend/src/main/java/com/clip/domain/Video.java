package com.clip.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "videos")
public class Video {
  public enum Status { UPLOADING, PROCESSING, READY, FAILED }
  public enum Visibility { PRIVATE, UNLISTED }
  @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "owner_id") private AppUser owner;
  @Column(nullable = false) private String title;
  @Enumerated(EnumType.STRING) @Column(nullable = false) private Status status = Status.UPLOADING;
  @Enumerated(EnumType.STRING) @Column(nullable = false) private Visibility visibility = Visibility.PRIVATE;
  @Column(name = "declared_mime_type", nullable = false) private String declaredMimeType;
  @Column(name = "declared_size_bytes", nullable = false) private long declaredSizeBytes;
  @Column(name = "source_object_key", nullable = false, unique = true) private String sourceObjectKey;
  @Column(name = "playback_object_key") private String playbackObjectKey;
  @Column(name = "thumbnail_object_key") private String thumbnailObjectKey;
  @Column(name = "duration_seconds") private Double durationSeconds;
  @Column(name = "failure_reason") private String failureReason;
  @Column(name = "upload_completed_at") private Instant uploadCompletedAt;
  @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt = Instant.now();
  @Column(name = "updated_at", nullable = false) private Instant updatedAt = Instant.now();
  @Version private long version;
  @Column(name = "folder_id") private UUID folderId;
  @Column(nullable = false) private boolean favorite;
  @Column(nullable = false) private boolean archived;

  protected Video() {}
  public Video(AppUser owner, String title, String mimeType, long size, String sourceKey) {
    this.owner = owner; this.title = title; this.declaredMimeType = mimeType;
    this.declaredSizeBytes = size; this.sourceObjectKey = sourceKey;
  }
  @PreUpdate void updateTimestamp() { updatedAt = Instant.now(); }
  public UUID getId() { return id; }
  public AppUser getOwner() { return owner; }
  public String getTitle() { return title; }
  public Status getStatus() { return status; }
  public Visibility getVisibility() { return visibility; }
  public String getDeclaredMimeType() { return declaredMimeType; }
  public long getDeclaredSizeBytes() { return declaredSizeBytes; }
  public String getSourceObjectKey() { return sourceObjectKey; }
  public String getPlaybackObjectKey() { return playbackObjectKey; }
  public String getThumbnailObjectKey() { return thumbnailObjectKey; }
  public Double getDurationSeconds() { return durationSeconds; }
  public String getFailureReason() { return failureReason; }
  public Instant getUploadCompletedAt() { return uploadCompletedAt; }
  public Instant getCreatedAt() { return createdAt; }
  public Instant getUpdatedAt() { return updatedAt; }
  public void rename(String value) { title = value; }
  public UUID getFolderId() { return folderId; }
  public boolean isFavorite() { return favorite; }
  public boolean isArchived() { return archived; }
  public void organize(UUID folderId, boolean favorite, boolean archived) {
    this.folderId = folderId; this.favorite = favorite; this.archived = archived;
  }
  public void markProcessing() { status = Status.PROCESSING; uploadCompletedAt = Instant.now(); failureReason = null; }
  public void markReady(double duration, String playbackKey, String thumbnailKey) {
    status = Status.READY; durationSeconds = duration; playbackObjectKey = playbackKey;
    thumbnailObjectKey = thumbnailKey; failureReason = null;
  }
  public void markFailed(String reason) { status = Status.FAILED; failureReason = reason; }
  public void retry() { status = Status.PROCESSING; failureReason = null; }
  public void shared() { visibility = Visibility.UNLISTED; }
  public void privateAgain() { visibility = Visibility.PRIVATE; }
}
