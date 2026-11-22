package com.clip.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class VideoRevisionTest {
  @Test
  void failedEditRetriesReuseTheUnpublishedRevision() {
    Video video=new Video(new AppUser("revision-owner"),"Demo","video/mp4",42,"source");

    video.planEdit("first plan");
    assertThat(video.getMediaRevision()).isEqualTo(1);

    video.planEdit("retry plan");
    assertThat(video.getMediaRevision()).isEqualTo(1);

    video.markReady(4,"playback","thumbnail");
    video.planEdit("next published edit");
    assertThat(video.getPublishedRevision()).isEqualTo(1);
    assertThat(video.getMediaRevision()).isEqualTo(2);
  }
}
