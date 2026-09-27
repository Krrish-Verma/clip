package com.clip.service;

import com.clip.domain.AppUser;
import com.clip.repository.AppUserRepository;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CurrentUserService {
  private final AppUserRepository users;
  public CurrentUserService(AppUserRepository users) { this.users = users; }
  @Transactional
  public AppUser require(Jwt jwt) {
    return users.findByClerkUserId(jwt.getSubject()).orElseGet(() -> users.save(new AppUser(jwt.getSubject())));
  }
  @Transactional
  public AppUser update(Jwt jwt, String email, String displayName) {
    AppUser user = require(jwt);
    user.updateProfile(email, displayName);
    return user;
  }
}
