package com.clip.service;

import com.clip.domain.ShareLink;
import com.clip.config.ApiExceptionHandler.ApiProblem;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

public final class ShareAccess {
  private ShareAccess(){}
  private static final BCryptPasswordEncoder passwords=new BCryptPasswordEncoder(10);
  private static final GuestRateLimiter limiter=new GuestRateLimiter();
  public static String hash(String password){return password==null||password.isBlank()?null:passwords.encode(password);}
  public static void require(ShareLink link){
    if(link.getExpiresAt()!=null&&!link.getExpiresAt().isAfter(java.time.Instant.now()))throw new ApiProblem(HttpStatus.NOT_FOUND,"This share link has expired.");
    if(link.getPasswordHash()==null)return;
    var attrs=RequestContextHolder.getRequestAttributes();
    var request=attrs instanceof ServletRequestAttributes servlet?servlet.getRequest():null;
    String password=request==null?null:request.getHeader("X-Clip-Share-Password");
    if(password!=null&&password.startsWith("b64:"))try{password=new String(java.util.Base64.getDecoder().decode(password.substring(4)),java.nio.charset.StandardCharsets.UTF_8);}catch(IllegalArgumentException e){password=null;}
    if(password!=null){
      limiter.check("share-password",(request==null?"unknown":request.getRemoteAddr())+link.getTokenHash(),10);
      if(password.length()<=72&&passwords.matches(password,link.getPasswordHash()))return;
    }
    throw new ApiProblem(HttpStatus.FORBIDDEN,"This share link requires a password.");
  }
}
