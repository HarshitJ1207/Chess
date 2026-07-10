package com.example.chess.matchmaking.client;

import com.example.chess.matchmaking.dto.RatingResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "rating-service")
public interface RatingClient {

    @GetMapping("/api/ratings/{username}")
    RatingResponse getRating(@PathVariable("username") String username);
}
