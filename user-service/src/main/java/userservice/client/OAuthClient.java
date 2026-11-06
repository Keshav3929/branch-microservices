package userservice.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "oauth")
public interface OAuthClient {

    @PostMapping("/oauth/token")
    TokenResponse generateToken(
            @RequestHeader("X-Service-Key") String serviceKey,
            @RequestBody TokenRequest request);

    record TokenRequest(Long id, String username, String role) {}

    record TokenResponse(String token) {}

    @PostMapping("/oauth/validate")
    ValidationResponse validateToken(
            @RequestHeader("X-Service-Key") String serviceKey,
            @RequestHeader("Authorization") String token);

    record ValidationResponse(Long id, String username, String role) {}
}