package com.clip.repository;
import com.clip.domain.ProcessingJob;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
public interface ProcessingJobRepository extends JpaRepository<ProcessingJob, UUID> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select j from ProcessingJob j where j.id=:id")
  Optional<ProcessingJob> findLockedById(@Param("id") UUID id);
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  Optional<ProcessingJob> findByVideoId(UUID videoId);
  @Query(value = "SELECT * FROM processing_jobs WHERE state='QUEUED' AND next_attempt_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1", nativeQuery = true)
  Optional<ProcessingJob> findNextForUpdate();
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  List<ProcessingJob> findByStateAndLockedAtBefore(ProcessingJob.State state, Instant cutoff);
}
