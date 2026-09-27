package com.clip.api;

import com.clip.domain.Comment;
import com.clip.domain.Video;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.UUID;

public final class ApiModels {
  private ApiModels() {}
  public record UserResponse(UUID id, String email, String displayName) {}
  public record ProfileRequest(@Email @Size(max=320) String email, @NotBlank @Size(max=100) String displayName) {}
  public record CreateVideoRequest(@NotBlank @Size(max=200) String title, @NotBlank @Size(max=100) String mimeType, @Positive long sizeBytes) {}
  public record CreateVideoResponse(UUID videoId, String uploadUrl) {}
  public record UploadUrlResponse(String uploadUrl) {}
  public record RenameRequest(@NotBlank @Size(max=200) String title) {}
  public record VideoResponse(UUID id, String title, Video.Status status, Video.Visibility visibility, Double durationSeconds,
                              String thumbnailUrl, Instant createdAt, long views, String creatorDisplayName) {}
  public record PlaybackResponse(String playbackUrl, Instant expiresAt) {}
  public record ShareResponse(String shareUrl) {}
  public record SharedVideoResponse(UUID id, String title, Video.Status status, Video.Visibility visibility, Double durationSeconds,
                                    String thumbnailUrl, Instant createdAt, long views, String creatorDisplayName,
                                    String playbackUrl, Instant playbackExpiresAt) {}
  public record CommentRequest(@NotBlank @Size(max=1000) String message, @PositiveOrZero int timestampSeconds,
                               @Size(max=100) String guestDisplayName) {}
  public record CommentResponse(UUID id, String displayName, String message, int timestampSeconds, Instant createdAt) {
    public static CommentResponse from(Comment value) {
      String name = value.getAuthor() == null ? value.getGuestDisplayName() : value.getAuthor().getDisplayName();
      return new CommentResponse(value.getId(), name, value.getMessage(), value.getTimestampSeconds(), value.getCreatedAt());
    }
  }
  public record ProgressRequest(UUID sessionId, @NotBlank @Size(max=100) String anonymousViewerId,
                                @PositiveOrZero double positionSeconds, @Positive double durationSeconds,
                                @NotBlank String eventType) {}
  public record ProgressResponse(UUID sessionId) {}
  public record AnalyticsResponse(long totalViews, long uniqueViewers, double averageWatchPercentage,
                                  double completionRate, double averageWatchTimeSeconds) {}
}
