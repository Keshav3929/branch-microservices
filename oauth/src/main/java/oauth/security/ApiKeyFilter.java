package oauth.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.security.MessageDigest;
import java.util.Set;

@Component
public class ApiKeyFilter extends OncePerRequestFilter {

    private final String serviceKey;

    public ApiKeyFilter(@Value("${app.service.api-key}") String serviceKey) {
        this.serviceKey = serviceKey;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain chain) throws ServletException, IOException {

        if (Set.of("/oauth/token", "/oauth/validate")
                .contains(request.getServletPath())) {
            String providedKey = request.getHeader("X-Service-Key");

            if (providedKey == null ||
                    !MessageDigest.isEqual(
                            serviceKey.getBytes(),
                            providedKey.getBytes())) {
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
                return;
            }
        }
        chain.doFilter(request, response);
    }
}