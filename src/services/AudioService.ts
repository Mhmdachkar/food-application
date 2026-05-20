import { logger } from '../utils/logger';
import { SilenceDetectionService } from './audio/SilenceDetectionService';
import { RecordingService } from './audio/RecordingService';
import { PlaybackService } from './audio/PlaybackService';

export { SilenceDetectionService } from './audio/SilenceDetectionService';
export { RecordingService } from './audio/RecordingService';
export { PlaybackService } from './audio/PlaybackService';

export class AudioService {
  private silenceDetection = new SilenceDetectionService();
  private recordingService = new RecordingService(this.silenceDetection);
  private playbackService = new PlaybackService();

  private ttsLanguage = 'en-US';
  private detectedLang = 'en';

  setLanguage(lang: string): void {
    this.detectedLang = lang;
    const langMap: Record<string, string> = {
      en: 'en-US',
      ar: 'ar-SA',
      fr: 'fr-FR',
      es: 'es-ES',
      de: 'de-DE',
      zh: 'zh-CN',
      ja: 'ja-JP',
      ko: 'ko-KR',
      hi: 'hi-IN',
      tr: 'tr-TR',
    };
    this.ttsLanguage = langMap[lang] ?? `${lang}-${lang.toUpperCase()}`;
    logger.log('[AudioService] Language set:', this.detectedLang, '→ TTS:', this.ttsLanguage);
    this.recordingService.setTtsLanguage(this.ttsLanguage);
    this.playbackService.setLanguage(this.detectedLang, this.ttsLanguage);
  }

  requestPermissions(): Promise<boolean> {
    return this.recordingService.requestPermissions();
  }

  ensureMicPermission(): Promise<boolean> {
    return this.recordingService.ensureMicPermission();
  }

  startRecording(onSilence?: () => void): Promise<boolean> {
    return this.recordingService.startRecording(
      onSilence,
      () => this.playbackService.stopPlaybackAsync(),
    );
  }

  stopRecordingAndTranscribe(language?: string): Promise<string> {
    return this.recordingService.stopRecordingAndTranscribe(language);
  }

  cancelRecording(): Promise<void> {
    return this.recordingService.cancelRecording();
  }

  hadVoiceActivity(): boolean {
    return this.recordingService.hadVoiceActivity();
  }

  playTTS(text: string, voice?: string): Promise<void> {
    return this.playbackService.playTTS(text, voice);
  }

  stopPlaybackAsync(): Promise<void> {
    return this.playbackService.stopPlaybackAsync();
  }

  stopPlayback(): void {
    this.playbackService.stopPlayback();
  }

  getIsPlaying(): boolean {
    return this.playbackService.getIsPlaying();
  }

  getIsRecording(): boolean {
    return this.recordingService.getIsRecording();
  }
}

export const audioService = new AudioService();
