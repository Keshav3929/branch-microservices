package branchmaster.dto;

import java.io.Serializable;
import java.util.List;

public record BranchAnalyticsDto(
        long total,
        long active,
        long inactive,
        List<RegionStats> branchesByRegion,
        List<TypeStats> branchesByType,
        List<OrganizationStats> branchesByOrganization,
        List<CreationStats> creationTrends
) implements Serializable {

    public record RegionStats(String name, long active, long inactive) implements Serializable {}
    public record TypeStats(String name, long count) implements Serializable {}
    public record OrganizationStats(String name, long count) implements Serializable {}
    public record CreationStats(String date, long count) implements Serializable {}
}