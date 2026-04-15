package com.agentplatform.agentstudio.dto.workflow;

/**
 * Supported node types for the agentic workflow graph.
 *
 * <ul>
 *   <li>INPUT      — entry point; passes the initial user input into the graph</li>
 *   <li>OUTPUT     — exit point; collects the final result</li>
 *   <li>AGENT      — standalone / ReAct agent loop; has its own prompt + tools</li>
 *   <li>ROUTER     — one agent inspects input and decides which downstream branch runs next</li>
 *   <li>PARALLEL   — fan-out: same input is sent to N downstream branches simultaneously</li>
 *   <li>AGGREGATOR — fan-in: collects outputs from parallel branches and merges them via an agent</li>
 *   <li>TEAM       — hierarchical: a coordinator agent delegates to sub-agents wired as tools</li>
 * </ul>
 */
public enum NodeType {
    INPUT,
    OUTPUT,
    AGENT,
    ROUTER,
    PARALLEL,
    AGGREGATOR,
    TEAM
}
