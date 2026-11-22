package com.clip.config;

import java.time.Instant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
  private static final org.slf4j.Logger log=org.slf4j.LoggerFactory.getLogger(ApiExceptionHandler.class);
  @ExceptionHandler(ApiProblem.class)
  ResponseEntity<Map<String, Object>> problem(ApiProblem error) {
    return ResponseEntity.status(error.status()).body(Map.of(
        "message", error.getMessage(), "status", error.status().value(), "timestamp", Instant.now()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<Map<String, Object>> validation(MethodArgumentNotValidException error) {
    String message = error.getBindingResult().getFieldErrors().stream()
        .findFirst().map(field -> field.getDefaultMessage()).orElse("Invalid request.");
    return ResponseEntity.badRequest().body(Map.of("message", message, "status", 400, "timestamp", Instant.now()));
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<Map<String, Object>> unexpected(Exception error) {
    log.error("Unexpected API exception type={} at={}",error.getClass().getName(),error.getStackTrace().length==0?"unknown":error.getStackTrace()[0]);
    return ResponseEntity.status(500).body(Map.of(
        "message", "An unexpected server error occurred.", "status", 500, "timestamp", Instant.now()));
  }

  @ExceptionHandler({org.springframework.dao.DataIntegrityViolationException.class,org.springframework.dao.OptimisticLockingFailureException.class})
  ResponseEntity<Map<String,Object>> conflict(Exception error) {
    return ResponseEntity.status(409).body(Map.of("message","This item changed. Reload and try again.","status",409,"timestamp",Instant.now()));
  }

  @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
  ResponseEntity<Map<String,Object>> malformed(Exception error) {
    return ResponseEntity.badRequest().body(Map.of("message","The request contains invalid values.","status",400,"timestamp",Instant.now()));
  }
  @ExceptionHandler(org.springframework.web.HttpMediaTypeNotSupportedException.class)
  ResponseEntity<Map<String,Object>> unsupportedMedia(Exception error){return ResponseEntity.status(415).body(Map.of("message","Use application/json for this request.","status",415,"timestamp",Instant.now()));}

  public static class ApiProblem extends RuntimeException {
    private final HttpStatus status;
    public ApiProblem(HttpStatus status, String message) { super(message); this.status = status; }
    public HttpStatus status() { return status; }
  }
}
