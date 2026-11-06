package branchmaster.gateway.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "oauth")
public interface OAuthClient {

    @PostMapping("/oauth/validate")
    ValidationResponse validateToken(
            @RequestHeader("X-Service-Key") String serviceKey,
            @RequestHeader("Authorization") String token);

    record ValidationResponse(Long id, String username, String role) {}
}