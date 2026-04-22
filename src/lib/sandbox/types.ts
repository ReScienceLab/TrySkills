export type SandboxState =
  | "idle"
  | "creating"
  | "configuring"
  | "installing"
  | "uploading"
  | "starting"
  | "running"
  | "error"
  | "cleaning";

export type PoolState = "active" | "creating" | "stopped";

export interface SandboxConfig {
  daytonaApiKey: string;
  llmProvider: string;
  llmApiKey: string;
  llmModel: string;
}

export interface SandboxSession {
  sandboxId: string;
  gatewayUrl: string;
  gatewayBaseUrl: string;
  state: SandboxState;
  startedAt: number;
  urlRefreshed?: boolean;
  cpu?: number;
  memory?: number;
  disk?: number;
  region?: string;
}
