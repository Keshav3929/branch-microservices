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

@Service
public class ExcelService {

    public byte[] generateTemplate(ExcelTemplateRequestDto request) throws IOException {
        String sheetName = request.sheetName();
        WorkbookUtil.validateSheetName(sheetName);

        try (Workbook workbook = new XSSFWorkbook();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {

            Sheet sheet = workbook.createSheet(sheetName);
            Row headerRow = sheet.createRow(0);

            CellStyle style = workbook.createCellStyle();
            Font font = workbook.createFont();
            font.setBold(true);
            style.setFont(font);

            for (int i = 0; i < request.headers().size(); i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(request.headers().get(i));
                cell.setCellStyle(style);
                sheet.setColumnWidth(i, 20 * 256);
            }
            sheet.createFreezePane(0, 1);
            workbook.write(output);
            return output.toByteArray();
        }
    }
}