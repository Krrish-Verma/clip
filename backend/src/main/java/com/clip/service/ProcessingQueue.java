package com.clip.service;

import com.clip.domain.ProcessingJob;
import com.clip.domain.Video;
import com.clip.repository.ProcessingJobRepository;
import com.clip.repository.VideoRepository;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProcessingQueue {
  private final ProcessingJobRepository jobs;
  private final VideoRepository videos;
  public ProcessingQueue(ProcessingJobRepository jobs, VideoRepository videos) { this.jobs = jobs; this.videos = videos; }

  @Transactional
  public Optional<ClaimedJob> claim(String workerId) {
    return jobs.findNextForUpdate().map(job -> {
      job.claim(workerId);
      Video video = job.getVideo();
      return new ClaimedJob(job.getId(), video.getId(), video.getSourceObjectKey(), job.getAttempts());
    });
  }

  @Transactional
  public void succeed(UUID jobId, double duration, String playbackKey, String thumbnailKey) {
    ProcessingJob job = jobs.findById(jobId).orElseThrow();
    job.getVideo().markReady(duration, playbackKey, thumbnailKey);
    job.succeed();
  }

  @Transactional
  public void fail(UUID jobId, String reason) {
    ProcessingJob job = jobs.findById(jobId).orElseThrow();
    job.retryOrFail(reason, 3);
    if (job.getState() == ProcessingJob.State.FAILED) job.getVideo().markFailed("Processing failed after three attempts.");
  }

  @Transactional
  public void recoverStale() {
    jobs.findByStateAndLockedAtBefore(ProcessingJob.State.RUNNING, Instant.now().minusSeconds(900))
        .forEach(ProcessingJob::requeue);
  }

  public record ClaimedJob(UUID jobId, UUID videoId, String sourceKey, int attempt) {}
}
