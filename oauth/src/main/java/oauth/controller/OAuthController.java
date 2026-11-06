
package oauth.controller;

import lombok.RequiredArgsConstructor;
import oauth.service.JwtService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/oauth")
@RequiredArgsConstructor
public class OAuthController {

    private final JwtService jwtService;

    public record TokenRequest(Long id, String username, String role) {}
    public record TokenResponse(String token) {}
    public record ValidationResponse(Long id, String username, String role) {}

    @PostMapping("/token")
    public TokenResponse generateToken(@RequestBody TokenRequest request) {
        return new TokenResponse(
                jwtService.generateToken(
                        request.id(),
                        request.username(),
                        request.role()
                )
        );
    }

    @PostMapping("/validate")
    public ValidationResponse validateToken(
            @RequestHeader("Authorization") String header) {
        if (header == null || !header.startsWith("Bearer ") || header.length() == 7) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        String token = header.substring(7);
        if (!jwtService.isValid(token)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return new ValidationResponse(
                jwtService.extractId(token),
                jwtService.extractUsername(token),
                jwtService.extractRole(token)
        );
    }
}
