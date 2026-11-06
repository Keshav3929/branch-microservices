package branchmaster.gateway.security;

import branchmaster.gateway.client.OAuthClient;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;

import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.Map;

public class UserRequestWrapper extends HttpServletRequestWrapper {

    private final Map<String, String> headers = new LinkedHashMap<>();

    public UserRequestWrapper(
            HttpServletRequest request,
            OAuthClient.ValidationResponse user,
            String internalKey) {

        super(request);

        Enumeration<String> names = request.getHeaderNames();

        while (names != null && names.hasMoreElements()) {
            String name = names.nextElement();

            if (!name.equalsIgnoreCase("X-Gateway-Key")
                    && !name.equalsIgnoreCase("X-User-Id")
                    && !name.equalsIgnoreCase("X-Username")
                    && !name.equalsIgnoreCase("X-User-Role")) {
                headers.put(name, request.getHeader(name));
            }
        }
        headers.put("X-Gateway-Key", internalKey);
        headers.put("X-User-Id", String.valueOf(user.id()));
        headers.put("X-Username", user.username());
        headers.put("X-User-Role", user.role());
    }

    @Override
    public String getHeader(String name) {
        return headers.entrySet().stream()
                .filter(entry -> entry.getKey().equalsIgnoreCase(name))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);
    }

    @Override
    public Enumeration<String> getHeaders(String name) {
        String value = getHeader(name);
        return value == null
                ? Collections.emptyEnumeration()
                : Collections.enumeration(Collections.singletonList(value));
    }

    @Override
    public Enumeration<String> getHeaderNames() {
        return Collections.enumeration(headers.keySet());
    }
}