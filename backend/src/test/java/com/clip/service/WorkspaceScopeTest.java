package com.clip.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class WorkspaceScopeTest {
  private Jwt flat(String role) {
    return Jwt.withTokenValue("test-only")
        .header("alg", "none")
        .subject("user")
        .claim("org_id", "org_flat")
        .claim("org_role", role)
        .build();
  }

  private Jwt nested(String role) {
    return Jwt.withTokenValue("test-only")
        .header("alg", "none")
        .subject("user")
        .claim("o", Map.of("id", "org_nested", "rol", role))
        .build();
  }

  @Test
  void readsCurrentAndLegacyOrganizationClaims() {
    assertThat(WorkspaceScope.organization(flat("org:member"))).isEqualTo("org_flat");
    assertThat(WorkspaceScope.organization(nested("member"))).isEqualTo("org_nested");
    assertThat(WorkspaceScope.organization(null)).isNull();
  }

  @Test
  void grantsAdminOnlyForSupportedAdminRoles() {
    assertThat(WorkspaceScope.admin(flat("org:admin"))).isTrue();
    assertThat(WorkspaceScope.admin(nested("admin"))).isTrue();
    assertThat(WorkspaceScope.admin(flat("org:member"))).isFalse();
    assertThat(WorkspaceScope.same("org_nested", nested("member"))).isTrue();
    assertThat(WorkspaceScope.same(null, flat("org:member"))).isFalse();
  }
}
