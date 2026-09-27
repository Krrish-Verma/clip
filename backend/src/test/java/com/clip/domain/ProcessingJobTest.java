package com.clip.domain;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

class ProcessingJobTest {
  @Test void retriesTwiceThenFailsDurably() {
    ProcessingJob job = new ProcessingJob(new Video(new AppUser("user"), "Demo", "video/webm", 10, "source"));
    job.claim("worker"); job.retryOrFail("first", 3);
    assertThat(job.getState()).isEqualTo(ProcessingJob.State.QUEUED);
    job.claim("worker"); job.retryOrFail("second", 3);
    assertThat(job.getState()).isEqualTo(ProcessingJob.State.QUEUED);
    job.claim("worker"); job.retryOrFail("third", 3);
    assertThat(job.getState()).isEqualTo(ProcessingJob.State.FAILED);
    assertThat(job.getAttempts()).isEqualTo(3);
  }

  @Test void ownerRetryRestoresTheAttemptBudget() {
    ProcessingJob job = new ProcessingJob(new Video(new AppUser("user"), "Demo", "video/webm", 10, "source"));
    job.claim("worker"); job.retryOrFail("first", 1);
    assertThat(job.getState()).isEqualTo(ProcessingJob.State.FAILED);
    job.manualRetry();
    assertThat(job.getState()).isEqualTo(ProcessingJob.State.QUEUED);
    assertThat(job.getAttempts()).isZero();
  }
}
