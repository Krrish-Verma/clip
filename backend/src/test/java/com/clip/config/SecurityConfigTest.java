package com.clip.config;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.clip.api.VideoController;
import com.clip.service.GuestRateLimiter;
import com.clip.service.VideoService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(VideoController.class)
@Import(SecurityConfig.class)
@org.springframework.test.context.TestPropertySource(properties = {
    "clip.auth.issuer=https://clerk.test",
    "clip.auth.jwk-set-uri=https://clerk.test/.well-known/jwks.json",
    "clip.auth.authorized-parties=http://127.0.0.1:3000",
    "clip.allowed-origins=http://127.0.0.1:3000"
})
class SecurityConfigTest {
  @Autowired MockMvc mvc;
  @MockitoBean VideoService videos;
  @MockitoBean GuestRateLimiter rateLimiter;
  @MockitoBean JwtDecoder jwtDecoder;

  @Test void rejectsProtectedRequestsWithoutAuthentication() throws Exception {
    mvc.perform(get("/api/videos")).andExpect(status().isUnauthorized());
  }

  @Test void acceptsTestOnlyJwtFixtureForProtectedRequests() throws Exception {
    mvc.perform(get("/api/videos").with(jwt().jwt(token -> token.subject("user_a").claim("azp", "http://127.0.0.1:3000"))))
        .andExpect(status().isOk());
  }
}
