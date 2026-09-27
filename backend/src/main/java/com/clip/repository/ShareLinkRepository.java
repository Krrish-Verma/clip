package com.clip.repository;
import com.clip.domain.ShareLink;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface ShareLinkRepository extends JpaRepository<ShareLink, UUID> {
  Optional<ShareLink> findByVideoId(UUID videoId);
  Optional<ShareLink> findByTokenHashAndRevokedAtIsNull(String tokenHash);
}
