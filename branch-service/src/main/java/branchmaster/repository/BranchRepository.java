package branchmaster.repository;

import branchmaster.entity.Branch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface BranchRepository extends JpaRepository<Branch, Long>,
        JpaSpecificationExecutor<Branch> {

    boolean existsByBranchCodeAndIdNot(String branchCode, Long id);

    boolean existsByBranchNameAndOrganizationIdAndIdNot(
            String branchName, Long organizationId, Long id
    );

    @Query("""
            SELECT b.regionId AS regionId,
                   SUM(CASE WHEN b.status = true THEN 1 ELSE 0 END) AS active,
                   SUM(CASE WHEN b.status = false THEN 1 ELSE 0 END) AS inactive
            FROM Branch b
            GROUP BY b.regionId
            """)
    List<RegionStats> countByRegion();

    @Query("""
            SELECT b.branchType AS branchType, COUNT(b) AS count
            FROM Branch b
            GROUP BY b.branchType
            """)
    List<BranchTypeStats> countByBranchType();

    @Query("""
            SELECT b.organizationId AS organizationId, COUNT(b) AS count
            FROM Branch b
            GROUP BY b.organizationId
            """)
    List<OrganizationStats> countByOrganization();

    @Query(value = """
            SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date, COUNT(*) AS count
            FROM branch
            WHERE created_at IS NOT NULL
            GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
            ORDER BY DATE_FORMAT(created_at, '%Y-%m-%d')
            """, nativeQuery = true)
    List<CreationStats> countByCreationDay();

    // Creation trends with granularity and filters
    @Query(value = """
            SELECT DATE_FORMAT(created_at, '%Y') AS period, COUNT(*) AS count
            FROM branch
            WHERE created_at IS NOT NULL
              AND (:status IS NULL OR status = :status)
              AND (:organizationId IS NULL OR organization_id = :organizationId)
              AND (:regionId IS NULL OR region_id = :regionId)
              AND (:countryId IS NULL OR country_id = :countryId)
              AND (:branchType IS NULL OR branch_type = :branchType)
              AND (:createdDateFrom IS NULL OR created_at >= :createdDateFrom)
              AND (:createdDateTo IS NULL OR created_at < DATE_ADD(:createdDateTo, INTERVAL 1 DAY))
            GROUP BY DATE_FORMAT(created_at, '%Y')
            ORDER BY DATE_FORMAT(created_at, '%Y')
            """, nativeQuery = true)
    List<CreationTrend> countByCreationYear(
            @Param("status") Boolean status,
            @Param("organizationId") Long organizationId,
            @Param("regionId") Long regionId,
            @Param("countryId") Long countryId,
            @Param("branchType") String branchType,
            @Param("createdDateFrom") java.time.LocalDate createdDateFrom,
            @Param("createdDateTo") java.time.LocalDate createdDateTo
    );

    @Query(value = """
            SELECT DATE_FORMAT(created_at, '%Y-%m') AS period, COUNT(*) AS count
            FROM branch
            WHERE created_at IS NOT NULL
              AND (:status IS NULL OR status = :status)
              AND (:organizationId IS NULL OR organization_id = :organizationId)
              AND (:regionId IS NULL OR region_id = :regionId)
              AND (:countryId IS NULL OR country_id = :countryId)
              AND (:branchType IS NULL OR branch_type = :branchType)
              AND (:createdDateFrom IS NULL OR created_at >= :createdDateFrom)
              AND (:createdDateTo IS NULL OR created_at < DATE_ADD(:createdDateTo, INTERVAL 1 DAY))
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY DATE_FORMAT(created_at, '%Y-%m')
            """, nativeQuery = true)
    List<CreationTrend> countByCreationMonth(
            @Param("status") Boolean status,
            @Param("organizationId") Long organizationId,
            @Param("regionId") Long regionId,
            @Param("countryId") Long countryId,
            @Param("branchType") String branchType,
            @Param("createdDateFrom") java.time.LocalDate createdDateFrom,
            @Param("createdDateTo") java.time.LocalDate createdDateTo
    );

    @Query(value = """
            SELECT CONCAT(DATE_FORMAT(created_at, '%x'), '-W', DATE_FORMAT(created_at, '%v')) AS period, COUNT(*) AS count
            FROM branch
            WHERE created_at IS NOT NULL
              AND (:status IS NULL OR status = :status)
              AND (:organizationId IS NULL OR organization_id = :organizationId)
              AND (:regionId IS NULL OR region_id = :regionId)
              AND (:countryId IS NULL OR country_id = :countryId)
              AND (:branchType IS NULL OR branch_type = :branchType)
              AND (:createdDateFrom IS NULL OR created_at >= :createdDateFrom)
              AND (:createdDateTo IS NULL OR created_at < DATE_ADD(:createdDateTo, INTERVAL 1 DAY))
            GROUP BY CONCAT(DATE_FORMAT(created_at, '%x'), '-W', DATE_FORMAT(created_at, '%v'))
            ORDER BY CONCAT(DATE_FORMAT(created_at, '%x'), '-W', DATE_FORMAT(created_at, '%v'))
            """, nativeQuery = true)
    List<CreationTrend> countByCreationWeek(
            @Param("status") Boolean status,
            @Param("organizationId") Long organizationId,
            @Param("regionId") Long regionId,
            @Param("countryId") Long countryId,
            @Param("branchType") String branchType,
            @Param("createdDateFrom") java.time.LocalDate createdDateFrom,
            @Param("createdDateTo") java.time.LocalDate createdDateTo
    );

    @Query(value = """
            SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS period, COUNT(*) AS count
            FROM branch
            WHERE created_at IS NOT NULL
              AND (:status IS NULL OR status = :status)
              AND (:organizationId IS NULL OR organization_id = :organizationId)
              AND (:regionId IS NULL OR region_id = :regionId)
              AND (:countryId IS NULL OR country_id = :countryId)
              AND (:branchType IS NULL OR branch_type = :branchType)
              AND (:createdDateFrom IS NULL OR created_at >= :createdDateFrom)
              AND (:createdDateTo IS NULL OR created_at < DATE_ADD(:createdDateTo, INTERVAL 1 DAY))
            GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
            ORDER BY DATE_FORMAT(created_at, '%Y-%m-%d')
            """, nativeQuery = true)
    List<CreationTrend> countByCreationDayFiltered(
            @Param("status") Boolean status,
            @Param("organizationId") Long organizationId,
            @Param("regionId") Long regionId,
            @Param("countryId") Long countryId,
            @Param("branchType") String branchType,
            @Param("createdDateFrom") java.time.LocalDate createdDateFrom,
            @Param("createdDateTo") java.time.LocalDate createdDateTo
    );

    interface RegionStats {
        Long getRegionId();
        Long getActive();
        Long getInactive();
    }

    interface OrganizationStats {
        Long getOrganizationId();
        Long getCount();
    }

    interface BranchTypeStats {
        String getBranchType();
        Long getCount();
    }

    interface CreationStats {
        String getDate();
        Long getCount();
    }

    interface CreationTrend {
        String getPeriod();
        Long getCount();
    }
}