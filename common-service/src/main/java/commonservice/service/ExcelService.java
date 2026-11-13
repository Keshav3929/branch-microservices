package commonservice.service;

import commonservice.dto.ExcelTemplateRequestDto;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.WorkbookUtil;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Locale;

@Service
public class ExcelService {

    private static final List<String> BRANCH_HEADERS = List.of(
            "Branch Code*", "Branch Name*", "Communication Name",
            "Organization*", "Branch Type*", "Region*", "Country*", "State*", "City*", "Area", "Zip Code",
            "Address Line 1*", "Address Line 2", "Latitude", "Longitude", "Contact Person",
            "Mobile Number", "Telephone", "Email ID", "Working Days", "Working Hours", "Departments",
            "Services", "Status*", "Branch Logo", "Supporting Documents", "Remarks"
    );

    public byte[] generateTemplate(ExcelTemplateRequestDto request)
            throws IOException {

        String sheetName;
        List<String> headers;

        if (request.templateType().trim().toUpperCase(Locale.ROOT).equals("BRANCH")) {
            sheetName = "Branch Template";
            headers = BRANCH_HEADERS;
        } else {
            throw new IllegalArgumentException( "Unsupported Excel template type: " + request.templateType() );
        }

        WorkbookUtil.validateSheetName(sheetName);

        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet(sheetName);
            Row headerRow = sheet.createRow(0);

            CellStyle style = workbook.createCellStyle();
            Font font = workbook.createFont();
            font.setBold(true);
            style.setFont(font);

            for (int i = 0; i < headers.size(); i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers.get(i));
                cell.setCellStyle(style);
                sheet.setColumnWidth(i, 20 * 256);
            }
            sheet.createFreezePane(0, 1);
            workbook.write(output);
            return output.toByteArray();
        }
    }
}