package commonservice.dto;

import jakarta.validation.constraints.NotBlank;

public record ExcelTemplateRequestDto(
        @NotBlank
        String templateType
) {}