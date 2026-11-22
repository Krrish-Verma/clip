package com.clip.service;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.util.*;
import com.clip.domain.*;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.awscore.exception.AwsErrorDetails;

class MultipartServiceTest {
  VideoService videos=mock(VideoService.class);StorageService storage=mock(StorageService.class);CurrentUserService users=mock(CurrentUserService.class);
  MultipartService service=new MultipartService(videos,storage,users);
  Jwt jwt=Jwt.withTokenValue("test-only").header("alg","none").subject("owner").build();UUID id=UUID.randomUUID();
  Video video(long bytes){var video=new Video(new AppUser("owner"),"Demo","video/mp4",bytes,"source");video.multipart("upload");when(videos.owned(id,jwt)).thenReturn(video);return video;}
  @Test void resumesOnlyMissingParts(){
    video(MultipartService.PART_SIZE+42L);when(storage.uploadedParts("source","upload")).thenReturn(List.of(Part.builder().partNumber(1).size((long)MultipartService.PART_SIZE).eTag("one").build()));when(storage.partUrl("source","upload",2)).thenReturn("signed-part-two");
    var session=service.begin(id,jwt);assertThat(session.parts().get(0).uploaded()).isTrue();assertThat(session.parts().get(1).url()).isEqualTo("signed-part-two");verify(users).requireLocked(jwt);
  }
  @Test void rejectsWrongPartSizesBeforeCompletingStorage(){
    video(42);when(storage.uploadedParts("source","upload")).thenReturn(List.of(Part.builder().partNumber(1).size(41L).eTag("one").build()));
    assertThatThrownBy(()->service.complete(id,jwt)).hasMessageContaining("unexpected size");verify(storage,never()).finishMultipart(anyString(),anyString(),anyList());
  }
  @Test void recoversWhenStorageCompletedButItsResponseWasLost(){
    var video=video(42);when(storage.uploadedParts("source","upload")).thenThrow(S3Exception.builder().statusCode(404).awsErrorDetails(AwsErrorDetails.builder().errorCode("NoSuchUpload").build()).build());
    assertThat(service.begin(id,jwt).parts()).isEmpty();verify(videos).complete(id,jwt);assertThat(video.getMultipartUploadId()).isNull();
  }
}
