import type { ChatMessage } from '../../../models/VoiceCallTypes';

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  model: string;
  maxTokens: number;
  temperature?: number;
}

export interface HealthCheckResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

export interface AIProvider {
  readonly name: string;

  chatCompletion(options: ChatCompletionOptions): Promise<string>;

  healthCheck(): Promise<HealthCheckResult>;

  isAvailable(): boolean;
}
