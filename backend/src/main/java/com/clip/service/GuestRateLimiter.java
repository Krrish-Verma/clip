package com.clip.service;

import com.clip.config.ApiExceptionHandler.ApiProblem;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class GuestRateLimiter {
  private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
  public void check(String category, String address, int limitPerMinute) {
    String key = category + ":" + Hashing.sha256(address == null ? "unknown" : address);
    long minute = Instant.now().getEpochSecond() / 60;
    Window window = windows.compute(key, (ignored, current) -> current == null || current.minute != minute ? new Window(minute) : current);
    if (window.count.incrementAndGet() > limitPerMinute)
      throw new ApiProblem(HttpStatus.TOO_MANY_REQUESTS, "Too many requests. Please wait a moment and try again.");
    if (windows.size() > 10_000) windows.entrySet().removeIf(entry -> entry.getValue().minute < minute - 2);
  }
  private static final class Window {
    private final long minute;
    private final AtomicInteger count = new AtomicInteger();
    private Window(long minute) { this.minute = minute; }
  }
}
