package com.clip.service;

import com.clip.config.ClipProperties;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.model.UploadPartPresignRequest;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

@Service
public class StorageService {
  private final S3Client s3;
  private final S3Presigner presigner;
  private final ClipProperties properties;
  public StorageService(S3Client s3, S3Presigner presigner, ClipProperties properties) {
    this.s3 = s3; this.presigner = presigner; this.properties = properties;
  }
  public String uploadUrl(String key, String contentType, long size) {
    PutObjectRequest request = PutObjectRequest.builder().bucket(properties.storage().bucket()).key(key)
        .contentType(contentType).contentLength(size).metadata(Map.of("declared-size", Long.toString(size))).build();
    return presigner.presignPutObject(PutObjectPresignRequest.builder()
        .signatureDuration(properties.storage().uploadExpiry()).putObjectRequest(request).build()).url().toString();
  }
  public SignedUrl playbackUrl(String key) {
    var duration = properties.storage().playbackExpiry();
    GetObjectRequest request = GetObjectRequest.builder().bucket(properties.storage().bucket()).key(key).build();
    String url = presigner.presignGetObject(GetObjectPresignRequest.builder().signatureDuration(duration).getObjectRequest(request).build()).url().toString();
    return new SignedUrl(url, Instant.now().plus(duration));
  }
  public HeadObjectResponse head(String key) { return s3.headObject(HeadObjectRequest.builder().bucket(properties.storage().bucket()).key(key).build()); }
  public void download(String key, Path target) { s3.getObject(GetObjectRequest.builder().bucket(properties.storage().bucket()).key(key).build(), target); }
  public void upload(String key, Path source, String contentType) {
    s3.putObject(PutObjectRequest.builder().bucket(properties.storage().bucket()).key(key).contentType(contentType).build(), RequestBody.fromFile(source));
  }
  public void delete(String key) {
    if (key != null && !key.isBlank()) s3.deleteObject(DeleteObjectRequest.builder().bucket(properties.storage().bucket()).key(key).build());
  }
  public record SignedUrl(String playbackUrl, Instant expiresAt) {}
  public String beginMultipart(String key,String mime) {
    return s3.createMultipartUpload(CreateMultipartUploadRequest.builder().bucket(properties.storage().bucket()).key(key).contentType(mime).build()).uploadId();
  }
  public String partUrl(String key,String uploadId,int number) {
    return presigner.presignUploadPart(UploadPartPresignRequest.builder().signatureDuration(properties.storage().uploadExpiry()).uploadPartRequest(
        UploadPartRequest.builder().bucket(properties.storage().bucket()).key(key).uploadId(uploadId).partNumber(number).build()).build()).url().toString();
  }
  public List<Part> uploadedParts(String key,String uploadId) {
    return s3.listParts(ListPartsRequest.builder().bucket(properties.storage().bucket()).key(key).uploadId(uploadId).build()).parts();
  }
  public void finishMultipart(String key,String uploadId,List<CompletedPart> parts) {
    s3.completeMultipartUpload(CompleteMultipartUploadRequest.builder().bucket(properties.storage().bucket()).key(key).uploadId(uploadId)
        .multipartUpload(CompletedMultipartUpload.builder().parts(parts).build()).build());
  }
  public void abortMultipart(String key,String uploadId) {
    if(uploadId!=null) try {s3.abortMultipartUpload(AbortMultipartUploadRequest.builder().bucket(properties.storage().bucket()).key(key).uploadId(uploadId).build());}
    catch(S3Exception e){if(e.statusCode()!=404)throw e;}
  }
  public void deleteVideoOutputs(java.util.UUID videoId) {
    String prefix="videos/"+videoId+"/";
    for(var page:s3.listObjectsV2Paginator(ListObjectsV2Request.builder().bucket(properties.storage().bucket()).prefix(prefix).build()))
      for(var object:page.contents()) delete(object.key());
  }
}
