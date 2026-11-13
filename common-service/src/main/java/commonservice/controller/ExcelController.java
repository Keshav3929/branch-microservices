package commonservice.controller;

import commonservice.dto.ExcelTemplateRequestDto;
import commonservice.dto.ExcelValidationResponseDto;
import commonservice.service.ExcelService;
import commonservice.service.ExcelValidationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Locale;

@RequiredArgsConstructor
@RestController
@RequestMapping("/common/excel")
public class ExcelController {

    private static final MediaType XLSX = MediaType.parseMediaType( "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" );
    private final ExcelService excelService;
    private final ExcelValidationService validationService;

    @PostMapping("/template")
    public ResponseEntity<byte[]> generateTemplate( @Valid @RequestBody ExcelTemplateRequestDto request)
            throws IOException {
        String fileName = request.templateType().trim().toLowerCase(Locale.ROOT) + "-template.xlsx";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\"" + fileName + "\"")
                .contentType(XLSX)
                .body(excelService.generateTemplate(request));
    }

    @PostMapping(value = "/validate-file",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ExcelValidationResponseDto validateFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "true") boolean requireDataRows,
            @RequestParam(required = false) List<String> requiredHeaders) {
        return validationService.validateFile( file, requireDataRows, requiredHeaders );
    }
}