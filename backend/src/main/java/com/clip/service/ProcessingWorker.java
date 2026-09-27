package com.clip.service;

import com.clip.config.ClipProperties;
import java.net.InetAddress;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ProcessingWorker {
  private static final Logger log = LoggerFactory.getLogger(ProcessingWorker.class);
  private final ProcessingQueue queue;
  private final MediaProcessor processor;
  private final StorageService storage;
  private final ClipProperties properties;
  private final String workerId = UUID.randomUUID().toString();
  public ProcessingWorker(ProcessingQueue queue, MediaProcessor processor, StorageService storage, ClipProperties properties) {
    this.queue=queue; this.processor=processor; this.storage=storage; this.properties=properties;
  }
  @Scheduled(fixedDelayString = "${clip.worker.poll-delay:2000}")
  public void poll() {
    if (!properties.worker().enabled()) return;
    queue.claim(workerId).ifPresent(job -> {
      MediaProcessor.Result result = null;
      try {
        result = processor.process(job);
        queue.succeed(job.jobId(), result.duration(), result.playbackKey(), result.thumbnailKey());
      } catch (Exception error) {
        log.warn("Processing job {} attempt {} failed: {}", job.jobId(), job.attempt(), error.getMessage());
        if (result != null) {
          storage.delete(result.playbackKey());
          storage.delete(result.thumbnailKey());
        }
        try { queue.fail(job.jobId(), error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage()); }
        catch (Exception missingJob) { log.info("Processing job {} was deleted while it was running", job.jobId()); }
      }
    });
  }
  @Scheduled(fixedDelay = 300_000, initialDelay = 30_000)
  public void recover() { if (properties.worker().enabled()) queue.recoverStale(); }
}
