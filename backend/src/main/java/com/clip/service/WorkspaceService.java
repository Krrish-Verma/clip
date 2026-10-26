package com.clip.service;

import static com.clip.api.ApiModels.*;
import com.clip.config.ApiExceptionHandler.ApiProblem;
import com.clip.domain.*;
import com.clip.repository.CommentRepository;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class WorkspaceService {
  private final JdbcTemplate jdbc;
  private final VideoService videos;
  private final CurrentUserService users;
  private final CommentRepository comments;
  public WorkspaceService(JdbcTemplate jdbc, VideoService videos, CurrentUserService users, CommentRepository comments) {
    this.jdbc=jdbc; this.videos=videos; this.users=users; this.comments=comments;
  }
  public record FolderResponse(UUID id, String name) {}
  public record FolderRequest(@NotBlank @Size(max=80) String name) {}
  public record OrganizeRequest(UUID folderId, boolean favorite, boolean archived) {}
  public record EditCommentRequest(@NotBlank @Size(max=1000) String message) {}
  public record ResolveRequest(boolean resolved) {}
  public record Participant(UUID id, String displayName, String clerkUserId) {}
  public record ReactionRequest(@NotBlank String emoji, @PositiveOrZero int timestampSeconds) {}
  public record ReactionResponse(String emoji, long count, boolean mine) {}
  public record NotificationResponse(UUID id, UUID videoId, String videoTitle, String message, Instant createdAt, boolean read, boolean canOpen) {}
  private ApiProblem missing() { return new ApiProblem(HttpStatus.NOT_FOUND, "This item could not be found."); }

  public List<FolderResponse> folders(Jwt jwt) {
    return jdbc.query("select id, name from folders where owner_id=? order by lower(name)",
        (r,n)->new FolderResponse(r.getObject(1,UUID.class), r.getString(2)), users.require(jwt).getId());
  }
  public FolderResponse folder(FolderRequest request, Jwt jwt) {
    UUID owner=users.requireLocked(jwt).getId();
    if (folders(jwt).size()>=50) throw new ApiProblem(HttpStatus.CONFLICT,"You can create up to 50 folders.");
    String name=request.name().trim();
    if (name.isEmpty()) throw new ApiProblem(HttpStatus.BAD_REQUEST,"Enter a folder name.");
    if (jdbc.queryForObject("select count(*) from folders where owner_id=? and lower(name)=lower(?)",Long.class,owner,name)>0)
      throw new ApiProblem(HttpStatus.CONFLICT,"A folder with this name already exists.");
    UUID id=UUID.randomUUID();
    jdbc.update("insert into folders(id,owner_id,name) values(?,?,?)",id,owner,name);
    return new FolderResponse(id,name);
  }
  public void deleteFolder(UUID id, Jwt jwt) {
    if(jdbc.update("delete from folders where id=? and owner_id=?",id,users.require(jwt).getId())==0) throw missing();
  }
  public void organize(UUID id, OrganizeRequest request, Jwt jwt) {
    Video video=videos.owned(id,jwt);
    if(request.folderId()!=null && jdbc.queryForObject("select count(*) from folders where id=? and owner_id=?",Long.class,
        request.folderId(),video.getOwner().getId())==0) throw missing();
    video.organize(request.folderId(),request.favorite(),request.archived());
  }
  public List<Participant> participants(UUID id,String token,Jwt jwt) {
    videos.authorizedVideo(id,token,jwt);
    // Only people already participating in this video; never expose the user directory or emails.
    return jdbc.query("select distinct u.id,u.display_name,u.clerk_user_id from app_users u where u.id=(select owner_id from videos where id=?) or u.id in(select author_user_id from comments where video_id=?) order by u.display_name",
        (r,n)->new Participant(r.getObject(1,UUID.class),r.getString(2),r.getString(3)),id,id);
  }
  public CommentResponse comment(UUID id,String token,CommentRequest request,Jwt jwt) {
    Video video=videos.authorizedVideo(id,token,jwt);
    if(video.getStatus()!=Video.Status.READY) throw new ApiProblem(HttpStatus.CONFLICT,"This clip is not ready yet.");
    if(request.timestampSeconds()>Math.ceil(video.getDurationSeconds())) throw new ApiProblem(HttpStatus.BAD_REQUEST,"Comment timestamp is outside the video.");
    AppUser author=jwt==null?null:users.require(jwt);
    String guest=author==null?request.guestDisplayName():null;
    if(author==null && (guest==null || guest.isBlank())) throw new ApiProblem(HttpStatus.BAD_REQUEST,"Your name is required.");
    Comment parent=null;
    if(request.parentId()!=null) {
      parent=findComment(id,request.parentId());
      if(parent.getParentId()!=null) throw new ApiProblem(HttpStatus.BAD_REQUEST,"Reply to the original thread.");
    }
    Comment comment=new Comment(video,author,guest==null?null:guest.trim(),request.message().trim(),request.timestampSeconds());
    comment.replyTo(parent==null?null:parent.getId());
    comments.saveAndFlush(comment);
    String name=author==null?guest.trim():author.getDisplayName();
    Set<UUID> recipients=new HashSet<>();
    recipients.add(video.getOwner().getId());
    if(parent!=null && parent.getAuthor()!=null) recipients.add(parent.getAuthor().getId());
    if(author!=null && request.mentionIds()!=null) {
      Set<UUID> allowed=new HashSet<>(participants(id,token,jwt).stream().map(Participant::id).toList());
      for(UUID mentioned:request.mentionIds()) if(allowed.contains(mentioned)) recipients.add(mentioned);
    }
    if(author!=null) recipients.remove(author.getId());
    for(UUID recipient:recipients) notify(recipient,id,name+" "+(parent==null?"commented":"replied")+" at "+request.timestampSeconds()+"s: "+comment.getMessage());
    return CommentResponse.from(comment);
  }
  private Comment findComment(UUID videoId,UUID id) {
    return comments.findById(id).filter(c->c.getVideo().getId().equals(videoId)).orElseThrow(this::missing);
  }
  public void editSharedComment(UUID videoId,UUID id,String token,EditCommentRequest request,Jwt jwt) {
    videos.authorizedVideo(videoId,token,jwt);
    Comment comment=findComment(videoId,id);
    if(comment.getAuthor()==null || !comment.getAuthor().getId().equals(users.require(jwt).getId())) throw missing();
    comment.edit(request.message().trim());
  }
  public void deleteComment(UUID videoId,UUID id,String token,Jwt jwt) {
    Video video=videos.authorizedVideo(videoId,token,jwt);
    Comment comment=findComment(videoId,id);
    UUID user=users.require(jwt).getId();
    if(!video.getOwner().getId().equals(user) && (comment.getAuthor()==null || !comment.getAuthor().getId().equals(user))) throw missing();
    comments.delete(comment);
  }
  public void resolve(UUID videoId,UUID id,boolean resolved,Jwt jwt) {
    videos.owned(videoId,jwt);
    Comment comment=findComment(videoId,id);
    if(comment.getParentId()!=null) throw new ApiProblem(HttpStatus.BAD_REQUEST,"Resolve the original thread.");
    comment.resolve(resolved);
  }
  public List<ReactionResponse> reactions(UUID videoId,String token,Jwt jwt) {
    videos.authorizedVideo(videoId,token,jwt);
    UUID user=jwt==null?null:users.require(jwt).getId();
    return jdbc.query("select emoji,count(*),coalesce(bool_or(author_id=?),false) from reactions where video_id=? group by emoji order by emoji",
        (r,n)->new ReactionResponse(r.getString(1),r.getLong(2),r.getBoolean(3)),user,videoId);
  }
  public void react(UUID videoId,String token,ReactionRequest request,Jwt jwt) {
    Video video=videos.authorizedVideo(videoId,token,jwt);
    if(!Set.of("👍","❤️","🎉","👀","💡").contains(request.emoji())) throw new ApiProblem(HttpStatus.BAD_REQUEST,"Choose a supported reaction.");
    if(video.getStatus()!=Video.Status.READY || request.timestampSeconds()>Math.ceil(video.getDurationSeconds())) throw new ApiProblem(HttpStatus.BAD_REQUEST,"Invalid reaction timestamp.");
    AppUser user=users.requireLocked(jwt);
    int removed=jdbc.update("delete from reactions where video_id=? and author_id=? and emoji=?",videoId,user.getId(),request.emoji());
    if(removed==0) {
      jdbc.update("insert into reactions(id,video_id,author_id,emoji,timestamp_seconds) values(?,?,?,?,?)",UUID.randomUUID(),videoId,user.getId(),request.emoji(),request.timestampSeconds());
      if(!video.getOwner().getId().equals(user.getId())) notify(video.getOwner().getId(),videoId,user.getDisplayName()+" reacted "+request.emoji()+" at "+request.timestampSeconds()+"s");
    }
  }
  private void notify(UUID recipient,UUID video,String message) {
    jdbc.update("insert into notifications(id,recipient_id,video_id,message) values(?,?,?,?)",UUID.randomUUID(),recipient,video,message.substring(0,Math.min(300,message.length())));
  }
  public List<NotificationResponse> notifications(Jwt jwt) {
    // A revoked share must not grant continued access through an old notification.
    return jdbc.query("select n.id,n.video_id,v.title,n.message,n.created_at,n.read_at is not null,v.owner_id=n.recipient_id from notifications n join videos v on v.id=n.video_id where n.recipient_id=? order by n.created_at desc limit 100",
        (r,n)->new NotificationResponse(r.getObject(1,UUID.class),r.getObject(2,UUID.class),r.getString(3),r.getString(4),r.getTimestamp(5).toInstant(),r.getBoolean(6),r.getBoolean(7)),users.require(jwt).getId());
  }
  public void markRead(Jwt jwt) { jdbc.update("update notifications set read_at=now() where recipient_id=? and read_at is null",users.require(jwt).getId()); }
}
