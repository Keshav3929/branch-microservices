package masterservice.dto;

import java.util.List;

public record AddressOptionsDto(
        List<DropdownOptionsDto.DropdownOptionDto> states,
        List<DropdownOptionsDto.DropdownOptionDto> cities
) implements java.io.Serializable {}