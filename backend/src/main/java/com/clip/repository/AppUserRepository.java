package com.clip.repository;
import com.clip.domain.AppUser;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface AppUserRepository extends JpaRepository<AppUser, UUID> { Optional<AppUser> findByClerkUserId(String id); }
