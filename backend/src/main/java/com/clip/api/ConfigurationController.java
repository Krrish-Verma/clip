package com.clip.api;
import com.clip.config.ClipProperties;
import org.springframework.web.bind.annotation.*;
@RestController
public class ConfigurationController {
  private final ClipProperties properties;
  public ConfigurationController(ClipProperties properties){this.properties=properties;}
  @GetMapping("/api/config") public ClipProperties.Quotas quotas(){return properties.quotas();}
}
