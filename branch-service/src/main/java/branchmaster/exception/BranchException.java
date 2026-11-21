package branchmaster.exception;

import branchmaster.dto.BranchImportRowValidationDto;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

@Getter
public class BranchException extends RuntimeException {

    private final HttpStatus status;
    private final String field;
    private final BranchImportRowValidationDto result;
    public BranchException(Type type) {
        super(type.getMessage());
        this.status = type.getStatus();
        this.field = type.getField();
        this.result = null;
    }

    public BranchException(BranchImportRowValidationDto result) {
        super("Some branches are invalid");
        this.status = HttpStatus.BAD_REQUEST;
        this.field = null;
        this.result = result;
    }

    @Getter
    @RequiredArgsConstructor
    public enum Type {
        CODE_EXISTS("Branch code already exists", HttpStatus.CONFLICT, "branchCode"),
        NAME_EXISTS("Branch name already exists for this organization", HttpStatus.CONFLICT, "branchName"),
        NOT_FOUND("Branch not found", HttpStatus.NOT_FOUND, null),
        INVALID_ROW("Invalid branch data", HttpStatus.BAD_REQUEST, null),
        INVALID_DATE_RANGE("Created date from must not be after created date to", HttpStatus.BAD_REQUEST, "createdDateTo"),
        INVALID_GRANULARITY("Unsupported creation-trends granularity", HttpStatus.BAD_REQUEST, "granularity");

        private final String message;
        private final HttpStatus status;
        private final String field;
    }
}