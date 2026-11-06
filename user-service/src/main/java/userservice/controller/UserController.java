package userservice.controller;

import userservice.service.UserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class UserController {

    public record LoginRequest(@NotBlank(message = "Username is required") String username,
                               @NotBlank(message = "Password is required") String password) {}

    public record RegisterRequest(
            @NotBlank(message = "Username is required")
            @Size(min = 3, max = 30, message = "Username must be 3 to 30 characters")
            @Pattern(regexp = "^[a-zA-Z0-9_.]*$", message = "Username can contain only letters, numbers, dots and underscores")
            String username,
            @NotBlank(message = "Password is required")
            @Size(min = 6, max = 72, message = "Password must be 6 to 72 characters")
            String password) {}

    public record AuthResponse(String token, String username, String role) {}

    private final UserService userService;

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return userService.login(request);
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public void register(@Valid @RequestBody RegisterRequest request) { userService.register(request); }

    @GetMapping("/users")
    public List<UserService.UserSummary> getUsers() { return userService.getUsers(); }

}