package com.clip.api;

import static com.clip.api.ApiModels.*;
import com.clip.service.CurrentUserService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
public class UserController {
  private final CurrentUserService users;
  public UserController(CurrentUserService users) { this.users = users; }
  @PutMapping("/me")
  UserResponse update(@Valid @RequestBody ProfileRequest request, @AuthenticationPrincipal Jwt jwt) {
    var user = users.update(jwt, request.email(), request.displayName().trim());
    return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName());
  }
}
