import { logger } from '../../../utils/logger';
import type { AIProvider, ChatCompletionOptions, HealthCheckResult } from './AIProvider';
import {
  fetchWithTimeout,
  fetchWithRetry,
  parseApiError,
  extractContent,
  getHeaders,
  REQUEST_TIMEOUT_MS,
  POLLINATIONS_REFERRER,
} from '../voiceApiUtils';

export class PollinationsProvider implements AIProvider {
  readonly name = 'Pollinations';
  private chatUrl = 'https://text.pollinations.ai/';
  private _available = true;
  private _lastFailure = 0;
  private static readonly COOLDOWN_MS = 60_000;

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
      const urlObj = new URL(this.chatUrl);
      const baseUrl = urlObj.origin;
      const res = await fetchWithTimeout(`${baseUrl}/models`, { method: 'GET' }, 8000);
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
      referrer: POLLINATIONS_REFERRER,
    };

    try {
      const res = await fetchWithRetry(this.chatUrl, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errMsg = await parseApiError(res);
        if (res.status >= 500) this.markUnhealthy();
        throw new Error(`Pollinations error (${res.status}): ${errMsg}`);
      }

      const contentType = res.headers.get('content-type') || '';
      let content = '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        content = extractContent(data);
      } else {
        content = (await res.text()).trim();
      }

      if (content && (content.includes('legacy text API is being deprecated') || content.includes('IMPORTANT NOTICE'))) {
        logger.warn('[Pollinations] Deprecation notice in response, treating as empty');
        return '';
      }

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
