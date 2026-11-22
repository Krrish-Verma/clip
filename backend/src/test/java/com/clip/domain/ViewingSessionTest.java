package com.clip.domain;
import static org.assertj.core.api.Assertions.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.Instant;

class ViewingSessionTest {
  ViewingSession session(){return new ViewingSession(new Video(new AppUser("owner"),"Demo","video/mp4",42,"source"),"hash","SHARE");}
  @Test void seekingToTheEndDoesNotCountAsWatchingOrCompletion(){var s=session();s.progress(95,100,true);assertThat(s.getWatchTimeSeconds()).isZero();assertThat(s.isCompleted()).isFalse();}
  @Test void rewatchingTheSameRangeDoesNotInflateCoverage(){
    var s=session();ReflectionTestUtils.setField(s,"lastEventAt",Instant.now().minusSeconds(10));s.progress(10,100,false);s.progress(0,100,false);ReflectionTestUtils.setField(s,"lastEventAt",Instant.now().minusSeconds(10));s.progress(10,100,false);
    assertThat(s.getWatchTimeSeconds()).isEqualTo(10);assertThat(s.watchedPercentage(100)).isEqualTo(10);
  }
}
