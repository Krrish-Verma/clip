package com.clip.api;
import com.clip.service.StudioService;
import com.clip.service.TranscriptService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/videos/{id}/studio")
public class StudioController {
  private final StudioService studio;
  private final TranscriptService transcripts;
  public StudioController(StudioService studio,TranscriptService transcripts){this.studio=studio;this.transcripts=transcripts;}
  @PostMapping("/transcribe") @ResponseStatus(HttpStatus.ACCEPTED)
  void transcribe(@PathVariable UUID id,@AuthenticationPrincipal Jwt jwt){transcripts.request(id,jwt);}
  @PatchMapping("/transcript") @ResponseStatus(HttpStatus.NO_CONTENT)
  void transcript(@PathVariable UUID id,@Valid @RequestBody TranscriptService.EditRequest request,@AuthenticationPrincipal Jwt jwt){transcripts.edit(id,request,jwt);}
  @GetMapping StudioService.Details details(@PathVariable UUID id,@RequestParam(required=false) String shareToken,@AuthenticationPrincipal Jwt jwt){return studio.details(id,shareToken,jwt);}
  @GetMapping("/revisions") java.util.List<StudioService.Revision> revisions(@PathVariable UUID id,@RequestParam(required=false) String shareToken,@AuthenticationPrincipal Jwt jwt){return studio.revisions(id,shareToken,jwt);}
  @PostMapping("/edits") @ResponseStatus(HttpStatus.ACCEPTED)
  void edit(@PathVariable UUID id,@Valid @RequestBody StudioService.EditRequest request,@AuthenticationPrincipal Jwt jwt){studio.edit(id,request,jwt);}
  @PatchMapping @ResponseStatus(HttpStatus.NO_CONTENT)
  void metadata(@PathVariable UUID id,@Valid @RequestBody StudioService.DetailsRequest request,@AuthenticationPrincipal Jwt jwt){studio.metadata(id,request,jwt);}
}
