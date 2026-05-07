package com.agentplatform.common.config;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Jackson customizer — applied on top of Spring Boot's auto-configured {@code ObjectMapper}.
 * Does NOT replace the ObjectMapper bean; other customizers from libraries (e.g. Spring Data,
 * OpenAPI) still apply in addition to these settings.
 *
 * <p>Applies:
 * <ul>
 *   <li>Serialize {@code java.time} types as ISO-8601 strings, not arrays</li>
 *   <li>Silently ignore unknown JSON fields during deserialization</li>
 * </ul>
 *
 * <p>{@code JavaTimeModule} is registered automatically by Spring Boot when
 * {@code jackson-datatype-jsr310} is on the classpath.
 */
@Configuration
public class JacksonConfig {

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer commonJacksonCustomizer() {
        return builder -> builder
                .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .featuresToDisable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
    }
}
