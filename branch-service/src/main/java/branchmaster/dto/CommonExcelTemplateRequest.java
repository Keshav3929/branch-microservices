package branchmaster.dto;

import java.util.List;

public record CommonExcelTemplateRequest(
        String sheetName,
        List<String> headers
) {}