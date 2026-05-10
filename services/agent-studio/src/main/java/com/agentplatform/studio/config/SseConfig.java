package com.agentplatform.studio.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * Async / SSE configuration.
 * The sseProxyExecutor is used by OrchestratorProxyService.streamEvents to hold
 * open long-lived SSE connections without blocking Tomcat threads.
 */
@Configuration
@EnableAsync
public class SseConfig {

    @Bean("sseProxyExecutor")
    public Executor sseProxyExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(20);
        executor.setMaxPoolSize(200);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("sse-proxy-");
        executor.initialize();
        return executor;
    }
}
