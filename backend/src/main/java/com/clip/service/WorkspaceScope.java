package com.clip.service;
import java.util.Map;
import org.springframework.security.oauth2.jwt.Jwt;

public final class WorkspaceScope {
  private WorkspaceScope(){}
  public static String organization(Jwt jwt){
    if(jwt==null)return null;
    String id=jwt.getClaimAsString("org_id");
    if(id==null&&jwt.getClaims().get("o") instanceof Map<?,?> org && org.get("id") instanceof String value)id=value;
    return id==null||id.isBlank()?null:id;
  }
  public static boolean admin(Jwt jwt){
    if(jwt==null)return false;String role=jwt.getClaimAsString("org_role");
    if(role==null&&jwt.getClaims().get("o") instanceof Map<?,?> org&&org.get("rol") instanceof String value)role=value;
    return "org:admin".equals(role)||"admin".equals(role);
  }
  public static boolean same(String organization,Jwt jwt){return java.util.Objects.equals(organization,organization(jwt));}
}
