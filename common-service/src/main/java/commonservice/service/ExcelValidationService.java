package commonservice.service;

import commonservice.dto.ExcelValidationResponseDto;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class ExcelValidationService {

    private final long maxFileSize;

    public ExcelValidationService(
            @Value("${common.excel.max-file-size:20971520}") long maxFileSize) {
        this.maxFileSize = maxFileSize;
    }

    public ExcelValidationResponseDto validateFile(
            MultipartFile file, boolean requireDataRows, List<String> requiredHeaders) {

        List<String> errors = new ArrayList<>();
        List<String> headers = new ArrayList<>();

        if (file == null || file.isEmpty()) { errors.add("Excel file is empty");
            return new ExcelValidationResponseDto(false, errors, headers, 0);
        }
        if (file.getSize() > maxFileSize) {
            errors.add("Excel file must not exceed " + (maxFileSize / (1024 * 1024)) + " MB");
        }
        String filename = file.getOriginalFilename();
        if (filename == null || !filename.toLowerCase(Locale.ROOT).endsWith(".xlsx")) {
            errors.add("Only XLSX files are allowed");
        }
        if (!errors.isEmpty()) {
            return new ExcelValidationResponseDto(false, errors, headers, 0);
        }
        try (Workbook workbook = new XSSFWorkbook(file.getInputStream())) {
            if (workbook.getNumberOfSheets() == 0) { errors.add("Excel workbook contains no sheets");
                return new ExcelValidationResponseDto(false, errors, headers, 0);
            }
            Sheet sheet = workbook.getSheetAt(0);
            DataFormatter formatter = new DataFormatter();

            int headerRowIndex = isRequirementRow(sheet.getRow(0), formatter) ? 1 : 0;
            Row headerRow = sheet.getRow(headerRowIndex);

            if (headerRow == null) { errors.add("Excel header row is missing");
                return new ExcelValidationResponseDto(false, errors, headers, 0);
            }
            if (headerRow.getLastCellNum() <= 0) { errors.add("Excel headers are missing");
                return new ExcelValidationResponseDto(false, errors, headers, 0);
            }
            Set<String> uniqueHeaders = new HashSet<>();

            for (int i = 0; i < headerRow.getLastCellNum(); i++) {
                Cell cell = headerRow.getCell(i, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                String header = cell == null ? "" : formatter.formatCellValue(cell).trim();

                if (header.isEmpty()) { errors.add("Column " + (i + 1) + " has an empty header");
                    continue;
                }
                headers.add(header);
                if (!uniqueHeaders.add(normalizeHeader(header))) { errors.add("Duplicate column header: " + header); }
            }

            Set<String> actualHeaders = new HashSet<>();
            headers.forEach(header -> actualHeaders.add(normalizeHeader(header)));

            if (requiredHeaders != null) {
                requiredHeaders.stream()
                        .filter(header -> header != null && !header.isBlank())
                        .filter(header -> !actualHeaders.contains(normalizeHeader(header)))
                        .forEach(header -> errors.add("Missing required header: " + header));
            }
            int dataRows = 0;

            for (int i = headerRowIndex + 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row != null && hasData(row, formatter)) { dataRows++; }
            }
            if (dataRows == 0 && requireDataRows) { errors.add("Excel file contains no data rows"); }
            return new ExcelValidationResponseDto(errors.isEmpty(), errors, headers, dataRows);
        } catch (IOException | RuntimeException e) { errors.add("Invalid or corrupted XLSX file");
            return new ExcelValidationResponseDto(false, errors, headers, 0);
        }
    }

    private String normalizeHeader(String header) {
        return header.replace("*", "").trim().toLowerCase(Locale.ROOT);
    }

    private boolean isRequirementRow(Row row, DataFormatter formatter) {
        if (row == null) return false;
        boolean found = false;
        for (Cell cell : row) {
            String value = formatter.formatCellValue(cell).trim();
            if (value.isEmpty()) continue;
            if (!value.equalsIgnoreCase("Mandatory") && !value.equalsIgnoreCase("Optional")) {
                return false;
            } found = true;
        }
        return found;
    }

    private boolean hasData(Row row, DataFormatter formatter) {
        for (Cell cell : row) {
            if (!formatter.formatCellValue(cell).isBlank()) { return true; }
        }
        return false;
    }
}