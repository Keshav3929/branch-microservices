package branchmaster.client;

import branchmaster.dto.DropdownOptionsDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;

@FeignClient(name = "MASTER-SERVICE")
public interface DropdownClient {

    @GetMapping("/dropdown/organizations")
    DropdownOptionsDto.Organizations getOrganizations();

    @GetMapping("/dropdown/locations")
    DropdownOptionsDto.Locations getLocations();

    @GetMapping("/dropdown/addresses")
    DropdownOptionsDto.Addresses getAddresses();

    @GetMapping("/dropdown/contacts")
    DropdownOptionsDto.Contacts getContacts();
}