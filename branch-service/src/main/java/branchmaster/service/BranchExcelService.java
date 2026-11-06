package branchmaster.service;

import branchmaster.dto.BranchImportRowValidationDto;
import branchmaster.dto.BranchImportRowValidationDto.BranchImportRowDto;
import branchmaster.dto.BranchRequestDto;
import branchmaster.exception.BranchException;
import branchmaster.repository.BranchRepository;
import commonservice.service.CommonValidationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import branchmaster.client.CommonExcelClient;
import branchmaster.dto.CommonExcelTemplateRequest;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class BranchExcelService {

    private static final List<String> HEADERS = List.of(
            "Branch Code*", "Branch Name*", "Communication Name",
            "Organization*", "Branch Type*", "Region*", "Country*", "State*", "City*",
            "Area", "Zip Code", "Address Line 1*", "Address Line 2",
            "Latitude", "Longitude", "Contact Person", "Mobile Number", "Telephone",
            "Email ID", "Working Days", "Working Hours", "Departments", "Services",
            "Status*", "Branch Logo", "Supporting Documents", "Remarks"
    );

    private final CommonExcelClient commonExcelClient;
    private final BranchRepository branchRepository;
    private final CommonValidationService commonValidationService;

    public ResponseEntity<byte[]> downloadTemplate() {
        byte[] file = commonExcelClient.generateTemplate(
                new CommonExcelTemplateRequest("Branch Template",HEADERS));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=branch-template.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(file);
    }

    public BranchImportRowValidationDto validateMultiple(List<BranchRequestDto> requests) {
        if (requests == null || requests.isEmpty()) { throw new BranchException(BranchException.Type.INVALID_ROW); }

        List<BranchImportRowDto> valid = new ArrayList<>();
        List<BranchImportRowDto> invalid = new ArrayList<>();
        Set<String> codes = new HashSet<>();
        Set<String> names = new HashSet<>();

        for (int i = 0; i < requests.size(); i++) {
            BranchRequestDto request = requests.get(i);
            List<String> errors = new ArrayList<>();

            if (request == null) {
                errors.add("Row: Record is empty");
            } else {
                errors.addAll(commonValidationService.validate(request));
                if (errors.isEmpty()) {
                    checkDuplicates(request, codes, names, errors);
                }
            }
            (errors.isEmpty() ? valid : invalid)
                    .add(new BranchImportRowDto(i + 3, request, errors));
        }
        return new BranchImportRowValidationDto(valid, invalid);
    }

    private void checkDuplicates(
            BranchRequestDto r, Set<String> codes, Set<String> names,
            List<String> errors) {

        String code = r.getBranchCode() == null ? "" : r.getBranchCode().trim();
        String name = r.getBranchName() == null ? "" : r.getBranchName().trim();
        Long org = r.getOrganizationId();
        Long id = r.getId();
        if (!code.isEmpty()) {
            if (!codes.add(code.toLowerCase(Locale.ROOT)))
                errors.add("branchCode: Duplicate Branch Code in uploaded file");
            if (branchRepository.existsByBranchCodeAndIdNot(code, id))
                errors.add("branchCode: " + BranchException.Type.CODE_EXISTS.getMessage());
        }
        if (!name.isEmpty() && org != null) {
            if (!names.add(org + "|" + name.toLowerCase(Locale.ROOT)))
                errors.add("branchName: Duplicate Branch Name within the same Organization");
            if (branchRepository.existsByBranchNameAndOrganizationIdAndIdNot(name, org, id))
                errors.add("branchName: " + BranchException.Type.NAME_EXISTS.getMessage());
        }
    }
}