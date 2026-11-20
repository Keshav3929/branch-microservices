package branchmaster.gateway.security;

import branchmaster.gateway.client.OAuthClient;
import feign.FeignException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.NonNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final OAuthClient oauthClient;

    @Value("${app.oauth.service-key}")
    private String serviceKey;

    @Value("${app.gateway.internal-key}")
    private String internalKey;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();

        return "OPTIONS".equalsIgnoreCase(request.getMethod())
                || ("POST".equalsIgnoreCase(request.getMethod())
                && ("/auth/login".equals(path) || "/auth/register".equals(path)))
                || "/actuator/health".equals(path);
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        String token = request.getHeader(HttpHeaders.AUTHORIZATION);

        if (token == null || !token.startsWith("Bearer ") || token.length() == 7) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }

        try {
            OAuthClient.ValidationResponse user =
                    oauthClient.validateToken(serviceKey, token);

            if (user == null || user.id() == null
                    || user.username() == null || user.role() == null) {
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
                return;
            }

            var authentication = new UsernamePasswordAuthenticationToken(
                    user.username(),
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + user.role()))
            );
            authentication.setDetails(user.id());
            SecurityContextHolder.getContext().setAuthentication(authentication);

            filterChain.doFilter(
                    new UserRequestWrapper(request, user, internalKey), response);

        } catch (FeignException.Unauthorized | FeignException.Forbidden ex) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
        } catch (FeignException ex) {
            response.sendError(HttpServletResponse.SC_SERVICE_UNAVAILABLE,"Authentication service unavailable");
        }
    }
}