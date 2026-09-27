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
  Optional<ProcessingJob> findByVideoId(UUID videoId);
  @Query(value = "SELECT * FROM processing_jobs WHERE state='QUEUED' AND next_attempt_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1", nativeQuery = true)
  Optional<ProcessingJob> findNextForUpdate();
  List<ProcessingJob> findByStateAndLockedAtBefore(ProcessingJob.State state, Instant cutoff);
}
