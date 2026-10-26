package com.clip.api;

import static com.clip.api.ApiModels.*;
import com.clip.service.GuestRateLimiter;
import com.clip.service.VideoService;
import com.clip.service.WorkspaceService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class VideoController {
  private final VideoService videos;
  private final GuestRateLimiter rateLimiter;
  private final WorkspaceService workspace;
  public VideoController(VideoService videos, GuestRateLimiter rateLimiter, WorkspaceService workspace) { this.videos = videos; this.rateLimiter = rateLimiter; this.workspace=workspace; }

  @GetMapping("/videos") List<VideoResponse> list(@AuthenticationPrincipal Jwt jwt) { return videos.list(jwt); }
  @PostMapping("/videos") @ResponseStatus(HttpStatus.CREATED)
  CreateVideoResponse create(@Valid @RequestBody CreateVideoRequest request, @AuthenticationPrincipal Jwt jwt) { return videos.create(request, jwt); }
  @PostMapping("/videos/{id}/upload-url")
  UploadUrlResponse refreshUploadUrl(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) { return videos.refreshUploadUrl(id, jwt); }
  @GetMapping("/videos/{id}") VideoResponse get(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) { return videos.getOwned(id, jwt); }
  @PostMapping("/videos/{id}/complete") @ResponseStatus(HttpStatus.NO_CONTENT)
  void complete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) { videos.complete(id, jwt); }
  @PostMapping("/videos/{id}/retry") @ResponseStatus(HttpStatus.NO_CONTENT)
  void retry(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) { videos.retry(id, jwt); }
  @PatchMapping("/videos/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
  void rename(@PathVariable UUID id, @Valid @RequestBody RenameRequest request, @AuthenticationPrincipal Jwt jwt) { videos.rename(id, request, jwt); }
  @DeleteMapping("/videos/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
  void delete(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) { videos.delete(id, jwt); }
  @GetMapping("/videos/{id}/playback") PlaybackResponse playback(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) { return videos.playback(id, jwt); }
  @PostMapping("/videos/{id}/share") ShareResponse share(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) { return videos.share(id, jwt); }
  @DeleteMapping("/videos/{id}/share") @ResponseStatus(HttpStatus.NO_CONTENT)
  void revoke(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) { videos.revoke(id, jwt); }
  @GetMapping("/shares/{token}") SharedVideoResponse shared(@PathVariable String token) { return videos.shared(token); }

  @GetMapping("/videos/{id}/comments")
  List<CommentResponse> comments(@PathVariable UUID id, @RequestParam(required=false) String shareToken, @AuthenticationPrincipal Jwt jwt) {
    return videos.comments(id, shareToken, jwt);
  }
  @PostMapping("/videos/{id}/comments") @ResponseStatus(HttpStatus.CREATED)
  CommentResponse comment(@PathVariable UUID id, @RequestParam(required=false) String shareToken,
      @Valid @RequestBody CommentRequest request, @AuthenticationPrincipal Jwt jwt, HttpServletRequest servletRequest) {
    if (jwt == null) rateLimiter.check("comment", clientAddress(servletRequest), 10);
    return workspace.comment(id, shareToken, request, jwt);
  }
  @PostMapping("/videos/{id}/analytics/progress")
  ProgressResponse progress(@PathVariable UUID id, @RequestParam(required=false) String shareToken,
      @Valid @RequestBody ProgressRequest request, @AuthenticationPrincipal Jwt jwt, HttpServletRequest servletRequest) {
    if (jwt == null) rateLimiter.check("analytics", clientAddress(servletRequest), 60);
    return videos.progress(id, shareToken, request, jwt);
  }
  @GetMapping("/videos/{id}/analytics") AnalyticsResponse analytics(@PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) { return videos.analytics(id, jwt); }

  private String clientAddress(HttpServletRequest request) {
    return request.getRemoteAddr();
  }
}
