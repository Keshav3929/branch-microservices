package branchmaster.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@AllArgsConstructor
public class BranchImportRowValidationDto {

    private List<BranchImportRowDto> validRows;
    private List<BranchImportRowDto> invalidRows;

    @Getter
    @Setter
    @AllArgsConstructor
    public static class BranchImportRowDto {
        private int row;
        private BranchRequestDto data;
        private List<String> errors;
    }
}