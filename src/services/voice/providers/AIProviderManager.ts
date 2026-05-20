import { logger } from '../../../utils/logger';
import type { AIProvider, ChatCompletionOptions, HealthCheckResult } from './AIProvider';
import { PollinationsProvider } from './PollinationsProvider';
import { GroqProvider } from './GroqProvider';

export class AIProviderManager {
  private providers: AIProvider[];
  private lastHealthCheck: Map<string, HealthCheckResult> = new Map();

  constructor(providers?: AIProvider[]) {
    this.providers = providers ?? [
      new PollinationsProvider(),
      new GroqProvider(),
    ];
  }

  async chatCompletion(options: ChatCompletionOptions): Promise<string> {
    const errors: string[] = [];

    for (const provider of this.providers) {
      if (!provider.isAvailable()) {
        logger.log(`[AIManager] Skipping ${provider.name} — marked unavailable`);
        continue;
      }

      try {
        logger.log(`[AIManager] Trying ${provider.name}...`);
        const content = await provider.chatCompletion(options);
        if (content) {
          logger.log(`[AIManager] ${provider.name} succeeded`);
          return content;
        }
        logger.warn(`[AIManager] ${provider.name} returned empty response`);
        errors.push(`${provider.name}: empty response`);
      } catch (err: any) {
        const msg = err?.message ?? 'Unknown error';
        logger.warn(`[AIManager] ${provider.name} failed:`, msg);
        errors.push(`${provider.name}: ${msg}`);
      }
    }

    logger.error('[AIManager] All providers failed:', errors.join('; '));
    throw new Error(`All AI providers failed: ${errors.join('; ')}`);
  }

  async runHealthChecks(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();

    const checks = this.providers.map(async (provider) => {
      try {
        const result = await provider.healthCheck();
        results.set(provider.name, result);
        this.lastHealthCheck.set(provider.name, result);
        logger.log(`[AIManager] Health check ${provider.name}:`, result.ok ? 'OK' : 'FAIL',
          result.latencyMs ? `${result.latencyMs}ms` : '', result.error ?? '');
      } catch (err: any) {
        const result: HealthCheckResult = { ok: false, error: err?.message };
        results.set(provider.name, result);
        this.lastHealthCheck.set(provider.name, result);
      }
    });

    await Promise.allSettled(checks);
    return results;
  }

  getProviderStatus(): Array<{ name: string; available: boolean; lastHealth?: HealthCheckResult }> {
    return this.providers.map(p => ({
      name: p.name,
      available: p.isAvailable(),
      lastHealth: this.lastHealthCheck.get(p.name),
    }));
  }

  getAvailableProviderCount(): number {
    return this.providers.filter(p => p.isAvailable()).length;
  }
}

export const aiProviderManager = new AIProviderManager();
