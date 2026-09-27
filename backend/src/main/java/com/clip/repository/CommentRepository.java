package com.clip.repository;
import com.clip.domain.Comment;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
public interface CommentRepository extends JpaRepository<Comment, UUID> { List<Comment> findAllByVideoIdOrderByCreatedAt(UUID videoId); }
