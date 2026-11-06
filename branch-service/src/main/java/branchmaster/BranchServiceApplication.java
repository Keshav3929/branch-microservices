package branchmaster;

import commonservice.service.CommonValidationService;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.context.annotation.Import;

@EnableJpaAuditing(modifyOnCreate = false)
@EnableCaching
@EnableFeignClients
@EnableAsync
@Import(CommonValidationService.class)
@SpringBootApplication
public class BranchServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(BranchServiceApplication.class, args);
    }
}