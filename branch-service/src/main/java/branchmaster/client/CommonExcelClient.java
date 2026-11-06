package branchmaster.client;

import branchmaster.dto.CommonExcelTemplateRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "COMMON-SERVICE")
public interface CommonExcelClient {

    @PostMapping(
            value = "/common/excel/template",
            consumes = MediaType.APPLICATION_JSON_VALUE
    )
    byte[] generateTemplate(@RequestBody CommonExcelTemplateRequest request);
}