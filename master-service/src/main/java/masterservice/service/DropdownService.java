package masterservice.service;

import masterservice.dto.AddressOptionsDto;
import masterservice.dto.ContactOptionsDto;
import masterservice.dto.DropdownOptionsDto.DropdownOptionDto;
import masterservice.dto.LocationOptionsDto;
import masterservice.dto.OrganizationOptionsDto;
import masterservice.entity.BranchType;
import masterservice.repository.BranchTypeRepository;
import masterservice.repository.CityRepository;
import masterservice.repository.ContactPersonRepository;
import masterservice.repository.CountryRepository;
import masterservice.repository.OrganizationRepository;
import masterservice.repository.RegionRepository;
import masterservice.repository.StateRepository;
import masterservice.repository.WorkingHoursRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DropdownService {

    private final OrganizationRepository organizationRepository;
    private final BranchTypeRepository branchTypeRepository;
    private final RegionRepository regionRepository;
    private final CountryRepository countryRepository;
    private final StateRepository stateRepository;
    private final CityRepository cityRepository;
    private final ContactPersonRepository contactPersonRepository;
    private final WorkingHoursRepository workingHoursRepository;

    @Cacheable("organizations")
    public OrganizationOptionsDto getOrganizations() {
        return new OrganizationOptionsDto(
                organizationRepository.findByActiveTrue().stream()
                        .map(o -> new DropdownOptionDto(o.getId(), o.getName()))
                        .toList(),
                branchTypeRepository.findAll().stream()
                        .map(BranchType::getName)
                        .toList()
        );
    }

    @Cacheable("locations")
    public LocationOptionsDto getLocations() {
        return new LocationOptionsDto(
                regionRepository.findAll().stream()
                        .map(r -> new DropdownOptionDto(r.getId(), r.getName()))
                        .toList(),
                countryRepository.findAll().stream()
                        .map(c -> new DropdownOptionDto(c.getId(), c.getName()))
                        .toList()
        );
    }

    @Cacheable("addresses")
    public AddressOptionsDto getAddresses() {
        return new AddressOptionsDto(
                stateRepository.findAll().stream()
                        .map(s -> new DropdownOptionDto(s.getId(), s.getName()))
                        .toList(),
                cityRepository.findAll().stream()
                        .map(c -> new DropdownOptionDto(c.getId(), c.getName()))
                        .toList()
        );
    }

    @Cacheable("contacts")
    public ContactOptionsDto getContacts() {
        return new ContactOptionsDto(
                contactPersonRepository.findAll().stream()
                        .map(c -> new DropdownOptionDto(c.getId(), c.getName()))
                        .toList(),
                workingHoursRepository.findAll().stream()
                        .map(w -> new DropdownOptionDto(w.getId(), w.getName()))
                        .toList()
        );
    }
}