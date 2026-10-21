import type { AgentLiveService } from "./agent-live.js";

let service: AgentLiveService | null = null;

export function setAgentLiveService(next: AgentLiveService): void {
  service = next;
}

export function getAgentLiveService(): AgentLiveService | null {
  return service;
}
