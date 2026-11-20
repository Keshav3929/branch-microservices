package branchmaster.dto;

import java.io.Serializable;
import java.util.List;

public record CreationTrendsDto(
        String granularity,
        List<TrendPoint> trends
) implements Serializable {

    public record TrendPoint(
            String period,
            long count
    ) implements Serializable {}
}