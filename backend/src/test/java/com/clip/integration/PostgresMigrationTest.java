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
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.oauth2.jwt.Jwt;
import com.clip.service.WorkspaceService;
import com.clip.service.CurrentUserService;
import com.clip.domain.AppUser;
import com.clip.repository.CommentRepository;
import com.clip.api.ApiModels.CommentRequest;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
  @Autowired WorkspaceService workspace;
  @Autowired CurrentUserService users;
  @Autowired CommentRepository comments;

  private Jwt token(String subject) { return Jwt.withTokenValue("test-only").header("alg","none").subject(subject).build(); }
  private UUID video(AppUser owner) {
    UUID id=UUID.randomUUID();
    jdbc.update("insert into videos(id,owner_id,title,status,declared_mime_type,declared_size_bytes,source_object_key,duration_seconds) values(?,?,?,'READY','video/mp4',42,?,10)",id,owner.getId(),"Test clip",id.toString());
    return id;
  }
  private String share(UUID video) {
    String token=UUID.randomUUID().toString();
    jdbc.update("update videos set visibility='UNLISTED' where id=?",video);
    jdbc.update("insert into share_links(id,video_id,token_hash) values(?,?,?)",UUID.randomUUID(),video,com.clip.service.Hashing.sha256(token));
    return token;
  }

  @Test @Transactional void foldersStayPrivateAndRemovingOnePreservesVideos() {
    Jwt owner=token("folder-owner"), stranger=token("folder-stranger");
    AppUser user=users.requireLocked(owner);
    UUID clip=video(user);
    var folder=workspace.folder(new WorkspaceService.FolderRequest("Walkthroughs"),owner);
    assertThat(workspace.folders(stranger)).isEmpty();
    assertThatThrownBy(()->workspace.organize(clip,new WorkspaceService.OrganizeRequest(folder.id(),true,false),stranger)).isInstanceOf(RuntimeException.class);
    workspace.organize(clip,new WorkspaceService.OrganizeRequest(folder.id(),true,true),owner);
    // Flush entity writes before using JDBC to inspect them.
    comments.flush();
    assertThat(jdbc.queryForObject("select favorite and archived from videos where id=?",Boolean.class,clip)).isTrue();
    workspace.deleteFolder(folder.id(),owner);
    assertThat(jdbc.queryForObject("select count(*) from videos where id=? and folder_id is null",Long.class,clip)).isEqualTo(1);
  }

  @Test @Transactional void commentsReplyMentionNotifyAndRespectRevocation() {
    Jwt owner=token("conversation-owner"), viewer=token("conversation-viewer");
    AppUser creator=users.requireLocked(owner), participant=users.requireLocked(viewer);
    UUID clip=video(creator);String link=share(clip);
    var root=workspace.comment(clip,link,new CommentRequest("Question",2,null,null,List.of()),viewer);
    var reply=workspace.comment(clip,null,new CommentRequest("Answer",2,null,root.id(),List.of(participant.getId())),owner);
    assertThat(reply.parentId()).isEqualTo(root.id());
    assertThat(workspace.notifications(viewer)).hasSize(1);
    assertThat(workspace.notifications(owner)).hasSize(1);
    workspace.markRead(viewer);
    assertThat(workspace.notifications(viewer)).allMatch(WorkspaceService.NotificationResponse::read);
    workspace.resolve(clip,root.id(),true,owner);
    assertThat(comments.findById(root.id()).orElseThrow().isResolved()).isTrue();
    assertThatThrownBy(()->workspace.editSharedComment(clip,root.id(),null,new WorkspaceService.EditCommentRequest("Hijack"),owner)).isInstanceOf(RuntimeException.class);
    workspace.editSharedComment(clip,root.id(),link,new WorkspaceService.EditCommentRequest("Updated question"),viewer);
    jdbc.update("update share_links set revoked_at=now() where video_id=?",clip);
    assertThatThrownBy(()->workspace.participants(clip,link,viewer)).isInstanceOf(RuntimeException.class);
  }

  @Test @Transactional void rejectsCrossVideoThreadsAndForeignFolders() {
    Jwt owner=token("boundary-owner"), other=token("boundary-other");
    AppUser user=users.requireLocked(owner);users.requireLocked(other);
    UUID first=video(user),second=video(user);
    var root=workspace.comment(first,null,new CommentRequest("First",0,null,null,List.of()),owner);
    assertThatThrownBy(()->workspace.comment(second,null,new CommentRequest("Wrong video",0,null,root.id(),List.of()),owner)).isInstanceOf(RuntimeException.class);
    var folder=workspace.folder(new WorkspaceService.FolderRequest("Other private folder"),other);
    assertThatThrownBy(()->workspace.organize(first,new WorkspaceService.OrganizeRequest(folder.id(),false,false),owner)).isInstanceOf(RuntimeException.class);
  }

  @Test @Transactional void reactionsToggleAndOnlyNotifyTheOwner() {
    Jwt owner=token("reaction-owner"),viewer=token("reaction-viewer");
    AppUser creator=users.requireLocked(owner);users.requireLocked(viewer);
    UUID clip=video(creator);String link=share(clip);
    var request=new WorkspaceService.ReactionRequest("👍",2);
    workspace.react(clip,link,request,viewer);
    assertThat(workspace.reactions(clip,link,viewer)).singleElement().satisfies(r->{assertThat(r.count()).isEqualTo(1);assertThat(r.mine()).isTrue();});
    assertThat(workspace.notifications(owner)).hasSize(1);
    assertThat(workspace.notifications(viewer)).isEmpty();
    workspace.react(clip,link,request,viewer);
    assertThat(workspace.reactions(clip,link,viewer)).isEmpty();
  }

  @Test void flywayCreatesTheDurableWorkflowSchema() {
    List<String> tables = jdbc.queryForList(
        "select table_name from information_schema.tables where table_schema='public'", String.class);
    assertThat(tables).contains("app_users", "videos", "share_links", "comments", "processing_jobs", "viewing_sessions");
    Integer migrations = jdbc.queryForObject("select count(*) from flyway_schema_history where success", Integer.class);
    assertThat(migrations).isEqualTo(4);
  }
}
