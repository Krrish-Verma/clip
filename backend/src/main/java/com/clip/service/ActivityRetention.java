package com.clip.service;
import com.clip.config.ClipProperties;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;

@Component
public class ActivityRetention {
  private final JdbcTemplate jdbc;private final ClipProperties properties;
  public ActivityRetention(JdbcTemplate jdbc,ClipProperties properties){this.jdbc=jdbc;this.properties=properties;}
  @Scheduled(fixedDelay=86400000,initialDelay=300000) public void clean(){
    if(properties.worker().enabled())jdbc.update("delete from notifications where (read_at is not null and created_at<now()-interval '90 days') or created_at<now()-interval '365 days'");
  }
}
