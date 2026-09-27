package com.clip.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "share_links")
public class ShareLink {
  @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
  @OneToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "video_id") private Video video;
  @Column(name = "token_hash", nullable = false, unique = true, length = 64) private String tokenHash;
  @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt = Instant.now();
  @Column(name = "revoked_at") private Instant revokedAt;
  protected ShareLink() {}
  public ShareLink(Video video, String tokenHash) { this.video = video; this.tokenHash = tokenHash; }
  public Video getVideo() { return video; }
  public String getTokenHash() { return tokenHash; }
  public Instant getRevokedAt() { return revokedAt; }
  public void revoke() { revokedAt = Instant.now(); }
  public void reactivate(String tokenHash) { this.tokenHash = tokenHash; this.revokedAt = null; }
}
