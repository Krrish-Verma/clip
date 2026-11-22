package com.clip.service;
import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

class StudioValidationTest {
  @Test void regionsRejectNonfiniteOutsideAndInvisibleAreas(){
    for(double[] r:new double[][]{{Double.NaN,0,.2,.2},{0,Double.POSITIVE_INFINITY,.2,.2},{.9,0,.2,.2},{0,0,0,.2},{-.1,0,.2,.2}})
      assertThatThrownBy(()->StudioService.validate(r[0],r[1],r[2],r[3])).isInstanceOf(RuntimeException.class);
    StudioService.validate(0,0,1,1);
  }
  @Test void speechHighlightsFlagSensitiveTextAndOnlySuggestTimedWordCuts()throws Exception{
    var json=new ObjectMapper();
    ObjectNode result=(ObjectNode)json.readTree("{\"segments\":[{\"start\":2,\"end\":5,\"text\":\"Please email alex@example.com.\",\"words\":[{\"start\":2,\"end\":2.3,\"text\":\"um\"},{\"start\":2.4,\"end\":5,\"text\":\"please\"}]}]}");
    TranscriptService.enrich(result);
    assertThat(result.path("redactions")).hasSize(1);
    assertThat(result.path("tasks")).hasSize(1);
    assertThat(result.path("suggestedCuts")).hasSize(2);
    assertThat(result.path("summary").asText()).isEqualTo("Please email alex@example.com.");
    assertThat(result.path("highlightsMethod").asText()).isEqualTo("extractive");
  }
}
