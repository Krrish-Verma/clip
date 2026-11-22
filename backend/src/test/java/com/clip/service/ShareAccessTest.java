package com.clip.service;
import static org.assertj.core.api.Assertions.*;
import com.clip.domain.*;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterEach;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.*;

class ShareAccessTest {
  @AfterEach void clean(){RequestContextHolder.resetRequestAttributes();}
  @Test void passwordIsHashedAndCheckedOnEverySharedApiRequest(){
    ShareLink link=new ShareLink(new Video(new AppUser("owner"),"Demo","video/mp4",42,"source"),"a".repeat(64));
    String hash=ShareAccess.hash("a strong password");link.policy(hash,null);
    assertThat(hash).doesNotContain("a strong password");
    assertThatThrownBy(()->ShareAccess.require(link)).hasMessageContaining("requires a password");
    var request=new MockHttpServletRequest();request.addHeader("X-Clip-Share-Password","wrong password");RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    assertThatThrownBy(()->ShareAccess.require(link)).hasMessageContaining("requires a password");
    request.removeHeader("X-Clip-Share-Password");request.addHeader("X-Clip-Share-Password","a strong password");ShareAccess.require(link);
  }
  @Test void expiredLinksFailEvenWithAnOtherwiseValidPassword(){
    ShareLink link=new ShareLink(new Video(new AppUser("owner"),"Demo","video/mp4",42,"source"),"b".repeat(64));link.policy(null,Instant.now().minusSeconds(1));
    assertThatThrownBy(()->ShareAccess.require(link)).hasMessageContaining("expired");
  }
}
