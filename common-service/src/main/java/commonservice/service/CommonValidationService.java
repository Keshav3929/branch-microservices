package commonservice.service;

import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CommonValidationService {

    private final Validator validator;

    public List<String> validate(Object request) {
        return validator.validate(request).stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .toList();
    }
}