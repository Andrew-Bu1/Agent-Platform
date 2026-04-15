package com.agentplatform.agentstudio.dto.prompt;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

import java.util.Map;

@Getter
@Setter
public class CreatePromptVersionRequest {

    @NotBlank(message = "systemPrompt is required")
    private String systemPrompt;

    private Map<String, Object> contextConfig;

    private Boolean activate;
}
