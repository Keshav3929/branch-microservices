package branchmaster;

import branchmaster.controller.BranchController;
import branchmaster.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
class BranchServiceApplicationTests {

    @Autowired
    private BranchController branchController;

    @Test
    void contextLoads() {
    }

    @Test
    void creationTrendsSupportsEveryGranularityWithoutFilters() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(branchController).setControllerAdvice(new GlobalExceptionHandler()).build();

        for (String granularity : new String[]{"yearly", "monthly", "weekly", "daily"}) {
            mockMvc.perform(get("/branch/creation-trends").param("granularity", granularity))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.granularity").value(granularity))
                    .andExpect(jsonPath("$.trends").isArray());
        }
    }

    @Test
    void monthlyCreationTrendsAcceptsDateFilters() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(branchController).setControllerAdvice(new GlobalExceptionHandler()).build();

        mockMvc.perform(get("/branch/creation-trends")
                        .param("granularity", "monthly")
                        .param("createdDateFrom", "09-11-2026")
                        .param("createdDateTo", "16-11-2026"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.granularity").value("monthly"))
                .andExpect(jsonPath("$.trends").isArray())
                .andExpect(jsonPath("$.trends[0].period").isString())
                .andExpect(jsonPath("$.trends[0].count").isNumber());
    }

    @Test
    void monthlyCreationTrendsReturnsAnEmptyArrayForAnUnmatchedDateRange() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(branchController).setControllerAdvice(new GlobalExceptionHandler()).build();

        mockMvc.perform(get("/branch/creation-trends")
                        .param("granularity", "monthly")
                        .param("createdDateFrom", "01-01-1900")
                        .param("createdDateTo", "01-01-1900"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.granularity").value("monthly"))
                .andExpect(jsonPath("$.trends").isEmpty());
    }
    @Test
    void creationTrendsRejectsAnInvertedDateRange() throws Exception {
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(branchController).setControllerAdvice(new GlobalExceptionHandler()).build();

        mockMvc.perform(get("/branch/creation-trends")
                        .param("granularity", "monthly")
                        .param("createdDateFrom", "16-11-2026")
                        .param("createdDateTo", "09-11-2026"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors.createdDateTo").exists());
    }
}
