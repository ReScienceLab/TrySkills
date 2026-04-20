export type SandboxState =
  | "idle"
  | "creating"
  | "configuring"
  | "installing"
  | "uploading"
  | "starting"
  | "swapping"
  | "restarting"
  | "running"
  | "error"
  | "cleaning";

export type PoolState = "warm" | "active" | "swapping" | "stopped";

export interface SandboxConfig {
  daytonaApiKey: string;
  llmProvider: string;
  llmApiKey: string;
  llmModel: string;
}

export interface SandboxSession {
  sandboxId: string;
  webuiUrl: string;
  state: SandboxState;
  startedAt: number;
  cpu?: number;
  memory?: number;
  disk?: number;
  region?: string;
}
