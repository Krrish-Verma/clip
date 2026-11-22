package com.clip.service;
import java.util.List;
import java.util.UUID;
public record MediaPlan(List<Segment> segments, Crop crop, List<Region> blurs, List<Region> boxes,
                        String overlayText, int width,int height,double thumbnailAt) {
  public record Segment(UUID videoId,String sourceKey,double start,double end) {}
  public record Crop(double x,double y,double width,double height) {}
  public record Region(double x,double y,double width,double height) {}
}
