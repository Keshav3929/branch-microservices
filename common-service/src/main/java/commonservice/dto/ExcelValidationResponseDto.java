package commonservice.dto;

import java.util.List;

public record ExcelValidationResponseDto(
        boolean valid,
        List<String> errors,
        List<String> headers,
        int dataRows
) {}