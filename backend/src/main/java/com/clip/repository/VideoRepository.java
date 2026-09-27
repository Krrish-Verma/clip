package com.clip.repository;
import com.clip.domain.Video;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
public interface VideoRepository extends JpaRepository<Video, UUID> {
  List<Video> findAllByOwnerIdOrderByCreatedAtDesc(UUID ownerId);
  Optional<Video> findByIdAndOwnerId(UUID id, UUID ownerId);
  long countByOwnerId(UUID ownerId);
  @Query("select coalesce(sum(v.declaredSizeBytes),0) from Video v where v.owner.id=:ownerId") long totalDeclaredBytes(@Param("ownerId") UUID ownerId);
  List<Video> findByStatusAndCreatedAtBefore(Video.Status status, Instant cutoff);
}
