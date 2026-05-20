import { logger } from '../../utils/logger';

export const REQUEST_TIMEOUT_MS = 30000;
export const MAX_RETRIES = 2;
export const RETRY_DELAY_MS = 800;
export const POLLINATIONS_REFERRER = 'smartfood-app';

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
  };
}

export function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Request timed out — check your internet connection.'));
    }, timeoutMs);
    fetch(url, { ...options, signal: controller.signal })
      .then(res => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch(err => {
        clearTimeout(timer);
        if (err?.name === 'AbortError') {
          reject(new Error('Request timed out — check your internet connection.'));
        } else {
          reject(err);
        }
      });
  });
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
  maxRetries = MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options, timeoutMs);
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res;
      }
      lastError = new Error(`Server error (${res.status})`);
      logger.warn(`[VoiceAI] Attempt ${attempt + 1} failed with ${res.status}, retrying...`);
    } catch (err: any) {
      lastError = err;
      if (err?.message?.includes('timed out') && attempt < maxRetries) {
        logger.warn(`[VoiceAI] Attempt ${attempt + 1} timed out, retrying...`);
      } else if (attempt >= maxRetries) {
        throw err;
      }
    }
    if (attempt < maxRetries) {
      await sleep(RETRY_DELAY_MS * (attempt + 1));
    }
  }
  throw lastError ?? new Error('Request failed after retries');
}

export async function parseApiError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body?.error?.message) return body.error.message;
    if (body?.error?.code) return `${body.error.code}: ${body.error.message ?? 'Unknown error'}`;
    return `HTTP ${res.status}`;
  } catch {
    try {
      const text = await res.text();
      return text.substring(0, 200) || `HTTP ${res.status}`;
    } catch {
      return `HTTP ${res.status}`;
    }
  }
}

export function extractContent(data: any): string {
  const c1 = data?.choices?.[0]?.message?.content;
  if (typeof c1 === 'string' && c1.trim()) return c1.trim();

  const c2 = data?.choices?.[0]?.delta?.content;
  if (typeof c2 === 'string' && c2.trim()) return c2.trim();

  const c3 = data?.choices?.[0]?.text;
  if (typeof c3 === 'string' && c3.trim()) return c3.trim();

  const c4 = data?.text ?? data?.content ?? data?.response ?? data?.output;
  if (typeof c4 === 'string' && c4.trim()) return c4.trim();

  if (Array.isArray(data?.choices)) {
    for (const choice of data.choices) {
      const ct = choice?.message?.content ?? choice?.text ?? choice?.delta?.content;
      if (typeof ct === 'string' && ct.trim()) return ct.trim();
    }
  }

  return '';
}
