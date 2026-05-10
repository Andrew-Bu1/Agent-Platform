package com.agentplatform.studio;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class AgentStudioApplication {

    public static void main(String[] args) {
        SpringApplication.run(AgentStudioApplication.class, args);
    }
}
