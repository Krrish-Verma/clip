package com.clip.service;
import com.clip.config.ApiExceptionHandler.ApiProblem;
import com.clip.config.ClipProperties;
import com.clip.domain.Video;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TranscriptService {
  private final JdbcTemplate jdbc;private final VideoService videos;private final StorageService storage;private final ClipProperties properties;private final ObjectMapper json;
  private final String endpoint;
  public TranscriptService(JdbcTemplate jdbc,VideoService videos,StorageService storage,ClipProperties properties,ObjectMapper json,@Value("${clip.transcription.url:}")String endpoint){this.jdbc=jdbc;this.videos=videos;this.storage=storage;this.properties=properties;this.json=json;this.endpoint=endpoint;}
  @Transactional public void request(UUID id,Jwt jwt){
    Video video=videos.owned(id,jwt);
    if(endpoint.isBlank())throw new ApiProblem(HttpStatus.SERVICE_UNAVAILABLE,"Transcription is not connected yet.");
    if(video.getStatus()!=Video.Status.READY)throw new ApiProblem(HttpStatus.CONFLICT,"Wait for the clip to finish processing.");
    if(video.getPublishedRevision()!=video.getMediaRevision())throw new ApiProblem(HttpStatus.CONFLICT,"Wait for the new revision to finish rendering.");
    int changed=jdbc.update("insert into transcript_jobs(video_id,revision,playback_key) values(?,?,?) on conflict(video_id) do update set revision=excluded.revision,playback_key=excluded.playback_key,state='QUEUED',attempts=0,requested_at=now(),last_error=null where transcript_jobs.state not in ('QUEUED','RUNNING')",id,video.getMediaRevision(),video.getPlaybackObjectKey());
    if(changed>0)jdbc.update("update videos set transcript_status='QUEUED',transcript_error=null where id=?",id);
  }
  private record Job(UUID id,int revision,String key,int attempt){}
  public record SegmentEdit(@jakarta.validation.constraints.PositiveOrZero double start,@jakarta.validation.constraints.Positive double end,@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=2000) String text){}
  public record EditRequest(int revision,@jakarta.validation.constraints.Size(max=3000) java.util.List<@jakarta.validation.Valid SegmentEdit> segments){}
  @Transactional public void edit(UUID id,EditRequest request,Jwt jwt){
    Video video=videos.owned(id,jwt);
    if(request.revision()!=video.getMediaRevision()||video.getMediaRevision()!=video.getPublishedRevision()||request.segments()==null)throw new ApiProblem(HttpStatus.CONFLICT,"The video revision changed. Reload before editing the transcript.");
    if(jdbc.queryForObject("select count(*) from transcript_jobs where video_id=? and state in ('QUEUED','RUNNING')",Integer.class,id)>0)throw new ApiProblem(HttpStatus.CONFLICT,"Wait for speech recognition to finish before editing.");
    ObjectNode transcript=json.createObjectNode();ArrayNode segments=transcript.putArray("segments");double last=0;
    for(var segment:request.segments()){
      if(!Double.isFinite(segment.start())||!Double.isFinite(segment.end())||segment.start()<last||segment.end()<=segment.start()||segment.end()>video.getDurationSeconds()+.1)throw new ApiProblem(HttpStatus.BAD_REQUEST,"Transcript ranges must be ordered and inside the video.");
      segments.addObject().put("start",segment.start()).put("end",segment.end()).put("text",segment.text().trim());last=segment.end();
    }
    transcript.put("engine","manually-edited");enrich(transcript);
    try{jdbc.update("update videos set transcript_json=?,transcript_status='READY',transcript_error=null where id=?",json.writeValueAsString(transcript),id);}catch(Exception e){throw new IllegalStateException(e);}
  }
  @Scheduled(fixedDelay=5000) public void poll(){
    if(!properties.worker().enabled()||endpoint.isBlank())return;
    jdbc.update("update transcript_jobs set state='QUEUED' where state='RUNNING' and locked_at<now()-interval '20 minutes'");
    List<Job> claimed=jdbc.query("update transcript_jobs set state='RUNNING',locked_at=now(),attempts=attempts+1 where video_id=(select video_id from transcript_jobs where state='QUEUED' order by requested_at for update skip locked limit 1) returning video_id,revision,playback_key,attempts",(r,n)->new Job(r.getObject(1,UUID.class),r.getInt(2),r.getString(3),r.getInt(4)));
    for(Job job:claimed)process(job);
  }
  private void process(Job job){
    Path directory=null;
    try{
      jdbc.update("update videos set transcript_status='RUNNING' where id=? and media_revision=?",job.id(),job.revision());
      directory=Files.createTempDirectory("clip-speech-");Path input=directory.resolve("source.mp4"),audio=directory.resolve("audio.wav"),log=directory.resolve("speech.log");
      storage.download(job.key(),input);
      Process process=new ProcessBuilder(properties.worker().ffmpegPath(),"-nostdin","-y","-protocol_whitelist","file,pipe","-i",input.toString(),"-vn","-ac","1","-ar","16000","-t",Long.toString(properties.quotas().maxDurationSeconds()),audio.toString()).redirectErrorStream(true).redirectOutput(log.toFile()).start();
      if(!process.waitFor(2,TimeUnit.MINUTES)){process.destroyForcibly();throw new java.io.IOException("Audio extraction timed out.");}
      if(process.exitValue()!=0)throw new java.io.IOException("This clip has no audio track to transcribe.");
      HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
      HttpRequest request=HttpRequest.newBuilder(URI.create(endpoint.replaceAll("/$","")+"/transcribe")).timeout(Duration.ofMinutes(15)).header("Content-Type","audio/wav").POST(HttpRequest.BodyPublishers.ofFile(audio)).build();
      var response=client.send(request,HttpResponse.BodyHandlers.ofString());
      if(response.statusCode()!=200)throw new java.io.IOException("The speech service is unavailable or busy. Try again.");
      ObjectNode transcript=(ObjectNode)json.readTree(response.body());
      enrich(transcript);
      int updated=jdbc.update("update videos set transcript_json=?,transcript_status='READY',transcript_error=null where id=? and media_revision=? and exists(select 1 from transcript_jobs where video_id=? and revision=? and attempts=? and state='RUNNING')",json.writeValueAsString(transcript),job.id(),job.revision(),job.id(),job.revision(),job.attempt());
      jdbc.update("update transcript_jobs set state=? where video_id=? and revision=? and attempts=?",updated>0?"SUCCEEDED":"STALE",job.id(),job.revision(),job.attempt());
    }catch(Exception e){
      String message=e.getMessage()==null?"Speech recognition failed.":e.getMessage();message=message.substring(0,Math.min(300,message.length()));
      jdbc.update("update videos set transcript_status='FAILED',transcript_error=? where id=? and media_revision=? and exists(select 1 from transcript_jobs where video_id=? and revision=? and attempts=? and state='RUNNING')",message,job.id(),job.revision(),job.id(),job.revision(),job.attempt());
      jdbc.update("update transcript_jobs set state='FAILED',last_error=? where video_id=? and revision=? and attempts=?",message,job.id(),job.revision(),job.attempt());
    }finally{if(directory!=null)try(var files=Files.walk(directory)){files.sorted(Comparator.reverseOrder()).forEach(p->{try{Files.deleteIfExists(p);}catch(Exception ignored){}});}catch(Exception ignored){}}
  }
  // Extractive highlights are explicit, deterministic suggestions. No invented claims or paid model calls.
  static void enrich(ObjectNode result){
    StringBuilder full=new StringBuilder();ArrayNode chapters=result.putArray("chapters"),tasks=result.putArray("tasks"),redactions=result.putArray("redactions"),cuts=result.putArray("suggestedCuts");
    double chapterAt=-60,lastEnd=0;
    Pattern sensitive=Pattern.compile("(?i)([\\w.+-]+@[\\w.-]+\\.[a-z]{2,}|(?:sk|pk|api|token)[-_][a-z0-9_-]{16,})");
    for(JsonNode segment:result.path("segments")){
      String text=segment.path("text").asText();double start=segment.path("start").asDouble(),end=segment.path("end").asDouble();full.append(text).append(' ');
      if(start-chapterAt>=60){chapters.addObject().put("start",start).put("title",text.substring(0,Math.min(70,text.length())));chapterAt=start;}
      if(text.matches("(?is).*(?:need to|will do|action item|todo|next step|please|should).*"))tasks.add(text);
      if(sensitive.matcher(text).find())redactions.addObject().put("start",start).put("end",end).put("reason","Possible email address or credential. Review before sharing.");
      for(JsonNode word:segment.path("words")){
        double ws=word.path("start").asDouble(),we=word.path("end").asDouble();
        if(ws-lastEnd>1.4)cuts.addObject().put("start",lastEnd).put("end",ws-.15).put("reason","Silence");
        if(word.path("text").asText().toLowerCase().replaceAll("[^a-z]","").matches("um|uh|erm|hmm"))cuts.addObject().put("start",ws).put("end",we).put("reason","Filler word");
        lastEnd=we;
      }
    }
    String text=full.toString().trim();String[] sentences=text.split("(?<=[.!?])\\s+");
    result.put("summary",String.join(" ",Arrays.copyOf(sentences,Math.min(3,sentences.length))));
    result.put("suggestedTitle",text.substring(0,Math.min(80,text.length())));
    result.put("highlightsMethod","extractive");
  }
}
