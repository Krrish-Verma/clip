package com.clip.service;

import com.clip.config.ClipProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.*;
import java.time.Duration;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Service;

@Service
public class MediaProcessor {
  private final StorageService storage;
  private final ClipProperties properties;
  private final ObjectMapper json;
  public MediaProcessor(StorageService storage, ClipProperties properties, ObjectMapper json) {
    this.storage = storage; this.properties = properties; this.json = json;
  }

  public Result process(ProcessingQueue.ClaimedJob job) throws Exception {
    Path directory = Files.createTempDirectory("clip-process-");
    Path source = directory.resolve("source");
    Path playback = directory.resolve("playback.mp4");
    Path thumbnail = directory.resolve("thumbnail.jpg");
    String prefix = "videos/" + job.videoId() + "/";
    String playbackKey = prefix + "playback.mp4";
    String thumbnailKey = prefix + "thumbnail.jpg";
    try {
      storage.download(job.sourceKey(), source);
      Probe probe = inspect(source, directory.resolve("probe.log"));
      if (!probe.hasVideo()) throw new IllegalArgumentException("The uploaded object does not contain a video stream.");
      long maxDuration = properties.quotas().maxDurationSeconds();
      if (Double.isFinite(probe.duration()) && (probe.duration() <= 0 || probe.duration() > maxDuration))
        throw new IllegalArgumentException("Video duration is invalid or exceeds the configured limit.");
      run(List.of(properties.worker().ffmpegPath(), "-nostdin", "-y", "-i", source.toString(),
          "-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
          "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
          "-t", Long.toString(maxDuration + 1), playback.toString()), directory.resolve("ffmpeg.log"));
      Probe output = inspect(playback, directory.resolve("output-probe.log"));
      if (!output.hasVideo() || !Double.isFinite(output.duration()) || output.duration() <= 0 || output.duration() > maxDuration)
        throw new IllegalArgumentException("Video duration is invalid or exceeds the configured limit.");
      double frameAt = Math.min(1, Math.max(.1, output.duration() / 2));
      run(List.of(properties.worker().ffmpegPath(), "-nostdin", "-y", "-ss", Double.toString(frameAt), "-i", playback.toString(),
          "-frames:v", "1", "-vf", "scale='min(1280,iw)':-2", "-q:v", "3", thumbnail.toString()), directory.resolve("thumbnail.log"));
      storage.upload(playbackKey, playback, "video/mp4");
      storage.upload(thumbnailKey, thumbnail, "image/jpeg");
      return new Result(output.duration(), playbackKey, thumbnailKey);
    } catch (Exception error) {
      storage.delete(playbackKey);
      storage.delete(thumbnailKey);
      throw error;
    } finally {
      if (Files.exists(directory)) {
        try (var paths = Files.walk(directory)) {
          paths.sorted(Comparator.reverseOrder()).forEach(path -> { try { Files.deleteIfExists(path); } catch (IOException ignored) {} });
        }
      }
    }
  }

  private Probe inspect(Path source, Path log) throws Exception {
    Process process = new ProcessBuilder(properties.worker().ffprobePath(), "-v", "error", "-show_streams", "-show_format", "-of", "json", source.toString())
        .redirectErrorStream(true).redirectOutput(log.toFile()).start();
    if (!process.waitFor(properties.worker().timeout().toMillis(), TimeUnit.MILLISECONDS)) { process.destroyForcibly(); throw new IOException("ffprobe timed out"); }
    if (process.exitValue() != 0) throw new IOException("ffprobe rejected the upload: " + tail(log));
    JsonNode root = json.readTree(log.toFile());
    double duration = root.path("format").path("duration").asDouble(Double.NaN);
    boolean video = false;
    for (JsonNode stream : root.path("streams")) if ("video".equals(stream.path("codec_type").asText())) video = true;
    return new Probe(duration, video);
  }

  private void run(List<String> command, Path log) throws Exception {
    Process process = new ProcessBuilder(command).redirectErrorStream(true).redirectOutput(log.toFile()).start();
    if (!process.waitFor(properties.worker().timeout().toMillis(), TimeUnit.MILLISECONDS)) { process.destroyForcibly(); throw new IOException("Media processing timed out"); }
    if (process.exitValue() != 0) throw new IOException("Media processing failed: " + tail(log));
  }
  private String tail(Path path) throws IOException {
    String value = Files.readString(path);
    return value.substring(Math.max(0, value.length() - 2000));
  }
  private record Probe(double duration, boolean hasVideo) {}
  public record Result(double duration, String playbackKey, String thumbnailKey) {}
}
