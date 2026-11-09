package branchmaster.repository;

import branchmaster.entity.Branch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

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
}