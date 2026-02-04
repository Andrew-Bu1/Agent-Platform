package com.agentplatform.agentstudio.service;

import com.agentplatform.agentstudio.entity.Agent;
import com.agentplatform.agentstudio.repository.AgentRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class AgentService {
    
    private final AgentRepository agentRepository;
    
    public AgentService(AgentRepository agentRepository) {
        this.agentRepository = agentRepository;
    }
    
    public List<Agent> getAllAgents() {
        return agentRepository.findAll();
    }
    
    public Optional<Agent> getAgentById(Long id) {
        return agentRepository.findById(id);
    }
    
    public Agent createAgent(Agent agent) {
        return agentRepository.save(agent);
    }
    
    public Agent updateAgent(Long id, Agent agentDetails) {
        Agent agent = agentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Agent not found with id: " + id));
        
        agent.setName(agentDetails.getName());
        agent.setDescription(agentDetails.getDescription());
        
        return agentRepository.save(agent);
    }
    
    public void deleteAgent(Long id) {
        agentRepository.deleteById(id);
    }
}
