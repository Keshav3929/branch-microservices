package branchmaster.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

@Component
@RequiredArgsConstructor
public class AuthenticationFilter extends OncePerRequestFilter {

    @Value("${app.gateway.internal-key}")
    private String internalKey;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain chain) throws ServletException, IOException {

        String gatewayKey = request.getHeader("X-Gateway-Key");

        if (gatewayKey != null && MessageDigest.isEqual(
                internalKey.getBytes(StandardCharsets.UTF_8),
                gatewayKey.getBytes(StandardCharsets.UTF_8))) {

            try {
                String id = request.getHeader("X-User-Id");
                String username = request.getHeader("X-Username");
                String role = request.getHeader("X-User-Role");

                if (id != null && username != null && !username.isBlank()
                        && role != null && !role.isBlank()) {

                    var authentication = new UsernamePasswordAuthenticationToken(
                            username,
                            null,
                            List.of(new SimpleGrantedAuthority(role))
                    );

                    authentication.setDetails(Long.parseLong(id));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            } catch (NumberFormatException ex) { SecurityContextHolder.clearContext(); }
        }
        chain.doFilter(request, response);
    }
}