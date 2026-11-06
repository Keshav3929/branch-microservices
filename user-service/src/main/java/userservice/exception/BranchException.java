package userservice.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
public class BranchException extends RuntimeException {

    @Getter
    @RequiredArgsConstructor
    public enum Type {
        USERNAME_EXISTS("Username is already taken", HttpStatus.CONFLICT, "username"),
        USER_NOT_FOUND("No account found for this username. Please register.", HttpStatus.NOT_FOUND, "username"),
        WRONG_PASSWORD("Password is incorrect", HttpStatus.UNAUTHORIZED, "password"),
        ACCOUNT_INACTIVE("Your account is inactive", HttpStatus.FORBIDDEN, "account");

        private final String message;
        private final HttpStatus status;
        private final String field;
    }

    private final HttpStatus status;
    private final String field;

    public BranchException(Type type) {
        super(type.getMessage());
        this.status = type.getStatus();
        this.field = type.getField();
    }
}
