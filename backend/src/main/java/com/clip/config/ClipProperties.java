package com.clip.config;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("clip")
public record ClipProperties(
    Auth auth,
    Storage storage,
    Worker worker,
    Quotas quotas,
    String frontendUrl,
    List<String> allowedOrigins
) {
  public record Auth(String issuer, String jwkSetUri, List<String> authorizedParties) {}
  public record Storage(
      URI endpoint,
      URI presignEndpoint,
      String region,
      String bucket,
      String accessKey,
      String secretKey,
      Duration uploadExpiry,
      Duration playbackExpiry
  ) {}
  public record Worker(boolean enabled, String ffmpegPath, String ffprobePath, Duration timeout) {}
  public record Quotas(int maxVideos, long maxVideoBytes, long maxStorageBytes, long maxDurationSeconds) {}
}
