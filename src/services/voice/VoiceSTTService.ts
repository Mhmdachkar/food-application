import { Platform } from 'react-native';
import { File as ExpoFile } from 'expo-file-system';
import { Config } from '../../config/Config';
import { logger } from '../../utils/logger';
import {
  fetchWithRetry,
  parseApiError,
  REQUEST_TIMEOUT_MS,
} from './voiceApiUtils';

const WHISPER_MODEL = 'whisper-large-v3';
const TRANSCRIPTIONS_PATH = '/v1/audio/transcriptions';

export class VoiceSTTService {
  private get baseUrl(): string {
    return Config.voiceSttUrl || 'https://gen.pollinations.ai';
  }

  private get transcriptionsUrl(): string {
    const base = this.baseUrl.replace(/\/+$/, '');
    if (base.includes('/v1/audio')) return base;
    return `${base}${TRANSCRIPTIONS_PATH}`;
  }

  private getAuthHeaders(): Record<string, string> {
    const key = Config.pollinationApiKey;
    if (key) return { 'Authorization': `Bearer ${key}` };
    return {};
  }

  async transcribeAudioBlob(audioBlob: Blob, filename: string = 'recording.webm', language?: string): Promise<string> {
    if (audioBlob.size < 100) {
      logger.warn('[VoiceSTT] Audio blob too small:', audioBlob.size);
      return '';
    }

    try {
      logger.log('[VoiceSTT] Whisper STT (blob), size:', audioBlob.size, 'lang:', language ?? 'auto');
      return await this._transcribeMultipart(audioBlob, filename, language);
    } catch (err: any) {
      if (err?.message?.includes('timed out')) {
        throw new Error('Speech recognition timed out. Please try again.');
      }
      throw new Error(err?.message ?? 'Transcription failed');
    }
  }

  async transcribeFileUri(fileUri: string, mimeType: string = 'audio/wav', filename: string = 'recording.wav', language?: string): Promise<string> {
    try {
      logger.log('[VoiceSTT] Whisper STT (file), uri:', fileUri, 'lang:', language ?? 'auto');

      let blob: Blob;
      if (Platform.OS !== 'web') {
        try {
          const file = new ExpoFile(fileUri);
          const buffer = await file.arrayBuffer();
          blob = new Blob([buffer], { type: mimeType });
          logger.log('[VoiceSTT] Read file via ExpoFile, blob size:', blob.size);
        } catch (readErr: any) {
          logger.warn('[VoiceSTT] ExpoFile read failed:', readErr?.message, '— trying fetch fallback');
          try {
            const response = await fetch(fileUri);
            blob = await response.blob();
            logger.log('[VoiceSTT] Read file via fetch fallback, blob size:', blob.size);
          } catch (fetchErr: any) {
            logger.error('[VoiceSTT] fetch fallback also failed:', fetchErr?.message);
            throw new Error('Could not read audio file for transcription');
          }
        }
      } else {
        const response = await fetch(fileUri);
        blob = await response.blob();
      }

      if (blob.size < 100) {
        logger.warn('[VoiceSTT] Audio blob too small after read:', blob.size);
        return '';
      }

      return await this._transcribeMultipart(blob, filename, language);
    } catch (err: any) {
      if (err?.message?.includes('timed out')) {
        throw new Error('Speech recognition timed out. Please try again.');
      }
      logger.error('[VoiceSTT] transcribeFileUri error:', err?.message, err?.stack);
      throw new Error(err?.message ?? 'Transcription failed');
    }
  }

  /**
   * Uses the proper OpenAI-compatible POST /v1/audio/transcriptions endpoint
   * with multipart/form-data, sending:
   *   - file: audio blob
   *   - model: whisper-large-v3
   *   - language: optional ISO-639-1 code
   */
  private async _transcribeMultipart(audioBlob: Blob, filename: string, language?: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', audioBlob, filename);
    formData.append('model', WHISPER_MODEL);

    if (language) {
      const langMap: Record<string, string> = {
        en: 'en', ar: 'ar', fr: 'fr', es: 'es', de: 'de',
        zh: 'zh', ja: 'ja', ko: 'ko', hi: 'hi', tr: 'tr',
      };
      formData.append('language', langMap[language] ?? language);
    }

    const url = this.transcriptionsUrl;
    logger.log('[VoiceSTT] POST', url, 'model:', WHISPER_MODEL, 'lang:', language ?? 'auto', 'size:', audioBlob.size);

    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
    }, REQUEST_TIMEOUT_MS, 1);

    if (!res.ok) {
      const errMsg = await parseApiError(res);
      logger.error('[VoiceSTT] Whisper error:', res.status, errMsg);
      throw new Error(`Transcription failed (${res.status}): ${errMsg}`);
    }

    const data = await res.json();
    const text = (data?.text ?? '').trim();
    logger.log('[VoiceSTT] Whisper result:', text.substring(0, 80) || '(empty)');
    return text;
  }
}

export const voiceSTTService = new VoiceSTTService();
