package branchmaster.service;

import branchmaster.client.DropdownClient;
import branchmaster.dto.BranchAnalyticsDto;
import branchmaster.dto.BranchHistoryDto;
import branchmaster.dto.BranchImportRowValidationDto;
import branchmaster.dto.BranchRequestDto;
import branchmaster.dto.BranchResponseDto;
import branchmaster.dto.BranchSearchRequestDto;
import branchmaster.dto.CreationTrendsDto;
import branchmaster.dto.DropdownOptionsDto;
import branchmaster.entity.Branch;
import branchmaster.exception.BranchException;
import branchmaster.repository.BranchAnalyticsRepository;
import branchmaster.repository.BranchRepository;
import branchmaster.repository.BranchSpecification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.cache.annotation.CacheEvict;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@RequiredArgsConstructor
@Service
public class BranchService {

    private final BranchRepository branchRepository;
    private final BranchHistoryService branchHistoryService;
    private final BranchExcelService branchExcelService;
    private final EmailNotificationService emailNotificationService;
    private final NotificationService notificationService;
    private final DropdownClient dropdownClient;

    private Branch getBranch(Long id) {
        return branchRepository.findById(id).orElseThrow(() -> new BranchException(BranchException.Type.NOT_FOUND));
    }

    private <T> T copy(Object source, T target) {
        BeanUtils.copyProperties(source, target);
        return target;
    }

    private BranchResponseDto toResponse(Branch branch) {
        return copy(branch, new BranchResponseDto());
    }

    public Map<String, Long> counts(BranchSearchRequestDto r) {
        BranchSearchRequestDto scope = new BranchSearchRequestDto();
        scope.setCreatedDateFrom(r.getCreatedDateFrom());
        scope.setCreatedDateTo(r.getCreatedDateTo());
        long total = branchRepository.count(BranchSpecification.search(scope));
        scope.setStatus(true);
        long active = branchRepository.count(BranchSpecification.search(scope));
        return Map.of("total", total, "active", active, "inactive", total - active);
    }

    public CreationTrendsDto getCreationTrends(String granularity, BranchSearchRequestDto filters) {
        filters = filters == null ? new BranchSearchRequestDto() : filters;
        LocalDate createdDateFrom = filters.getCreatedDateFrom();
        LocalDate createdDateTo = filters.getCreatedDateTo();
        if (createdDateFrom != null && createdDateTo != null && createdDateFrom.isAfter(createdDateTo)) {
            throw new BranchException(BranchException.Type.INVALID_DATE_RANGE);
        }

        String normalizedGranularity = granularity == null
                ? ""
                : granularity.trim().toLowerCase(Locale.ROOT);

        if (!List.of("daily", "weekly", "monthly", "yearly").contains(normalizedGranularity)) {
            throw new BranchException(BranchException.Type.INVALID_GRANULARITY);
        }

        List<BranchAnalyticsRepository.CreationData> results = branchRepository.getCreationTrends(filters, normalizedGranularity);

        List<CreationTrendsDto.TrendPoint> trends = results.stream()
                .map(row -> new CreationTrendsDto.TrendPoint(row.date(), row.count())).toList();
        return new CreationTrendsDto(normalizedGranularity, trends);
    }

    private void notifyChange(Branch saved, String operation) {
        BranchResponseDto details = toResponse(saved);
        log.info("Registering notification: {} - {}", operation, details.getBranchCode());
        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        log.info("Branch transaction committed: {}", details.getBranchCode());
                        try {
                            notificationService.record(operation, details);
                            log.info("Notification recorded: {} - {}", operation, details.getBranchCode());
                        } catch (Exception e) {
                            log.error("Failed to record notification for branch {}", details.getBranchCode(), e);
                        }
                        try {
                            emailNotificationService.sendNotification(operation, details);
                        } catch (Exception e) {
                            log.error("Failed to send email notification for branch {}", details.getBranchCode(), e);
                        }
                    }
                }
        );
    }

    @CacheEvict(cacheNames = "branchAnalytics", allEntries = true)
    @Transactional
    public List<BranchResponseDto> save(List<BranchRequestDto> requests) {

        BranchImportRowValidationDto result = branchExcelService.validateMultiple(requests);

        if (!result.getInvalidRows().isEmpty()) {
            throw new BranchException(result);
        }
        return requests.stream().map(request -> {
            boolean isNew = request.getId() == null;
            Branch branch = isNew ? new Branch() : getBranch(request.getId());
            boolean wasActive = !isNew && branch.isStatus();

            if (isNew) copy(request, branch);
            else BeanUtils.copyProperties(request, branch,
                    "id", "createdAt", "createdBy", "updatedAt", "updatedBy", "isDeleted");

            branch.setDeleted(!branch.isStatus());

            Branch saved = branchRepository.saveAndFlush(branch);

            String operation = isNew ? "CREATE" :
                    wasActive == saved.isStatus() ? "UPDATE" :
                    saved.isStatus() ? "ACTIVATE" : "DEACTIVATE";

            branchHistoryService.saveHistory(saved, operation);
            notifyChange(saved, operation);

            return toResponse(saved);
        }).toList();
    }

    @CacheEvict(cacheNames = "branchAnalytics", allEntries = true)
    @Transactional
    public String deleteById(Long id) {
        Branch branch = getBranch(id);
        branch.setStatus(false);
        branch.setDeleted(true);

        Branch saved = branchRepository.saveAndFlush(branch);
        branchHistoryService.saveHistory(saved, "DELETE");
        notifyChange(saved, "DELETE");
        return "Branch deactivated successfully";
    }

    public Page<BranchResponseDto> search(BranchSearchRequestDto request, Pageable pageable) {
        return branchRepository.findAll(BranchSpecification.search(request), pageable).map(this::toResponse);
    }

    public List<BranchHistoryDto> getHistory(Long branchId) {
        return branchHistoryService.getHistory(branchId);
    }

    public BranchAnalyticsDto getAnalytics(BranchSearchRequestDto filters) {
        var data = branchRepository.getAnalytics(new BranchSearchRequestDto());
        var locations = dropdownClient.getLocations();
        var organizationsData = dropdownClient.getOrganizations();
        var regionNames = locations.regions().stream().collect(Collectors.toMap(DropdownOptionsDto.DropdownOptionDto::id, DropdownOptionsDto.DropdownOptionDto::name));
        var organizationNames = organizationsData.organizations().stream().collect(Collectors.toMap(DropdownOptionsDto.DropdownOptionDto::id, DropdownOptionsDto.DropdownOptionDto::name));
        var regions = data.regions().stream().map(row -> new BranchAnalyticsDto.RegionStats(
                regionNames.getOrDefault(row.regionId(), "Unknown"),
                row.active(), row.inactive())).toList();
        var types = data.types().stream().map(row -> new BranchAnalyticsDto.TypeStats(
                row.branchType(), row.count())).toList();
        var organizationStats = data.organizations().stream().map(row -> new BranchAnalyticsDto.OrganizationStats(
                organizationNames.getOrDefault(row.organizationId(), "Unknown"),
                row.count())).toList();
        var creationTrends = data.creationTrends().stream().map(row -> new BranchAnalyticsDto.CreationStats(
                row.date(), row.count())).toList();
        return new BranchAnalyticsDto(data.total(), data.active(), data.inactive(), regions, types, organizationStats, creationTrends);
    }
}