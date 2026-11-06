package masterservice.dto;

import java.util.List;

public record OrganizationOptionsDto(
        List<DropdownOptionsDto.DropdownOptionDto> organizations,
        List<String> branchTypes
) implements java.io.Serializable {}