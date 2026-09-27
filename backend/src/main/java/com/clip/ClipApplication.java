package com.clip;

import com.clip.config.ClipProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(ClipProperties.class)
public class ClipApplication {
  public static void main(String[] args) {
    SpringApplication.run(ClipApplication.class, args);
  }
}
