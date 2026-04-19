export type SandboxState =
  | "idle"
  | "creating"
  | "uploading"
  | "starting"
  | "running"
  | "error"
  | "cleaning";

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
}
