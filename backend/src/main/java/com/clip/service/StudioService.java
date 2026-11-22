package com.clip.service;
import com.clip.config.ApiExceptionHandler.ApiProblem;
import com.clip.config.ClipProperties;
import com.clip.domain.*;
import com.clip.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional
public class StudioService {
  private final VideoService videos;private final ProcessingJobRepository jobs;private final ObjectMapper json;private final JdbcTemplate jdbc;private final ClipProperties properties;private final StorageService storage;
  public StudioService(VideoService videos,ProcessingJobRepository jobs,ObjectMapper json,JdbcTemplate jdbc,ClipProperties properties,StorageService storage){this.videos=videos;this.jobs=jobs;this.json=json;this.jdbc=jdbc;this.properties=properties;this.storage=storage;}
  public record ClipSegment(@NotNull UUID videoId,@PositiveOrZero double start,@Positive double end){}
  public record EditRequest(@NotEmpty @Size(max=30) List<@Valid ClipSegment> segments,MediaPlan.Crop crop,
      @Size(max=10) List<MediaPlan.Region> blurs,@Size(max=10) List<MediaPlan.Region> boxes,
      @Size(max=200) String overlayText,@NotBlank String aspect,@PositiveOrZero double thumbnailAt){}
  public record Details(int revision,String jobStatus,String failure,String transcriptStatus,String transcriptError,String transcriptJson,String description,String ctaLabel,String ctaUrl){}
  public record DetailsRequest(@Size(max=3000) String description,@Size(max=80) String ctaLabel,@Size(max=1000) String ctaUrl){}
  public record Revision(int revision,double durationSeconds,String playbackUrl,java.time.Instant createdAt){}
  public List<Revision> revisions(UUID id,String token,Jwt jwt){
    Video video=videos.authorizedVideo(id,token,jwt);
    boolean shared=token!=null&&!token.isBlank();
    // A shared viewer must not recover content removed in an earlier revision.
    return jdbc.query("select revision,duration_seconds,playback_key,created_at from media_versions where video_id=? and (? or revision=?) order by revision desc",(r,n)->new Revision(r.getInt(1),r.getDouble(2),storage.playbackUrl(r.getString(3)).playbackUrl(),r.getTimestamp(4).toInstant()),id,!shared,video.getPublishedRevision());
  }
  public Details details(UUID id,String token,Jwt jwt){
    Video video=videos.authorizedVideo(id,token,jwt);
    boolean shared=token!=null&&!token.isBlank();
    return jdbc.queryForObject("select media_revision,transcript_status,transcript_error,transcript_json,description,cta_label,cta_url from videos where id=?",(r,n)->new Details(r.getInt(1),!shared?jobs.findByVideoId(id).map(j->j.getState().name()).orElse("SUCCEEDED"):null,!shared?jobs.findByVideoId(id).map(ProcessingJob::getLastError).orElse(null):null,r.getString(2),!shared?r.getString(3):null,r.getString(4),r.getString(5),r.getString(6),r.getString(7)),video.getId());
  }
  public void edit(UUID id,EditRequest request,Jwt jwt){
    Video target=videos.owned(id,jwt);
    if(target.getPublishedRevision()>=9&&target.getMediaRevision()==target.getPublishedRevision())throw new ApiProblem(HttpStatus.CONFLICT,"This clip has reached its ten-revision limit. Download the current version to start a new clip.");
    var existing=jobs.findByVideoId(id);
    if(existing.isPresent() && Set.of(ProcessingJob.State.QUEUED,ProcessingJob.State.RUNNING).contains(existing.get().getState()))throw new ApiProblem(HttpStatus.CONFLICT,"Wait for the current processing job to finish.");
    List<MediaPlan.Segment> segments=new ArrayList<>();double total=0;
    for(var part:request.segments()){
      Video source=videos.owned(part.videoId(),jwt);
      if(source.getStatus()!=Video.Status.READY || source.getPlaybackObjectKey()==null || !Double.isFinite(part.start()) || !Double.isFinite(part.end()) || part.end()<=part.start() || part.end()>source.getDurationSeconds()+.05)throw new ApiProblem(HttpStatus.BAD_REQUEST,"Choose a valid range from a ready clip.");
      total+=part.end()-part.start();segments.add(new MediaPlan.Segment(source.getId(),source.getPlaybackObjectKey(),part.start(),part.end()));
    }
    if(total>properties.quotas().maxDurationSeconds() || request.thumbnailAt()>total || !Double.isFinite(request.thumbnailAt()))throw new ApiProblem(HttpStatus.BAD_REQUEST,"The edit exceeds the duration limit.");
    if(request.crop()!=null)validate(request.crop().x(),request.crop().y(),request.crop().width(),request.crop().height());
    for(var rect:request.blurs()==null?List.<MediaPlan.Region>of():request.blurs())validate(rect.x(),rect.y(),rect.width(),rect.height());
    for(var rect:request.boxes()==null?List.<MediaPlan.Region>of():request.boxes())validate(rect.x(),rect.y(),rect.width(),rect.height());
    int width=1280,height=720;
    switch(request.aspect()){case "square"->height=1280;case "portrait"->{width=720;height=1280;}case "landscape"->{}default->throw new ApiProblem(HttpStatus.BAD_REQUEST,"Choose landscape, square, or portrait.");}
    try{target.planEdit(json.writeValueAsString(new MediaPlan(segments,request.crop(),request.blurs(),request.boxes(),request.overlayText(),width,height,request.thumbnailAt())));}catch(Exception e){throw new IllegalStateException(e);}
    existing.ifPresentOrElse(ProcessingJob::manualRetry,()->jobs.save(new ProcessingJob(target)));
  }
  static void validate(double x,double y,double width,double height){
    if(!Double.isFinite(x)||!Double.isFinite(y)||!Double.isFinite(width)||!Double.isFinite(height)||x<0||y<0||width<.02||height<.02||x+width>1.00001||y+height>1.00001)throw new ApiProblem(HttpStatus.BAD_REQUEST,"Regions must fit inside the video.");
  }
  public void metadata(UUID id,DetailsRequest request,Jwt jwt){
    videos.owned(id,jwt);String url=request.ctaUrl();
    if(url!=null&&!url.isBlank())try{var uri=java.net.URI.create(url);if(!Set.of("http","https").contains(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null)throw new IllegalArgumentException();}catch(Exception e){throw new ApiProblem(HttpStatus.BAD_REQUEST,"The action link must be a valid http or https URL.");}
    jdbc.update("update videos set description=?,cta_label=?,cta_url=? where id=?",request.description()==null?"":request.description(),request.ctaLabel(),url,id);
  }
}
