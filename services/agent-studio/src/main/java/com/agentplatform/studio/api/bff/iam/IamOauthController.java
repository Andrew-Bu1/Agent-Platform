package com.agentplatform.studio.api.bff.iam;

import com.agentplatform.studio.service.IamProxyService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public BFF proxy for service-client OAuth token exchange.
 */
@RestController
@RequestMapping("/api/v1/oauth")
@RequiredArgsConstructor
public class IamOauthController {

    private final IamProxyService iamProxy;

    @PostMapping("/token")
    public JsonNode token(@RequestParam("grant_type") String grantType,
                          @RequestParam("client_id") String clientId,
                          @RequestParam("client_secret") String clientSecret) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", grantType);
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        return iamProxy.publicFormPost("/oauth/token", form);
    }
}
