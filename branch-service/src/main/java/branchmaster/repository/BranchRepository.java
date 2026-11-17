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
    SELECT b.regionId,
           SUM(CASE WHEN b.status = true THEN 1 ELSE 0 END),
           SUM(CASE WHEN b.status = false THEN 1 ELSE 0 END)
    FROM Branch b
    GROUP BY b.regionId
    """)
    List<Object[]> countByRegion();

    @Query("""
    SELECT b.branchType, COUNT(b)
    FROM Branch b
    GROUP BY b.branchType
    """)
    List<Object[]> countByBranchType();

    @Query("""
    SELECT b.organizationId, COUNT(b)
    FROM Branch b
    GROUP BY b.organizationId
    """)
    List<Object[]> countByOrganization();

    @Query(value = """
    SELECT DATE_FORMAT(created_at, '%Y-%m-%d'), COUNT(*)
    FROM branch
    WHERE created_at IS NOT NULL
    GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
    ORDER BY DATE_FORMAT(created_at, '%Y-%m-%d')
    """, nativeQuery = true)
    List<Object[]> countByCreationDay();

    // Creation trends with granularity and filters
    @Query(value = """
    SELECT DATE_FORMAT(created_at, '%Y'), COUNT(*)
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
    List<Object[]> countByCreationYear(
            @Param("status") Boolean status,
            @Param("organizationId") Long organizationId,
            @Param("regionId") Long regionId,
            @Param("countryId") Long countryId,
            @Param("branchType") String branchType,
            @Param("createdDateFrom") java.time.LocalDate createdDateFrom,
            @Param("createdDateTo") java.time.LocalDate createdDateTo
    );

    @Query(value = """
    SELECT DATE_FORMAT(created_at, '%Y-%m'), COUNT(*)
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
    List<Object[]> countByCreationMonth(
            @Param("status") Boolean status,
            @Param("organizationId") Long organizationId,
            @Param("regionId") Long regionId,
            @Param("countryId") Long countryId,
            @Param("branchType") String branchType,
            @Param("createdDateFrom") java.time.LocalDate createdDateFrom,
            @Param("createdDateTo") java.time.LocalDate createdDateTo
    );

    @Query(value = """
    SELECT CONCAT(DATE_FORMAT(created_at, '%x'), '-W', DATE_FORMAT(created_at, '%v')), COUNT(*)
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
    List<Object[]> countByCreationWeek(
            @Param("status") Boolean status,
            @Param("organizationId") Long organizationId,
            @Param("regionId") Long regionId,
            @Param("countryId") Long countryId,
            @Param("branchType") String branchType,
            @Param("createdDateFrom") java.time.LocalDate createdDateFrom,
            @Param("createdDateTo") java.time.LocalDate createdDateTo
    );

    @Query(value = """
    SELECT DATE_FORMAT(created_at, '%Y-%m-%d'), COUNT(*)
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
    List<Object[]> countByCreationDayFiltered(
            @Param("status") Boolean status,
            @Param("organizationId") Long organizationId,
            @Param("regionId") Long regionId,
            @Param("countryId") Long countryId,
            @Param("branchType") String branchType,
            @Param("createdDateFrom") java.time.LocalDate createdDateFrom,
            @Param("createdDateTo") java.time.LocalDate createdDateTo
    );
}