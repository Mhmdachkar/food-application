import { Config } from '../../config/Config';
import { logger } from '../../utils/logger';
import { fetchWithTimeout } from './voiceApiUtils';

export class VoiceTTSService {
  private ttsUrl = Config.voiceTtsUrl || 'https://text.pollinations.ai/openai';

  async generateTtsAudioUrl(text: string, voice: string = 'nova'): Promise<string> {
    const url = this.getTtsStreamUrl(text, voice);
    logger.log('[VoiceTTS] TTS GET request, voice:', voice, 'length:', text.length);
    const res = await fetchWithTimeout(url, { method: 'GET' }, 20000);
    if (!res.ok) {
      throw new Error(`TTS failed (${res.status})`);
    }
    const blob = await res.blob();
    if (blob.size < 100) {
      throw new Error('TTS returned empty audio');
    }
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      return URL.createObjectURL(blob);
    }
    throw new Error('URL.createObjectURL not available on this platform');
  }

  getTtsStreamUrl(text: string, voice: string = 'nova'): string {
    const encodedText = encodeURIComponent(text.slice(0, 500));
    const baseUrl = new URL(this.ttsUrl).origin;
    return `${baseUrl}/${encodedText}?model=openai-audio&voice=${voice}`;
  }

  async generateTtsAudioUrlGet(text: string, voice: string = 'nova'): Promise<string> {
    return this.generateTtsAudioUrl(text, voice);
  }
}

export const voiceTTSService = new VoiceTTSService();
