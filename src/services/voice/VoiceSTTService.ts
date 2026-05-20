import { Platform } from 'react-native';
import { File as ExpoFile } from 'expo-file-system';
import { Config } from '../../config/Config';
import { logger } from '../../utils/logger';
import {
  arrayBufferToBase64,
  fetchWithRetry,
  getHeaders,
  parseApiError,
  extractContent,
  REQUEST_TIMEOUT_MS,
  POLLINATIONS_REFERRER,
} from './voiceApiUtils';

export class VoiceSTTService {
  private sttUrl = Config.voiceSttUrl || 'https://text.pollinations.ai/openai';

  async transcribeAudioBlob(audioBlob: Blob, filename: string = 'recording.webm', language?: string): Promise<string> {
    if (audioBlob.size < 100) {
      logger.warn('[VoiceSTT] Audio blob too small:', audioBlob.size);
      return '';
    }

    try {
      logger.log('[VoiceSTT] STT request (web/base64), size:', audioBlob.size, 'lang:', language ?? 'auto');
      const base64 = await this._blobToBase64(audioBlob);
      return await this._transcribeBase64(base64, filename.endsWith('.wav') ? 'wav' : 'webm', language);
    } catch (err: any) {
      if (err?.message?.includes('timed out')) {
        throw new Error('Speech recognition timed out. Please try again.');
      }
      throw new Error(err?.message ?? 'Transcription failed');
    }
  }

  async transcribeFileUri(fileUri: string, mimeType: string = 'audio/wav', filename: string = 'recording.wav', language?: string): Promise<string> {
    try {
      logger.log('[VoiceSTT] STT request (native/base64), uri:', fileUri, 'lang:', language ?? 'auto');

      let base64: string;
      if (Platform.OS !== 'web') {
        try {
          const file = new ExpoFile(fileUri);
          const buffer = await file.arrayBuffer();
          base64 = arrayBufferToBase64(buffer);
          logger.log('[VoiceSTT] Read file via ExpoFile.arrayBuffer(), base64 length:', base64.length);
        } catch (readErr: any) {
          logger.warn('[VoiceSTT] ExpoFile.arrayBuffer() failed:', readErr?.message);
          logger.log('[VoiceSTT] Trying fetch+blob fallback for native...');
          try {
            const response = await fetch(fileUri);
            const blob = await response.blob();
            base64 = await this._blobToBase64(blob);
            logger.log('[VoiceSTT] Read file via fetch+blob fallback, base64 length:', base64.length);
          } catch (fetchErr: any) {
            logger.error('[VoiceSTT] fetch+blob fallback also failed:', fetchErr?.message);
            throw new Error('Could not read audio file for transcription');
          }
        }
      } else {
        const response = await fetch(fileUri);
        const blob = await response.blob();
        base64 = await this._blobToBase64(blob);
      }

      if (!base64 || base64.length < 100) {
        logger.warn('[VoiceSTT] Base64 audio too small:', base64?.length ?? 0);
        return '';
      }

      const format = mimeType.includes('wav') ? 'wav' : mimeType.includes('webm') ? 'webm' : 'mp3';
      return await this._transcribeBase64(base64, format, language);
    } catch (err: any) {
      if (err?.message?.includes('timed out')) {
        throw new Error('Speech recognition timed out. Please try again.');
      }
      logger.error('[VoiceSTT] transcribeFileUri error:', err?.message, err?.stack);
      throw new Error(err?.message ?? 'Transcription failed');
    }
  }

  _blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read audio file'));
      reader.readAsDataURL(blob);
    });
  }

  private async _transcribeBase64(base64Audio: string, format: string, language?: string): Promise<string> {
    const langHint = language ? ` Transcribe in ${language}.` : '';
    const body = {
      model: 'openai-audio',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `Transcribe this audio exactly as spoken. Return ONLY the transcribed text, nothing else.${langHint}` },
          {
            type: 'input_audio',
            input_audio: {
              data: base64Audio,
              format,
            },
          },
        ],
      }],
      referrer: POLLINATIONS_REFERRER,
    };

    const res = await fetchWithRetry(this.sttUrl, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(body),
    }, REQUEST_TIMEOUT_MS, 1);

    if (!res.ok) {
      const errMsg = await parseApiError(res);
      logger.error('[VoiceSTT] STT error:', res.status, errMsg);
      throw new Error(`Transcription failed (${res.status}): ${errMsg}`);
    }

    const data = await res.json();
    const text = extractContent(data).trim();
    logger.log('[VoiceSTT] STT result:', text.substring(0, 80) || '(empty)');
    return text;
  }
}

export const voiceSTTService = new VoiceSTTService();
