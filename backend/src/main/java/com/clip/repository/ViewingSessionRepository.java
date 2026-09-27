package com.clip.repository;
import com.clip.domain.ViewingSession;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ViewingSessionRepository extends JpaRepository<ViewingSession, UUID> {
  List<ViewingSession> findAllByVideoId(UUID videoId);
  long countByVideoId(UUID videoId);
}
