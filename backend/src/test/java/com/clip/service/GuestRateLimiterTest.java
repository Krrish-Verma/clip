package com.clip.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.clip.config.ApiExceptionHandler.ApiProblem;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class GuestRateLimiterTest {
  @Test
  void isolatesCategoriesAndRejectsRequestsAboveTheWindowLimit() {
    GuestRateLimiter limiter = new GuestRateLimiter();
    limiter.check("comments", "127.0.0.1", 1);
    limiter.check("analytics", "127.0.0.1", 1);

    assertThatThrownBy(() -> limiter.check("comments", "127.0.0.1", 1))
        .isInstanceOf(ApiProblem.class)
        .satisfies(error ->
            org.assertj.core.api.Assertions.assertThat(((ApiProblem) error).status())
                .isEqualTo(HttpStatus.TOO_MANY_REQUESTS));
  }
}
