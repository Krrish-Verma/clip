package com.clip.service;

import static com.clip.api.ApiModels.*;

import com.clip.config.ApiExceptionHandler.ApiProblem;
import com.clip.config.ClipProperties;
import com.clip.domain.*;
import com.clip.repository.*;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Service
public class VideoService {
  private static final Set<String> CONTENT_TYPES = Set.of("video/webm", "video/mp4", "video/quicktime");
  private final VideoRepository videos;
  private final ShareLinkRepository shares;
  private final CommentRepository comments;
  private final ProcessingJobRepository jobs;
  private final ViewingSessionRepository sessions;
  private final CurrentUserService currentUsers;
  private final StorageService storage;
  private final ClipProperties properties;
  private final SecureRandom random = new SecureRandom();

  public VideoService(VideoRepository videos, ShareLinkRepository shares, CommentRepository comments,
      ProcessingJobRepository jobs, ViewingSessionRepository sessions, CurrentUserService currentUsers,
      StorageService storage, ClipProperties properties) {
    this.videos=videos; this.shares=shares; this.comments=comments; this.jobs=jobs; this.sessions=sessions;
    this.currentUsers=currentUsers; this.storage=storage; this.properties=properties;
  }

  @Transactional
  public List<VideoResponse> list(Jwt jwt) {
    AppUser user = currentUsers.require(jwt);
    return videos.findAllByOwnerIdOrderByCreatedAtDesc(user.getId()).stream().map(this::response).toList();
  }

  @Transactional
  public VideoResponse getOwned(UUID id, Jwt jwt) { return response(owned(id, jwt)); }

  @Transactional
  public CreateVideoResponse create(CreateVideoRequest request, Jwt jwt) {
    AppUser owner = currentUsers.requireLocked(jwt);
    String mime = request.mimeType().split(";")[0].toLowerCase(Locale.ROOT);
    if (!CONTENT_TYPES.contains(mime)) throw new ApiProblem(HttpStatus.BAD_REQUEST, "This video format is not supported.");
    if (request.sizeBytes() > properties.quotas().maxVideoBytes()) throw new ApiProblem(HttpStatus.PAYLOAD_TOO_LARGE, "This recording exceeds the upload limit.");
    if (videos.countByOwnerId(owner.getId()) >= properties.quotas().maxVideos()) throw new ApiProblem(HttpStatus.CONFLICT, "Your video quota is full. Delete a clip before uploading another.");
    if (videos.totalDeclaredBytes(owner.getId()) + request.sizeBytes() > properties.quotas().maxStorageBytes()) throw new ApiProblem(HttpStatus.CONFLICT, "Your storage quota is full.");
    String key = "users/" + owner.getId() + "/sources/" + UUID.randomUUID() + extension(mime);
    Video video = videos.save(new Video(owner, request.title().trim(), mime, request.sizeBytes(), key));
    return new CreateVideoResponse(video.getId(), storage.uploadUrl(key, mime, request.sizeBytes()));
  }

  @Transactional
  public UploadUrlResponse refreshUploadUrl(UUID id, Jwt jwt) {
    Video video = owned(id, jwt);
    if (video.getStatus() != Video.Status.UPLOADING)
      throw new ApiProblem(HttpStatus.CONFLICT, "This video is no longer accepting uploads.");
    return new UploadUrlResponse(storage.uploadUrl(video.getSourceObjectKey(), video.getDeclaredMimeType(), video.getDeclaredSizeBytes()));
  }

  @Transactional
  public void complete(UUID id, Jwt jwt) {
    Video video = owned(id, jwt);
    if (video.getStatus() == Video.Status.PROCESSING || video.getStatus() == Video.Status.READY) return;
    if (video.getStatus() != Video.Status.UPLOADING) throw new ApiProblem(HttpStatus.CONFLICT, "This upload cannot be completed.");
    try {
      var object = storage.head(video.getSourceObjectKey());
      if (object.contentLength() != video.getDeclaredSizeBytes()) {
        storage.delete(video.getSourceObjectKey());
        throw new ApiProblem(HttpStatus.BAD_REQUEST, "The uploaded file size did not match the declared recording.");
      }
      String actualType = object.contentType() == null ? "" : object.contentType().split(";")[0].toLowerCase(Locale.ROOT);
      if (!CONTENT_TYPES.contains(actualType) || !actualType.equals(video.getDeclaredMimeType())) {
        storage.delete(video.getSourceObjectKey());
        throw new ApiProblem(HttpStatus.BAD_REQUEST, "The uploaded file type did not match the recording.");
      }
    } catch (S3Exception error) {
      if (error.statusCode() == 404) throw new ApiProblem(HttpStatus.CONFLICT, "The upload is incomplete. Retry the upload before completing it.");
      throw error;
    }
    video.markProcessing();
    jobs.findByVideoId(id).ifPresentOrElse(ProcessingJob::requeue, () -> jobs.save(new ProcessingJob(video)));
  }

  @Transactional
  public void retry(UUID id, Jwt jwt) {
    Video video = owned(id, jwt);
    if (video.getStatus() != Video.Status.FAILED) throw new ApiProblem(HttpStatus.CONFLICT, "Only failed processing jobs can be retried.");
    video.retry();
    ProcessingJob job = jobs.findByVideoId(id).orElseGet(() -> jobs.save(new ProcessingJob(video)));
    job.manualRetry();
  }

  @Transactional
  public void rename(UUID id, RenameRequest request, Jwt jwt) { owned(id, jwt).rename(request.title().trim()); }

  @Transactional
  public void delete(UUID id, Jwt jwt) {
    Video video = owned(id, jwt);
    storage.delete(video.getSourceObjectKey()); storage.delete(video.getPlaybackObjectKey()); storage.delete(video.getThumbnailObjectKey());
    videos.delete(video);
  }

  @Transactional
  public PlaybackResponse playback(UUID id, Jwt jwt) {
    Video video = owned(id, jwt);
    ensureReady(video);
    var signed = storage.playbackUrl(video.getPlaybackObjectKey());
    return new PlaybackResponse(signed.playbackUrl(), signed.expiresAt());
  }

  @Transactional
  public ShareResponse share(UUID id, Jwt jwt) {
    Video video = owned(id, jwt); ensureReady(video);
    byte[] bytes = new byte[32]; random.nextBytes(bytes);
    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    String hash = Hashing.sha256(token);
    shares.findByVideoId(id).ifPresentOrElse(link -> link.reactivate(hash), () -> shares.save(new ShareLink(video, hash)));
    video.shared();
    return new ShareResponse(properties.frontendUrl().replaceAll("/$", "") + "/s/" + token);
  }

  @Transactional
  public void revoke(UUID id, Jwt jwt) {
    Video video = owned(id, jwt);
    shares.findByVideoId(id).ifPresent(ShareLink::revoke); video.privateAgain();
  }

  @Transactional(readOnly = true)
  public SharedVideoResponse shared(String token) {
    Video video = sharedVideo(token); ensureReady(video);
    var signed = storage.playbackUrl(video.getPlaybackObjectKey());
    VideoResponse base = response(video);
    return new SharedVideoResponse(base.id(), base.title(), base.status(), base.visibility(), base.durationSeconds(),
        base.thumbnailUrl(), base.createdAt(), base.views(), base.creatorDisplayName(), signed.playbackUrl(), signed.expiresAt());
  }

  @Transactional
  public List<CommentResponse> comments(UUID id, String shareToken, Jwt jwt) {
    authorizedVideo(id, shareToken, jwt);
    return comments.findAllByVideoIdOrderByCreatedAt(id).stream().map(CommentResponse::from).toList();
  }

  @Transactional
  public CommentResponse comment(UUID id, String shareToken, CommentRequest request, Jwt jwt) {
    Video video = authorizedVideo(id, shareToken, jwt); ensureReady(video);
    if (video.getDurationSeconds() != null && request.timestampSeconds() > Math.ceil(video.getDurationSeconds()))
      throw new ApiProblem(HttpStatus.BAD_REQUEST, "Comment timestamp is outside the video.");
    AppUser author = jwt == null ? null : currentUsers.require(jwt);
    String guest = author == null ? requireGuestName(request.guestDisplayName()) : null;
    return CommentResponse.from(comments.save(new Comment(video, author, guest, request.message().trim(), request.timestampSeconds())));
  }

  @Transactional
  public ProgressResponse progress(UUID id, String shareToken, ProgressRequest request, Jwt jwt) {
    Video video = authorizedVideo(id, shareToken, jwt); ensureReady(video);
    double actualDuration = video.getDurationSeconds();
    if (Math.abs(request.durationSeconds() - actualDuration) > 2) throw new ApiProblem(HttpStatus.BAD_REQUEST, "Playback duration did not match this video.");
    String viewer = jwt != null ? "user:" + jwt.getSubject() : "guest:" + request.anonymousViewerId();
    String viewerHash = Hashing.sha256(viewer);
    ViewingSession session = request.sessionId() == null ? null : sessions.findById(request.sessionId()).orElse(null);
    if (session != null && (!session.getVideo().getId().equals(video.getId()) || !session.getViewerHash().equals(viewerHash))) session = null;
    if (session == null) session = new ViewingSession(video, viewerHash, jwt == null ? "SHARE" : "OWNER");
    boolean complete = "COMPLETE".equals(request.eventType());
    session.progress(request.positionSeconds(), actualDuration, complete);
    return new ProgressResponse(sessions.save(session).getId());
  }

  @Transactional
  public AnalyticsResponse analytics(UUID id, Jwt jwt) {
    Video video = owned(id, jwt);
    List<ViewingSession> values = sessions.findAllByVideoId(id);
    if (values.isEmpty()) return new AnalyticsResponse(0, 0, 0, 0, 0);
    double duration = Math.max(1, video.getDurationSeconds() == null ? 1 : video.getDurationSeconds());
    long unique = values.stream().map(ViewingSession::getViewerHash).distinct().count();
    double averagePercent = values.stream().mapToDouble(v -> Math.min(100, v.getMaxPositionSeconds() / duration * 100)).average().orElse(0);
    double completion = values.stream().filter(ViewingSession::isCompleted).count() * 100.0 / values.size();
    double watch = values.stream().mapToDouble(ViewingSession::getWatchTimeSeconds).average().orElse(0);
    return new AnalyticsResponse(values.size(), unique, averagePercent, completion, watch);
  }

  private VideoResponse response(Video video) {
    String thumbnail = video.getThumbnailObjectKey() == null ? null : storage.playbackUrl(video.getThumbnailObjectKey()).playbackUrl();
    return new VideoResponse(video.getId(), video.getTitle(), video.getStatus(), video.getVisibility(), video.getDurationSeconds(),
        thumbnail, video.getCreatedAt(), sessions.countByVideoId(video.getId()), video.getOwner().getDisplayName());
  }
  private Video owned(UUID id, Jwt jwt) {
    AppUser user = currentUsers.require(jwt);
    return videos.findByIdAndOwnerId(id, user.getId()).orElseThrow(() -> new ApiProblem(HttpStatus.NOT_FOUND, "This video could not be found."));
  }
  private Video authorizedVideo(UUID id, String token, Jwt jwt) {
    if (token != null && !token.isBlank()) {
      Video shared = sharedVideo(token);
      if (!shared.getId().equals(id)) throw new ApiProblem(HttpStatus.FORBIDDEN, "This share link does not grant access to that video.");
      return shared;
    }
    if (jwt == null) throw new ApiProblem(HttpStatus.UNAUTHORIZED, "Please sign in or use a valid share link.");
    return owned(id, jwt);
  }
  private Video sharedVideo(String token) {
    return shares.findByTokenHashAndRevokedAtIsNull(Hashing.sha256(token)).map(ShareLink::getVideo)
        .filter(video -> video.getVisibility() == Video.Visibility.UNLISTED)
        .orElseThrow(() -> new ApiProblem(HttpStatus.NOT_FOUND, "This share link is invalid or has been revoked."));
  }
  private void ensureReady(Video video) { if (video.getStatus() != Video.Status.READY) throw new ApiProblem(HttpStatus.CONFLICT, "This video is not ready yet."); }
  private String requireGuestName(String name) { if (name == null || name.isBlank()) throw new ApiProblem(HttpStatus.BAD_REQUEST, "Your name is required."); return name.trim(); }
  private String extension(String mime) { return switch (mime) { case "video/mp4" -> ".mp4"; case "video/quicktime" -> ".mov"; default -> ".webm"; }; }
}
