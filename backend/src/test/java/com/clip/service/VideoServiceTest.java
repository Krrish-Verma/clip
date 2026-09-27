package com.clip.service;

import static com.clip.api.ApiModels.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.clip.config.ApiExceptionHandler.ApiProblem;
import com.clip.config.ClipProperties;
import com.clip.domain.*;
import com.clip.repository.*;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;

@ExtendWith(MockitoExtension.class)
class VideoServiceTest {
  @Mock VideoRepository videos;
  @Mock ShareLinkRepository shares;
  @Mock CommentRepository comments;
  @Mock ProcessingJobRepository jobs;
  @Mock ViewingSessionRepository sessions;
  @Mock CurrentUserService currentUsers;
  @Mock StorageService storage;
  VideoService service;
  AppUser owner;
  Jwt jwt;

  @BeforeEach void setup() {
    ClipProperties properties = new ClipProperties(
        new ClipProperties.Auth("https://clerk.test", "https://clerk.test/jwks", List.of("http://localhost:3000")),
        new ClipProperties.Storage(URI.create("http://minio:9000"), URI.create("http://localhost:9000"), "us-east-1", "clip", "key", "secret", Duration.ofMinutes(15), Duration.ofMinutes(15)),
        new ClipProperties.Worker(false, "ffmpeg", "ffprobe", Duration.ofMinutes(15)),
        new ClipProperties.Quotas(5, 200 * 1024 * 1024L, 1024 * 1024 * 1024L, 600),
        "http://localhost:3000", List.of("http://localhost:3000"));
    service = new VideoService(videos, shares, comments, jobs, sessions, currentUsers, storage, properties);
    owner = new AppUser("user_a");
    jwt = Jwt.withTokenValue("fixture-only").header("alg", "none").subject("user_a").build();
    lenient().when(currentUsers.require(jwt)).thenReturn(owner);
  }

  @Test void enforcesOwnershipBoundary() {
    UUID id = UUID.randomUUID();
    when(videos.findByIdAndOwnerId(id, owner.getId())).thenReturn(Optional.empty());
    assertThatThrownBy(() -> service.getOwned(id, jwt)).isInstanceOf(ApiProblem.class)
        .extracting(error -> ((ApiProblem) error).status().value()).isEqualTo(404);
  }

  @Test void locksTheOwnerRowWhileCheckingUploadQuotas() {
    when(currentUsers.requireLocked(jwt)).thenReturn(owner);
    when(videos.save(any(Video.class))).thenAnswer(invocation -> invocation.getArgument(0));
    when(storage.uploadUrl(anyString(), eq("video/webm"), eq(42L))).thenReturn("https://storage.test/upload");

    CreateVideoResponse response = service.create(new CreateVideoRequest("Demo", "video/webm;codecs=vp9", 42), jwt);

    assertThat(response.uploadUrl()).isEqualTo("https://storage.test/upload");
    verify(currentUsers).requireLocked(jwt);
    verify(videos).countByOwnerId(owner.getId());
    verify(videos).totalDeclaredBytes(owner.getId());
  }

  @Test void refreshesAnUploadUrlOnlyWhileTheVideoIsUploading() {
    UUID id = UUID.randomUUID();
    Video video = new Video(owner, "Demo", "video/webm", 42, "users/a/source.webm");
    when(videos.findByIdAndOwnerId(id, owner.getId())).thenReturn(Optional.of(video));
    when(storage.uploadUrl("users/a/source.webm", "video/webm", 42)).thenReturn("https://storage.test/fresh");

    assertThat(service.refreshUploadUrl(id, jwt).uploadUrl()).isEqualTo("https://storage.test/fresh");

    video.markProcessing();
    assertThatThrownBy(() -> service.refreshUploadUrl(id, jwt)).isInstanceOf(ApiProblem.class)
        .extracting(error -> ((ApiProblem) error).status().value()).isEqualTo(409);
  }

  @Test void acceptsCompletedUploadOnlyAfterObjectVerification() {
    UUID id = UUID.randomUUID();
    Video video = new Video(owner, "Demo", "video/webm", 42, "users/a/source.webm");
    when(videos.findByIdAndOwnerId(id, owner.getId())).thenReturn(Optional.of(video));
    when(storage.head(video.getSourceObjectKey())).thenReturn(HeadObjectResponse.builder().contentLength(42L).contentType("video/webm").build());
    when(jobs.findByVideoId(id)).thenReturn(Optional.empty());

    service.complete(id, jwt);

    assertThat(video.getStatus()).isEqualTo(Video.Status.PROCESSING);
    verify(jobs).save(any(ProcessingJob.class));
  }

  @Test void rejectsAndDeletesMismatchedUpload() {
    UUID id = UUID.randomUUID();
    Video video = new Video(owner, "Demo", "video/webm", 42, "users/a/source.webm");
    when(videos.findByIdAndOwnerId(id, owner.getId())).thenReturn(Optional.of(video));
    when(storage.head(video.getSourceObjectKey())).thenReturn(HeadObjectResponse.builder().contentLength(41L).contentType("video/webm").build());

    assertThatThrownBy(() -> service.complete(id, jwt)).isInstanceOf(ApiProblem.class);
    verify(storage).delete(video.getSourceObjectKey());
    verifyNoInteractions(jobs);
  }

  @Test void revokesShareAndReturnsVideoToPrivate() {
    UUID id = UUID.randomUUID();
    Video video = new Video(owner, "Demo", "video/mp4", 42, "source");
    video.markReady(3, "playback", "thumbnail");
    ShareLink link = new ShareLink(video, Hashing.sha256("old"));
    when(videos.findByIdAndOwnerId(id, owner.getId())).thenReturn(Optional.of(video));
    when(shares.findByVideoId(id)).thenReturn(Optional.of(link));

    service.revoke(id, jwt);

    assertThat(link.getRevokedAt()).isNotNull();
    assertThat(video.getVisibility()).isEqualTo(Video.Visibility.PRIVATE);
  }

  @Test void deletionRemovesEveryStoredObjectAndDatabaseRecord() {
    UUID id = UUID.randomUUID();
    Video video = new Video(owner, "Demo", "video/mp4", 42, "source");
    video.markReady(3, "playback", "thumbnail");
    when(videos.findByIdAndOwnerId(id, owner.getId())).thenReturn(Optional.of(video));

    service.delete(id, jwt);

    verify(storage).delete("source"); verify(storage).delete("playback"); verify(storage).delete("thumbnail");
    verify(videos).delete(video);
  }

  @Test void doesNotLetAProgressSessionCrossVideoBoundaries() {
    UUID firstId = UUID.randomUUID();
    UUID secondId = UUID.randomUUID();
    Video first = new Video(owner, "First", "video/mp4", 42, "first-source");
    Video second = new Video(owner, "Second", "video/mp4", 42, "second-source");
    ReflectionTestUtils.setField(first, "id", firstId);
    ReflectionTestUtils.setField(second, "id", secondId);
    first.markReady(10, "first-playback", "first-thumbnail");
    second.markReady(10, "second-playback", "second-thumbnail");
    ViewingSession stolen = new ViewingSession(first, Hashing.sha256("user:user_a"), "OWNER");
    UUID stolenId = UUID.randomUUID();
    ReflectionTestUtils.setField(stolen, "id", stolenId);
    when(videos.findByIdAndOwnerId(secondId, owner.getId())).thenReturn(Optional.of(second));
    when(sessions.findById(stolenId)).thenReturn(Optional.of(stolen));
    when(sessions.save(any(ViewingSession.class))).thenAnswer(invocation -> {
      ViewingSession value = invocation.getArgument(0);
      ReflectionTestUtils.setField(value, "id", UUID.randomUUID());
      return value;
    });

    ProgressResponse response = service.progress(secondId, null,
        new ProgressRequest(stolenId, "ignored-for-owner", 3, 10, "PROGRESS"), jwt);

    assertThat(response.sessionId()).isNotEqualTo(stolenId);
    assertThat(stolen.getMaxPositionSeconds()).isZero();
  }
}
