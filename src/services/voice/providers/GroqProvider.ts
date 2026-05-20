import { Config } from '../../../config/Config';
import { logger } from '../../../utils/logger';
import type { AIProvider, ChatCompletionOptions, HealthCheckResult } from './AIProvider';
import {
  fetchWithTimeout,
  fetchWithRetry,
  parseApiError,
  extractContent,
  REQUEST_TIMEOUT_MS,
} from '../voiceApiUtils';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models';
const GROQ_DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export class GroqProvider implements AIProvider {
  readonly name = 'Groq';
  private _available = true;
  private _lastFailure = 0;
  private static readonly COOLDOWN_MS = 60_000;

  private getApiKey(): string {
    return Config.groqApiKey ?? '';
  }

  private getHeaders(): Record<string, string> {
    const key = this.getApiKey();
    if (!key) return { 'Content-Type': 'application/json' };
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    };
  }

  isAvailable(): boolean {
    if (!this.getApiKey()) return false;
    if (!this._available) {
      if (Date.now() - this._lastFailure > GroqProvider.COOLDOWN_MS) {
        logger.log('[Groq] Cooldown expired, marking available again');
        this._available = true;
      }
    }
    return this._available;
  }

  private markUnhealthy(): void {
    this._available = false;
    this._lastFailure = Date.now();
    logger.warn('[Groq] Marked unhealthy, cooldown:', GroqProvider.COOLDOWN_MS, 'ms');
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const key = this.getApiKey();
    if (!key) {
      return { ok: false, error: 'GROQ_API_KEY not configured' };
    }

    const start = Date.now();
    try {
      const res = await fetchWithTimeout(GROQ_MODELS_URL, {
        method: 'GET',
        headers: this.getHeaders(),
      }, 8000);
      const latencyMs = Date.now() - start;
      if (res.ok) {
        this._available = true;
        return { ok: true, latencyMs };
      }
      this.markUnhealthy();
      return { ok: false, latencyMs, error: `HTTP ${res.status}` };
    } catch (err: any) {
      this.markUnhealthy();
      return { ok: false, latencyMs: Date.now() - start, error: err?.message };
    }
  }

  async chatCompletion(options: ChatCompletionOptions): Promise<string> {
    const key = this.getApiKey();
    if (!key) throw new Error('GROQ_API_KEY not configured');

    const model = GROQ_DEFAULT_MODEL;
    const body = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens,
    };

    try {
      logger.log('[Groq] Chat request → model:', model, 'messages:', options.messages.length);
      const res = await fetchWithRetry(GROQ_API_URL, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      }, REQUEST_TIMEOUT_MS, 1);

      if (!res.ok) {
        const errMsg = await parseApiError(res);
        if (res.status >= 500) this.markUnhealthy();
        if (res.status === 429) {
          logger.warn('[Groq] Rate limited:', errMsg);
          this.markUnhealthy();
        }
        throw new Error(`Groq error (${res.status}): ${errMsg}`);
      }

      const data = await res.json();
      const content = extractContent(data);
      logger.log('[Groq] Response:', content.substring(0, 80));
      this._available = true;
      return content;
    } catch (err: any) {
      if (err?.message?.includes('timed out')) {
        this.markUnhealthy();
      }
      throw err;
    }
  }
}
