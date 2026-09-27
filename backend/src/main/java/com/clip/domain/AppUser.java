package com.clip.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "app_users")
public class AppUser {
  @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
  @Column(name = "clerk_user_id", nullable = false, unique = true) private String clerkUserId;
  private String email;
  @Column(name = "display_name", nullable = false) private String displayName = "Clip user";
  @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt = Instant.now();
  @Column(name = "updated_at", nullable = false) private Instant updatedAt = Instant.now();

  protected AppUser() {}
  public AppUser(String clerkUserId) { this.clerkUserId = clerkUserId; }
  @PreUpdate void updateTimestamp() { updatedAt = Instant.now(); }
  public UUID getId() { return id; }
  public String getClerkUserId() { return clerkUserId; }
  public String getEmail() { return email; }
  public String getDisplayName() { return displayName; }
  public Instant getCreatedAt() { return createdAt; }
  public void updateProfile(String email, String displayName) {
    this.email = email;
    this.displayName = displayName;
    this.updatedAt = Instant.now();
  }
}
