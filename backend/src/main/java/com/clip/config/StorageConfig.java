package com.clip.config;

import java.net.URI;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;

@Configuration
public class StorageConfig {
  private StaticCredentialsProvider credentials(ClipProperties properties) {
    return StaticCredentialsProvider.create(AwsBasicCredentials.create(
        properties.storage().accessKey(), properties.storage().secretKey()));
  }

  @Bean
  S3Client s3Client(ClipProperties properties) {
    return S3Client.builder()
        .endpointOverride(properties.storage().endpoint())
        .httpClientBuilder(UrlConnectionHttpClient.builder())
        .credentialsProvider(credentials(properties))
        .region(Region.of(properties.storage().region()))
        .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
        .build();
  }

  @Bean
  S3Presigner s3Presigner(ClipProperties properties) {
    return S3Presigner.builder()
        .endpointOverride(properties.storage().presignEndpoint())
        .credentialsProvider(credentials(properties))
        .region(Region.of(properties.storage().region()))
        .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
        .build();
  }
}
