package com.clip.api;

import static com.clip.service.WorkspaceService.*;
import com.clip.service.WorkspaceService;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class WorkspaceController {
  private final WorkspaceService workspace;
  public WorkspaceController(WorkspaceService workspace) { this.workspace=workspace; }
  @GetMapping("/folders") List<FolderResponse> folders(@AuthenticationPrincipal Jwt jwt) { return workspace.folders(jwt); }
  @PostMapping("/folders") @ResponseStatus(HttpStatus.CREATED)
  FolderResponse folder(@Valid @RequestBody FolderRequest request,@AuthenticationPrincipal Jwt jwt) { return workspace.folder(request,jwt); }
  @DeleteMapping("/folders/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
  void deleteFolder(@PathVariable UUID id,@AuthenticationPrincipal Jwt jwt) { workspace.deleteFolder(id,jwt); }
  @PatchMapping("/videos/{id}/organization") @ResponseStatus(HttpStatus.NO_CONTENT)
  void organize(@PathVariable UUID id,@RequestBody OrganizeRequest request,@AuthenticationPrincipal Jwt jwt) { workspace.organize(id,request,jwt); }
  @GetMapping("/videos/{id}/participants")
  List<Participant> participants(@PathVariable UUID id,@RequestParam(required=false) String shareToken,@AuthenticationPrincipal Jwt jwt) { return workspace.participants(id,shareToken,jwt); }
  @PatchMapping("/videos/{id}/comments/{commentId}") @ResponseStatus(HttpStatus.NO_CONTENT)
  void edit(@PathVariable UUID id,@PathVariable UUID commentId,@RequestParam(required=false) String shareToken,@Valid @RequestBody EditCommentRequest request,@AuthenticationPrincipal Jwt jwt) { workspace.editSharedComment(id,commentId,shareToken,request,jwt); }
  @DeleteMapping("/videos/{id}/comments/{commentId}") @ResponseStatus(HttpStatus.NO_CONTENT)
  void delete(@PathVariable UUID id,@PathVariable UUID commentId,@RequestParam(required=false) String shareToken,@AuthenticationPrincipal Jwt jwt) { workspace.deleteComment(id,commentId,shareToken,jwt); }
  @PatchMapping("/videos/{id}/comments/{commentId}/resolution") @ResponseStatus(HttpStatus.NO_CONTENT)
  void resolve(@PathVariable UUID id,@PathVariable UUID commentId,@RequestBody ResolveRequest request,@AuthenticationPrincipal Jwt jwt) { workspace.resolve(id,commentId,request.resolved(),jwt); }
  @GetMapping("/videos/{id}/reactions") List<ReactionResponse> reactions(@PathVariable UUID id,@RequestParam(required=false) String shareToken,@AuthenticationPrincipal Jwt jwt) { return workspace.reactions(id,shareToken,jwt); }
  @PostMapping("/videos/{id}/reactions") @ResponseStatus(HttpStatus.NO_CONTENT)
  void react(@PathVariable UUID id,@RequestParam(required=false) String shareToken,@Valid @RequestBody ReactionRequest request,@AuthenticationPrincipal Jwt jwt) { workspace.react(id,shareToken,request,jwt); }
  @GetMapping("/notifications") List<NotificationResponse> notifications(@AuthenticationPrincipal Jwt jwt) { return workspace.notifications(jwt); }
  @PostMapping("/notifications/read") @ResponseStatus(HttpStatus.NO_CONTENT)
  void read(@AuthenticationPrincipal Jwt jwt) { workspace.markRead(jwt); }
}
