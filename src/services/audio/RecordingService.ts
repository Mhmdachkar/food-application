import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { voiceAIService } from '../VoiceAIService';
import { logger } from '../../utils/logger';
import { SilenceDetectionService } from './SilenceDetectionService';

const isWeb = Platform.OS === 'web';

const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.wav',
    outputFormat: Audio.AndroidOutputFormat.DEFAULT,
    audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.wav',
    outputFormat: Audio.IOSOutputFormat.LINEARPCM,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm;codecs=opus',
    bitsPerSecond: 128000,
  },
};

const HARD_MAX_RECORDING_MS = 12000;

export class RecordingService {
  private recording: Audio.Recording | null = null;
  private recordingStartTime = 0;
  private _permissionGranted: boolean | null = null;

  // Web Speech API for browser-native STT
  private webSpeechRecognition: any = null;
  private webSpeechTranscript = '';
  private webSpeechActive = false;
  private voiceDetected = false;
  private silenceCallbackFired = false;
  private onSilenceCallback: (() => void) | null = null;
  private maxRecordingTimer: ReturnType<typeof setTimeout> | null = null;

  private ttsLanguage = 'en-US';

  constructor(private silenceDetection: SilenceDetectionService) {}

  setTtsLanguage(lang: string): void {
    this.ttsLanguage = lang;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (granted) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      }
      return granted;
    } catch (err) {
      logger.error('[Recording] Permission error:', err);
      return false;
    }
  }

  async ensureMicPermission(): Promise<boolean> {
    if (this._permissionGranted === true) return true;
    const granted = await this.requestPermissions();
    this._permissionGranted = granted;
    return granted;
  }

  async startRecording(onSilence?: () => void, stopPlaybackFn?: () => Promise<void>): Promise<boolean> {
    if (isWeb) {
      return this.startWebSpeechRecognition(onSilence);
    }

    try {
      if (this.recording) {
        await this.cancelRecording();
      }
      if (stopPlaybackFn) await stopPlaybackFn();

      const hasPermission = await this.ensureMicPermission();
      if (!hasPermission) {
        logger.error('[Recording] Microphone permission denied');
        return false;
      }

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      } catch (modeErr) {
        logger.warn('[Recording] Audio mode switch failed, retrying:', modeErr);
        await new Promise(r => setTimeout(r, 200));
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      }

      logger.log('[Recording] Starting native recording...');
      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      this.recording = recording;
      this.recordingStartTime = Date.now();
      this.silenceDetection.reset();

      logger.log('[Recording] Native recording started (silence:', !!onSilence, ')');

      if (onSilence) {
        this.silenceDetection.startSilenceDetection(
          this.recording,
          this.recordingStartTime,
          onSilence,
        );
        this.silenceDetection.startMaxRecordingTimer(() => {
          this.silenceDetection.fireSilenceCallback();
        });
      }

      return true;
    } catch (err) {
      logger.error('[Recording] Start recording error:', err);
      this.recording = null;
      return false;
    }
  }

  private startWebSpeechRecognition(onSilence?: () => void): boolean {
    try {
      this.stopWebSpeechRecognition();

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        logger.error('[Recording] SpeechRecognition not supported in this browser');
        return false;
      }

      this.webSpeechTranscript = '';
      this.webSpeechActive = true;
      this.voiceDetected = false;
      this.silenceCallbackFired = false;
      this.recordingStartTime = Date.now();
      this.onSilenceCallback = onSilence ?? null;

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = this.ttsLanguage;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        this.webSpeechTranscript = transcript;
        if (transcript.trim().length > 0) {
          this.voiceDetected = true;
        }
        logger.log('[Recording] Web STT interim:', transcript.substring(0, 60));
      };

      recognition.onend = () => {
        logger.log('[Recording] Web SpeechRecognition ended, transcript:', this.webSpeechTranscript.substring(0, 60) || '(empty)');
        this.webSpeechActive = false;
        if (!this.silenceCallbackFired) {
          this.silenceCallbackFired = true;
          const cb = this.onSilenceCallback;
          this.onSilenceCallback = null;
          cb?.();
        }
      };

      recognition.onerror = (event: any) => {
        logger.warn('[Recording] Web SpeechRecognition error:', event.error);
        this.webSpeechActive = false;
        if (!this.silenceCallbackFired) {
          this.silenceCallbackFired = true;
          const cb = this.onSilenceCallback;
          this.onSilenceCallback = null;
          cb?.();
        }
      };

      recognition.start();
      this.webSpeechRecognition = recognition;

      this.maxRecordingTimer = setTimeout(() => {
        logger.log('[Recording] Web STT hard timeout, stopping');
        this.stopWebSpeechRecognition();
      }, HARD_MAX_RECORDING_MS);

      logger.log('[Recording] Web SpeechRecognition started (lang:', this.ttsLanguage, ')');
      return true;
    } catch (err) {
      logger.error('[Recording] Web SpeechRecognition start error:', err);
      this.webSpeechActive = false;
      return false;
    }
  }

  private stopWebSpeechRecognition(): void {
    if (this.webSpeechRecognition) {
      try { this.webSpeechRecognition.stop(); } catch { /* ignore */ }
      this.webSpeechRecognition = null;
    }
    this.webSpeechActive = false;
    this.clearMaxRecordingTimer();
  }

  private clearMaxRecordingTimer(): void {
    if (this.maxRecordingTimer) {
      clearTimeout(this.maxRecordingTimer);
      this.maxRecordingTimer = null;
    }
  }

  hadVoiceActivity(): boolean {
    if (isWeb) return this.voiceDetected;
    return this.silenceDetection.hadVoiceActivity();
  }

  async stopRecordingAndTranscribe(language?: string): Promise<string> {
    if (isWeb) {
      this.stopWebSpeechRecognition();
      const transcript = this.webSpeechTranscript.trim();
      logger.log('[Recording] Web STT final transcript:', transcript.substring(0, 80) || '(empty)');
      this.webSpeechTranscript = '';
      return transcript;
    }

    this.silenceDetection.stopSilenceDetection();
    this.silenceDetection.clearMaxRecordingTimer();

    if (!this.recording) {
      throw new Error('No active recording');
    }

    try {
      logger.log('[Recording] Stopping native recording...');
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;

      if (!uri) {
        throw new Error('No recording URI available');
      }

      const recordDuration = Date.now() - this.recordingStartTime;
      logger.log('[Recording] Recording saved, duration:', recordDuration, 'ms');

      if (recordDuration < 500) {
        logger.log('[Recording] Recording too short, skipping transcription');
        return '';
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      return await voiceAIService.transcribeFileUri(uri, 'audio/wav', 'recording.wav', language);
    } catch (err: any) {
      this.recording = null;
      logger.error('[Recording] Transcription pipeline error:', err);
      throw new Error(err?.message ?? 'Failed to process voice input');
    }
  }

  async cancelRecording(): Promise<void> {
    if (isWeb) {
      this.stopWebSpeechRecognition();
      this.webSpeechTranscript = '';
      return;
    }
    this.silenceDetection.stopSilenceDetection();
    this.silenceDetection.clearMaxRecordingTimer();
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch {
        // ignore
      }
      this.recording = null;
    }
  }

  getIsRecording(): boolean {
    return this.recording !== null;
  }
}
