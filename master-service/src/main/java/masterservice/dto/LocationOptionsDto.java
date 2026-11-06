package masterservice.dto;

import java.util.List;

public record LocationOptionsDto(
        List<DropdownOptionsDto.DropdownOptionDto> regions,
        List<DropdownOptionsDto.DropdownOptionDto> countries
) implements java.io.Serializable {}