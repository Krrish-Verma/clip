package com.clip.service;
import com.clip.domain.Video;
import com.clip.config.ApiExceptionHandler.ApiProblem;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.services.s3.model.CompletedPart;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Service
public class MultipartService {
  public static final int PART_SIZE=8*1024*1024;
  private final VideoService videos; private final StorageService storage;private final CurrentUserService users;
  public MultipartService(VideoService videos,StorageService storage,CurrentUserService users){this.videos=videos;this.storage=storage;this.users=users;}
  public record UploadPart(int number,String url,boolean uploaded){}
  public record UploadSession(int partSize,List<UploadPart> parts){}
  @Transactional public UploadSession begin(UUID id,Jwt jwt){
    users.requireLocked(jwt);
    Video video=videos.owned(id,jwt);
    if(video.getStatus()==Video.Status.PROCESSING||video.getStatus()==Video.Status.READY)return new UploadSession(PART_SIZE,List.of());
    if(video.getStatus()!=Video.Status.UPLOADING)throw new ApiProblem(HttpStatus.CONFLICT,"This clip no longer accepts uploads.");
    if(video.getMultipartUploadId()==null)video.multipart(storage.beginMultipart(video.getSourceObjectKey(),video.getDeclaredMimeType()));
    Set<Integer> done=new HashSet<>();
    try {for(var part:storage.uploadedParts(video.getSourceObjectKey(),video.getMultipartUploadId()))done.add(part.partNumber());}
    catch(S3Exception e){if(!missingUpload(e))throw e;videos.complete(id,jwt);video.multipart(null);return new UploadSession(PART_SIZE,List.of());}
    int count=(int)((video.getDeclaredSizeBytes()+PART_SIZE-1)/PART_SIZE);
    if(count>1000)throw new ApiProblem(HttpStatus.BAD_REQUEST,"Upload is too large.");
    List<UploadPart> parts=new ArrayList<>();
    for(int n=1;n<=count;n++)parts.add(new UploadPart(n,done.contains(n)?null:storage.partUrl(video.getSourceObjectKey(),video.getMultipartUploadId(),n),done.contains(n)));
    return new UploadSession(PART_SIZE,parts);
  }
  @Transactional public void complete(UUID id,Jwt jwt){
    users.requireLocked(jwt);
    Video video=videos.owned(id,jwt);
    if(video.getStatus()!=Video.Status.UPLOADING)return;
    if(video.getMultipartUploadId()==null){videos.complete(id,jwt);return;}
    java.util.List<software.amazon.awssdk.services.s3.model.Part> actual;
    try{actual=storage.uploadedParts(video.getSourceObjectKey(),video.getMultipartUploadId());}
    catch(S3Exception e){if(!missingUpload(e))throw e;videos.complete(id,jwt);video.multipart(null);return;}
    int count=(int)((video.getDeclaredSizeBytes()+PART_SIZE-1)/PART_SIZE);
    if(actual.size()!=count)throw new ApiProblem(HttpStatus.CONFLICT,"Some upload parts are missing. Resume the upload.");
    List<CompletedPart> parts=new ArrayList<>();
    for(int i=0;i<count;i++){
      var part=actual.get(i);long expected=Math.min(PART_SIZE,video.getDeclaredSizeBytes()-(long)i*PART_SIZE);
      if(part.partNumber()!=i+1||part.size()!=expected)throw new ApiProblem(HttpStatus.BAD_REQUEST,"An upload part had an unexpected size.");
      parts.add(CompletedPart.builder().partNumber(part.partNumber()).eTag(part.eTag()).build());
    }
    storage.finishMultipart(video.getSourceObjectKey(),video.getMultipartUploadId(),parts);video.multipart(null);videos.complete(id,jwt);
  }
  private boolean missingUpload(S3Exception e){return e.statusCode()==404&&e.awsErrorDetails()!=null&&"NoSuchUpload".equals(e.awsErrorDetails().errorCode());}
}
