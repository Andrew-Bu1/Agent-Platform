package agents

import (
	"encoding/json"
	"net/http"
)

type AgentRouter struct {

}

func NewAgentRouter() *AgentRouter {
	return &AgentRouter{}
}

func (ar *AgentRouter) RegisterRouters(mux *http.ServeMux) {
	mux.HandleFunc("/agents", ar.handleAgents)
}

func (ar *AgentRouter) handleAgents(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		ar.listAgents(w, r)
	case http.MethodPost:
		ar.createAgent(w, r)
	default:
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)		
	}
}

func (ar *AgentRouter) listAgents(w http.ResponseWriter, r *http.Request) {
	agents := []string{"agent1", "agent2", "agent3"}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(agents)
}

func (ar *AgentRouter) createAgent(w http.ResponseWriter, r *http.Request) {
	var newAgent struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&newAgent); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}
	// Placeholder for actual agent creation logic
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "agent created", "name": newAgent.Name})
}