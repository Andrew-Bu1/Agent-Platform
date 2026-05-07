package com.agentplatform.common.config;

import com.agentplatform.common.web.GlobalExceptionHandler;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Import;

/**
 * Spring Boot auto-configuration for the common library.
 * Activates automatically when {@code common} is on the classpath.
 *
 * Registers:
 *  - {@link JacksonConfig}           — Jackson customizer (ISO-8601 dates, ignore unknown fields)
 *  - {@link GlobalExceptionHandler}  — unified REST error handling (web apps only)
 */
@AutoConfiguration
@ConditionalOnWebApplication
@Import({JacksonConfig.class, GlobalExceptionHandler.class})
public class CommonAutoConfiguration {
}
