package com.clip.service;

import com.clip.config.ClipProperties;
import com.clip.domain.Video;
import com.clip.repository.VideoRepository;
import java.time.Instant;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class UploadCleanup {
  private final VideoRepository videos;
  private final StorageService storage;
  private final ClipProperties properties;
  public UploadCleanup(VideoRepository videos, StorageService storage, ClipProperties properties) { this.videos=videos; this.storage=storage; this.properties=properties; }
  @Scheduled(fixedDelay = 3_600_000, initialDelay = 60_000)
  @Transactional
  public void clean() {
    if (!properties.worker().enabled()) return;
    videos.findByStatusAndCreatedAtBefore(Video.Status.UPLOADING, Instant.now().minusSeconds(86_400)).forEach(video -> {
      storage.delete(video.getSourceObjectKey()); videos.delete(video);
    });
  }
}
