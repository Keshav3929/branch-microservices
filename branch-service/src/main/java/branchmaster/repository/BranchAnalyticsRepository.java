package branchmaster.repository;

import branchmaster.dto.BranchSearchRequestDto;

import java.util.List;

public interface BranchAnalyticsRepository {

    AnalyticsData getAnalytics(BranchSearchRequestDto filters);

    List<CreationData> getCreationTrends(
            BranchSearchRequestDto filters,
            String granularity
    );

    record AnalyticsData(
            long total,
            long active,
            long inactive,
            List<RegionData> regions,
            List<TypeData> types,
            List<OrganizationData> organizations,
            List<CreationData> creationTrends
    ) {
    }

    record RegionData(Long regionId, long active, long inactive) {
    }

    record TypeData(String branchType, long count) {
    }

    record OrganizationData(Long organizationId, long count) {
    }

    record CreationData(String date, long count) {
    }
}
