package branchmaster.repository;

import branchmaster.dto.BranchSearchRequestDto;
import branchmaster.entity.Branch;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class BranchAnalyticsRepositoryImpl implements BranchAnalyticsRepository {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public AnalyticsData getAnalytics(BranchSearchRequestDto filters) {
        if (filters == null) {
            filters = new BranchSearchRequestDto();
        }

        long[] counts = getCounts(filters);

        return new AnalyticsData(
                counts[0],
                counts[1],
                counts[2],
                getRegions(filters),
                getTypes(filters),
                getOrganizations(filters),
                getCreationTrends(filters)
        );
    }

    @Override
    public List<CreationData> getCreationTrends(
            BranchSearchRequestDto filters,
            String granularity
    ) {
        filters = filters == null ? new BranchSearchRequestDto() : filters;
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Tuple> query = cb.createTupleQuery();
        Root<Branch> root = query.from(Branch.class);

        var date = root.get("createdAt");

        var period = switch (granularity.toLowerCase(java.util.Locale.ROOT)) {
            case "yearly" -> cb.function("DATE_FORMAT", String.class, date, cb.literal("%Y"));
            case "monthly" -> cb.function("DATE_FORMAT", String.class, date, cb.literal("%Y-%m"));
            case "weekly" -> cb.concat(
                    cb.function("DATE_FORMAT", String.class, date, cb.literal("%x")),
                    cb.concat("-W", cb.function("DATE_FORMAT", String.class, date, cb.literal("%v")))
            );
            case "daily" -> cb.function("DATE_FORMAT", String.class, date, cb.literal("%Y-%m-%d"));
            default -> throw new IllegalArgumentException("Invalid granularity: " + granularity);
        };
        query.select(cb.tuple(period.alias("date"), cb.count(root).alias("count")));
        query.where(cb.and(getPredicate(filters, root, query, cb), cb.isNotNull(date)));
        query.groupBy(period);
        query.orderBy(cb.asc(period));

        return entityManager.createQuery(query).getResultList().stream()
                .map(row -> new CreationData(row.get("date", String.class), row.get("count", Long.class))).toList();
    }

    private List<CreationData> getCreationTrends(BranchSearchRequestDto filters) {
        return getCreationTrends(filters, "daily");
    }

    private long[] getCounts(BranchSearchRequestDto filters) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Tuple> query = cb.createTupleQuery();
        Root<Branch> root = query.from(Branch.class);

        query.select(cb.tuple(
                        cb.count(root).alias("total"),
                        cb.coalesce(
                                cb.sum(cb.<Long>selectCase()
                                        .when(cb.isTrue(root.get("status")), 1L)
                                        .otherwise(0L)), 0L
                        ).alias("active"),

                        cb.coalesce(
                                cb.sum(cb.<Long>selectCase()
                                        .when(cb.isFalse(root.get("status")), 1L)
                                        .otherwise(0L)), 0L
                        ).alias("inactive")
                )
        );

        query.where(getPredicate(filters, root, query, cb));
        Tuple result = entityManager.createQuery(query).getSingleResult();

        return new long[]{
                result.get("total", Long.class),
                result.get("active", Long.class),
                result.get("inactive", Long.class)
        };
    }

    private List<RegionData> getRegions(BranchSearchRequestDto filters) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Tuple> query = cb.createTupleQuery();
        Root<Branch> root = query.from(Branch.class);

        query.select(cb.tuple(
                        root.get("regionId").alias("regionId"),
                        cb.sum(cb.<Long>selectCase()
                                .when(cb.isTrue(root.get("status")), 1L)
                                .otherwise(0L)).alias("active"),
                        cb.sum(cb.<Long>selectCase()
                                .when(cb.isFalse(root.get("status")), 1L)
                                .otherwise(0L)).alias("inactive")
                )
        );

        query.where(getPredicate(filters, root, query, cb));
        query.groupBy(root.get("regionId"));

        return entityManager.createQuery(query).getResultList().stream()
                .map(row -> new RegionData(
                        row.get("regionId", Long.class),
                        row.get("active", Long.class),
                        row.get("inactive", Long.class)
                )).toList();
    }

    private List<TypeData> getTypes(BranchSearchRequestDto filters) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Tuple> query = cb.createTupleQuery();
        Root<Branch> root = query.from(Branch.class);

        query.select(cb.tuple(root.get("branchType").alias("branchType"), cb.count(root).alias("count")));
        query.where(getPredicate(filters, root, query, cb));
        query.groupBy(root.get("branchType"));

        return entityManager.createQuery(query).getResultList().stream()
                .map(row -> new TypeData(row.get("branchType", String.class), row.get("count", Long.class))).toList();
    }

    private List<OrganizationData> getOrganizations(BranchSearchRequestDto filters) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Tuple> query = cb.createTupleQuery();
        Root<Branch> root = query.from(Branch.class);

        query.select(cb.tuple(
                        root.get("organizationId").alias("organizationId"),
                        cb.count(root).alias("count")
                )
        );

        query.where(getPredicate(filters, root, query, cb));
        query.groupBy(root.get("organizationId"));

        return entityManager.createQuery(query).getResultList().stream()
                .map(row -> new OrganizationData(row.get("organizationId", Long.class), row.get("count", Long.class))).toList();
    }

    private Predicate getPredicate(
            BranchSearchRequestDto filters,
            Root<Branch> root,
            CriteriaQuery<?> query,
            CriteriaBuilder cb
    ) {
        return BranchSpecification.search(filters).toPredicate(root, query, cb);
    }
}