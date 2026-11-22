package com.clip.service;
import com.clip.config.ClipProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Service;

@Service
public class MediaEditor {
  private final StorageService storage;private final ClipProperties properties;private final ObjectMapper json;
  public MediaEditor(StorageService storage,ClipProperties properties,ObjectMapper json){this.storage=storage;this.properties=properties;this.json=json;}
  public void render(MediaPlan plan,Path directory,Path output)throws Exception{
    long deadline=System.nanoTime()+properties.worker().timeout().toNanos();
    List<String> files=new ArrayList<>();int index=0;
    for(var segment:plan.segments()){
      Path input=directory.resolve("input-"+index),part=directory.resolve("part-"+index+".mp4");
      storage.download(segment.sourceKey(),input);
      Path probe=directory.resolve("probe-"+index+".json");
      run(List.of(properties.worker().ffprobePath(),"-v","error","-protocol_whitelist","file,pipe","-show_streams","-of","json",input.toString()),probe,deadline);
      boolean audio=false;for(var stream:json.readTree(probe.toFile()).path("streams"))if("audio".equals(stream.path("codec_type").asText()))audio=true;
      List<String> command=new ArrayList<>(List.of(properties.worker().ffmpegPath(),"-nostdin","-y","-protocol_whitelist","file,pipe","-ss",Double.toString(segment.start()),"-i",input.toString()));
      if(!audio)command.addAll(List.of("-f","lavfi","-i","anullsrc=channel_layout=stereo:sample_rate=48000"));
      StringBuilder filter=new StringBuilder("[0:v]setpts=PTS-STARTPTS");
      if(plan.crop()!=null){var c=plan.crop();filter.append(",crop=trunc(iw*").append(c.width()).append("/2)*2:trunc(ih*").append(c.height()).append("/2)*2:iw*").append(c.x()).append(":ih*").append(c.y());}
      filter.append(",scale=").append(plan.width()).append(":").append(plan.height()).append(":force_original_aspect_ratio=decrease,pad=").append(plan.width()).append(":").append(plan.height()).append(":(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v0];");
      int stage=0;
      for(var blur:plan.blurs()==null?List.<MediaPlan.Region>of():plan.blurs()){
        int x=(int)(blur.x()*plan.width()),y=(int)(blur.y()*plan.height()),w=Math.max(2,(int)(blur.width()*plan.width())),h=Math.max(2,(int)(blur.height()*plan.height()));
        filter.append("[v").append(stage).append("]split[base").append(stage).append("][region").append(stage).append("];[region").append(stage).append("]crop=").append(w).append(":").append(h).append(":").append(x).append(":").append(y).append(",boxblur=luma_radius=min(h\\,w)/10:luma_power=2[blur").append(stage).append("];[base").append(stage).append("][blur").append(stage).append("]overlay=").append(x).append(":").append(y).append("[v").append(stage+1).append("];");stage++;
      }
      filter.append("[v").append(stage).append("]null");
      for(var box:plan.boxes()==null?List.<MediaPlan.Region>of():plan.boxes())filter.append(",drawbox=x=iw*").append(box.x()).append(":y=ih*").append(box.y()).append(":w=iw*").append(box.width()).append(":h=ih*").append(box.height()).append(":color=0xb3f75b:t=5");
      if(plan.overlayText()!=null&&!plan.overlayText().isBlank()){
        Path text=directory.resolve("overlay.txt");Files.writeString(text,plan.overlayText());
        filter.append(",drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile='").append(text.toString().replace("\\","/").replace(":","\\:")).append("':expansion=none:fontcolor=white:fontsize=32:box=1:boxcolor=black@0.65:boxborderw=12:x=30:y=h-th-30");
      }
      filter.append("[out]");
      command.addAll(List.of("-filter_complex",filter.toString(),"-map","[out]","-map",audio?"0:a:0":"1:a:0","-af","asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo","-t",Double.toString(segment.end()-segment.start()),"-c:v","libx264","-preset","veryfast","-crf","23","-pix_fmt","yuv420p","-c:a","aac","-b:a","128k","-movflags","+faststart",part.toString()));
      run(command,directory.resolve("edit-"+index+".log"),deadline);files.add("file '"+part.toString().replace("\\","/").replace("'","'\\''")+"'");index++;
    }
    Path concat=directory.resolve("concat.txt");Files.write(concat,files);
    run(List.of(properties.worker().ffmpegPath(),"-nostdin","-y","-f","concat","-safe","0","-protocol_whitelist","file,pipe","-i",concat.toString(),"-c","copy","-movflags","+faststart",output.toString()),directory.resolve("concat.log"),deadline);
  }
  private void run(List<String> command,Path log,long deadline)throws Exception{
    Process process=new ProcessBuilder(command).redirectErrorStream(true).redirectOutput(log.toFile()).start();
    if(!process.waitFor(Math.max(0,deadline-System.nanoTime()),TimeUnit.NANOSECONDS)){process.destroyForcibly();throw new java.io.IOException("Editing timed out.");}
    if(process.exitValue()!=0){String details=Files.readString(log);throw new java.io.IOException("Media edit failed: "+details.substring(Math.max(0,details.length()-1500)));}
  }
}
