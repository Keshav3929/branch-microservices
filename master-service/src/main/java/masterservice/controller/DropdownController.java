package masterservice.controller;

import masterservice.dto.AddressOptionsDto;
import masterservice.dto.ContactOptionsDto;
import masterservice.dto.LocationOptionsDto;
import masterservice.dto.OrganizationOptionsDto;
import masterservice.service.DropdownService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class DropdownController {

    private final DropdownService dropdownService;

    @GetMapping("/dropdown/organizations")
    public OrganizationOptionsDto getOrganizations() {
        return dropdownService.getOrganizations();
    }

    @GetMapping("/dropdown/locations")
    public LocationOptionsDto getLocations() {
        return dropdownService.getLocations();
    }

    @GetMapping("/dropdown/addresses")
    public AddressOptionsDto getAddresses() {
        return dropdownService.getAddresses();
    }

    @GetMapping("/dropdown/contacts")
    public ContactOptionsDto getContacts() {
        return dropdownService.getContacts();
    }
}