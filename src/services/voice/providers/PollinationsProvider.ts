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

const POLLINATIONS_BASE = 'https://gen.pollinations.ai';

export class PollinationsProvider implements AIProvider {
  readonly name = 'Pollinations';
  private _available = true;
  private _lastFailure = 0;
  private static readonly COOLDOWN_MS = 60_000;

  private get chatUrl(): string {
    return Config.voiceChatUrl || `${POLLINATIONS_BASE}/v1/chat/completions`;
  }

  private getHeaders(): Record<string, string> {
    const key = Config.pollinationApiKey;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = `Bearer ${key}`;
    return headers;
  }

  isAvailable(): boolean {
    if (!this._available) {
      if (Date.now() - this._lastFailure > PollinationsProvider.COOLDOWN_MS) {
        logger.log('[Pollinations] Cooldown expired, marking available again');
        this._available = true;
      }
    }
    return this._available;
  }

  private markUnhealthy(): void {
    this._available = false;
    this._lastFailure = Date.now();
    logger.warn('[Pollinations] Marked unhealthy, cooldown:', PollinationsProvider.COOLDOWN_MS, 'ms');
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const res = await fetchWithTimeout(`${POLLINATIONS_BASE}/v1/models`, {
        method: 'GET',
        headers: this.getHeaders(),
      }, 8000);
      const latencyMs = Date.now() - start;
      if (res.ok || res.status < 500) {
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
    const body = {
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens,
    };

    try {
      const res = await fetchWithRetry(this.chatUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errMsg = await parseApiError(res);
        if (res.status >= 500) this.markUnhealthy();
        throw new Error(`Pollinations error (${res.status}): ${errMsg}`);
      }

      const data = await res.json();
      const content = extractContent(data);

      this._available = true;
      return content;
    } catch (err: any) {
      if (err?.message?.includes('timed out')) {
        this.markUnhealthy();
        throw new Error('Pollinations timed out');
      }
      throw err;
    }
  }
}
