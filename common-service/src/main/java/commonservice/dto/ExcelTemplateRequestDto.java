package commonservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ExcelTemplateRequestDto(
        @NotBlank
        @Size(max = 31)
        String sheetName,

        @NotEmpty
        List<@NotBlank String> headers
) {}