package com.clip.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "comments")
public class Comment {
  @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
  @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "video_id") private Video video;
  @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "author_user_id") private AppUser author;
  @Column(name = "guest_display_name") private String guestDisplayName;
  @Column(nullable = false) private String message;
  @Column(name = "timestamp_seconds", nullable = false) private int timestampSeconds;
  @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt = Instant.now();
  protected Comment() {}
  public Comment(Video video, AppUser author, String guestName, String message, int timestamp) {
    this.video = video; this.author = author; this.guestDisplayName = guestName;
    this.message = message; this.timestampSeconds = timestamp;
  }
  public UUID getId() { return id; }
  public AppUser getAuthor() { return author; }
  public String getGuestDisplayName() { return guestDisplayName; }
  public String getMessage() { return message; }
  public int getTimestampSeconds() { return timestampSeconds; }
  public Instant getCreatedAt() { return createdAt; }
}
