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
  private final org.springframework.jdbc.core.JdbcTemplate jdbc;
  public ProcessingQueue(ProcessingJobRepository jobs, VideoRepository videos,org.springframework.jdbc.core.JdbcTemplate jdbc) { this.jobs = jobs; this.videos = videos;this.jdbc=jdbc; }

  @Transactional
  public Optional<ClaimedJob> claim(String workerId) {
    return jobs.findNextForUpdate().map(job -> {
      job.claim(workerId);
      Video video = job.getVideo();
      return new ClaimedJob(job.getId(), video.getId(), video.getSourceObjectKey(), job.getAttempts(),video.getEditPlan(),video.getMediaRevision());
    });
  }

  @Transactional
  public void succeed(UUID jobId, double duration, String playbackKey, String thumbnailKey) {
    ProcessingJob job = jobs.findLockedById(jobId).orElseThrow();
    Video video=job.getVideo();
    boolean publishesNewRevision=video.getMediaRevision()!=video.getPublishedRevision();
    jdbc.update("insert into media_versions(video_id,revision,duration_seconds,playback_key,thumbnail_key) values(?,?,?,?,?) on conflict(video_id,revision) do nothing",video.getId(),video.getMediaRevision(),duration,playbackKey,thumbnailKey);
    video.markReady(duration, playbackKey, thumbnailKey);
    if(publishesNewRevision)jdbc.update("update videos set transcript_status='NOT_STARTED',transcript_json=null,transcript_error=null where id=?",video.getId());
    job.succeed();
  }

  @Transactional
  public void fail(UUID jobId, String reason) {
    ProcessingJob job = jobs.findLockedById(jobId).orElseThrow();
    job.retryOrFail(reason, 3);
    if (job.getState() == ProcessingJob.State.FAILED && job.getVideo().getPlaybackObjectKey()==null) job.getVideo().markFailed("Processing failed after three attempts.");
  }
  @Transactional public void succeed(ClaimedJob claimed,double duration,String playbackKey,String thumbnailKey){
    ProcessingJob job=jobs.findLockedById(claimed.jobId()).orElseThrow();
    if(job.getState()!=ProcessingJob.State.RUNNING||job.getAttempts()!=claimed.attempt()||job.getVideo().getMediaRevision()!=claimed.revision())throw new IllegalStateException("An obsolete media attempt cannot publish.");
    succeed(claimed.jobId(),duration,playbackKey,thumbnailKey);
  }
  @Transactional public void fail(ClaimedJob claimed,String reason){
    jobs.findLockedById(claimed.jobId()).filter(job->job.getState()==ProcessingJob.State.RUNNING&&job.getAttempts()==claimed.attempt()&&job.getVideo().getMediaRevision()==claimed.revision()).ifPresent(job->fail(claimed.jobId(),reason));
  }

  @Transactional
  public void recoverStale() {
    jobs.findByStateAndLockedAtBefore(ProcessingJob.State.RUNNING, Instant.now().minusSeconds(900))
        .forEach(ProcessingJob::requeue);
  }

  public record ClaimedJob(UUID jobId, UUID videoId, String sourceKey, int attempt,String editPlan,int revision) {
    public ClaimedJob(UUID jobId,UUID videoId,String sourceKey,int attempt){this(jobId,videoId,sourceKey,attempt,null,0);}
  }
}
