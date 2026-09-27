package com.clip.config;

import java.util.Collection;
import java.util.List;
import java.util.Objects;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {
  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    return http
        .csrf(csrf -> csrf.disable())
        .cors(Customizer.withDefaults())
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/shares/**").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/videos/*/comments").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/videos/*/comments", "/api/videos/*/analytics/progress").permitAll()
            .anyRequest().authenticated())
        .oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()))
        .build();
  }

  @Bean
  NimbusJwtDecoder jwtDecoder(ClipProperties properties) {
    var auth = properties.auth();
    if (auth.issuer() == null || auth.issuer().isBlank()) {
      throw new IllegalStateException("CLERK_ISSUER is required; the API never starts with authentication disabled.");
    }
    NimbusJwtDecoder decoder = auth.jwkSetUri() == null || auth.jwkSetUri().isBlank()
        ? (NimbusJwtDecoder) JwtDecoders.fromIssuerLocation(auth.issuer())
        : NimbusJwtDecoder.withJwkSetUri(auth.jwkSetUri()).build();
    OAuth2TokenValidator<Jwt> defaults = JwtValidators.createDefaultWithIssuer(auth.issuer());
    OAuth2TokenValidator<Jwt> authorizedParty = token -> {
      List<String> allowed = auth.authorizedParties() == null ? List.of() : auth.authorizedParties();
      String azp = token.getClaimAsString("azp");
      if (azp == null || allowed.contains(azp)) return OAuth2TokenValidatorResult.success();
      return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Token authorized party is not allowed", null));
    };
    decoder.setJwtValidator(token -> {
      var first = defaults.validate(token);
      if (first.hasErrors()) return first;
      return authorizedParty.validate(token);
    });
    return decoder;
  }

  @Bean
  CorsConfigurationSource corsConfigurationSource(ClipProperties properties) {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(properties.allowedOrigins());
    config.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
    config.setExposedHeaders(List.of("Location"));
    config.setAllowCredentials(false);
    config.setMaxAge(3600L);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
  }
}
