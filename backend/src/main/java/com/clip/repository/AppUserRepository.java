package com.clip.repository;
import com.clip.domain.AppUser;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
public interface AppUserRepository extends JpaRepository<AppUser, UUID> {
  Optional<AppUser> findByClerkUserId(String id);
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select u from AppUser u where u.clerkUserId = :id")
  Optional<AppUser> findLockedByClerkUserId(@Param("id") String id);
}
