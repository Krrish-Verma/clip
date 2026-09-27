package com.clip.integration;

import static org.assertj.core.api.Assertions.assertThat;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
    "clip.auth.issuer=https://clerk.test",
    "clip.auth.jwk-set-uri=https://clerk.test/.well-known/jwks.json",
    "clip.auth.authorized-parties=http://localhost:3000",
    "clip.storage.endpoint=http://localhost:9000",
    "clip.storage.presign-endpoint=http://localhost:9000",
    "clip.storage.region=us-east-1",
    "clip.storage.bucket=clip",
    "clip.storage.access-key=test",
    "clip.storage.secret-key=test",
    "clip.worker.enabled=false"
})
class PostgresMigrationTest {
  @Container static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:17-alpine");
  @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
  }
  @Autowired JdbcTemplate jdbc;

  @Test void flywayCreatesTheDurableWorkflowSchema() {
    List<String> tables = jdbc.queryForList(
        "select table_name from information_schema.tables where table_schema='public'", String.class);
    assertThat(tables).contains("app_users", "videos", "share_links", "comments", "processing_jobs", "viewing_sessions");
    Integer migrations = jdbc.queryForObject("select count(*) from flyway_schema_history where success", Integer.class);
    assertThat(migrations).isEqualTo(1);
  }
}
