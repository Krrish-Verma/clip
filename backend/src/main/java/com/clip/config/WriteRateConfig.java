package com.clip.config;
import com.clip.service.GuestRateLimiter;
import jakarta.servlet.http.*;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class WriteRateConfig implements WebMvcConfigurer {
  private final GuestRateLimiter limiter;
  public WriteRateConfig(GuestRateLimiter limiter){this.limiter=limiter;}
  @Override public void addInterceptors(InterceptorRegistry registry){
    registry.addInterceptor(new HandlerInterceptor(){
      @Override public boolean preHandle(HttpServletRequest request,HttpServletResponse response,Object handler){
        if(java.util.Set.of("POST","PUT","PATCH","DELETE").contains(request.getMethod())&&SecurityContextHolder.getContext().getAuthentication() instanceof JwtAuthenticationToken auth)
          limiter.check("signed-write",auth.getToken().getSubject(),90);
        return true;
      }
    }).addPathPatterns("/api/**");
  }
}
