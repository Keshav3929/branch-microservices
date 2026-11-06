package branchmaster.dto;

import java.util.List;

public record DropdownOptionsDto(
        List<DropdownOptionDto> organizations,
        List<String> branchTypes,
        List<DropdownOptionDto> regions,
        List<DropdownOptionDto> countries,
        List<DropdownOptionDto> states,
        List<DropdownOptionDto> cities,
        List<DropdownOptionDto> contactPersons,
        List<DropdownOptionDto> workingHours
) {
    public record DropdownOptionDto(Long id, String name) {}

    public record Organizations(
            List<DropdownOptionDto> organizations,
            List<String> branchTypes
    ) {}

    public record Locations(
            List<DropdownOptionDto> regions,
            List<DropdownOptionDto> countries
    ) {}

    public record Addresses(
            List<DropdownOptionDto> states,
            List<DropdownOptionDto> cities
    ) {}

    public record Contacts(
            List<DropdownOptionDto> contactPersons,
            List<DropdownOptionDto> workingHours
    ) {}
}