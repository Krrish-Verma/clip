package com.clip.api;
import com.clip.service.MultipartService;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/videos/{id}/multipart")
public class MultipartController {
  private final MultipartService uploads;
  public MultipartController(MultipartService uploads){this.uploads=uploads;}
  @PostMapping MultipartService.UploadSession begin(@PathVariable UUID id,@AuthenticationPrincipal Jwt jwt){return uploads.begin(id,jwt);}
  @PostMapping("/complete") @ResponseStatus(HttpStatus.NO_CONTENT)
  void complete(@PathVariable UUID id,@AuthenticationPrincipal Jwt jwt){uploads.complete(id,jwt);}
}
