package userservice.service;

import userservice.controller.UserController.AuthResponse;
import userservice.controller.UserController.LoginRequest;
import userservice.controller.UserController.RegisterRequest;
import userservice.entity.AppUser;
import userservice.exception.BranchException;
import userservice.repository.UserRepository;
import userservice.client.OAuthClient;
import org.springframework.beans.factory.annotation.Value;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final OAuthClient oauthClient;

    @Value("${app.oauth.service-key}")
    private String serviceKey;
    private final UserRepository users;
    private final PasswordEncoder encoder;
    public record UserSummary(Long id, String username) {}


    public AuthResponse login(LoginRequest request) {
        AppUser user = users.findByUsername(request.username().trim())
                .orElseThrow(() -> new BranchException(BranchException.Type.USER_NOT_FOUND));

        if (!encoder.matches(request.password(), user.getPassword())) throw new BranchException(BranchException.Type.WRONG_PASSWORD);
        if (user.getStatus() != AppUser.Status.ACTIVE) throw new BranchException(BranchException.Type.ACCOUNT_INACTIVE);
        var response = oauthClient.generateToken( serviceKey,
                new OAuthClient.TokenRequest( user.getId(), user.getUsername(),"ROLE_" + user.getRole() ));
        return new AuthResponse(
                response.token(),
                user.getUsername(),
                user.getRole().name()
        );
    }

    public void register(RegisterRequest request) {
        String username = request.username().trim();
        if (users.existsByUsername(username))
            throw new BranchException(BranchException.Type.USERNAME_EXISTS);
        AppUser user = new AppUser();
        user.setUsername(username);
        user.setPassword(encoder.encode(request.password()));
        user.setRole(AppUser.Role.USER);
        user.setStatus(AppUser.Status.ACTIVE);
        users.save(user);
    }

    public List<UserSummary> getUsers() {
        return users.findAll().stream()
                .map(user -> new UserSummary(user.getId(), user.getUsername()))
                .toList();
    }
}
