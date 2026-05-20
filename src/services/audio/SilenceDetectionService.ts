import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { logger } from '../../utils/logger';

const isWeb = Platform.OS === 'web';

const SILENCE_THRESHOLD_DB = -38;
const VOICE_DETECTED_DB = -30;
const SILENCE_DURATION_MS = 2500;
const METERING_INTERVAL_MS = 200;
const MIN_RECORDING_MS = 800;
const HARD_MAX_RECORDING_MS = 12000;
const FALLBACK_RECORD_DURATION_MS = 5000;
const METERING_NO_DATA_DB = -120;

export class SilenceDetectionService {
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private meteringInterval: ReturnType<typeof setInterval> | null = null;
  private maxRecordingTimer: ReturnType<typeof setTimeout> | null = null;
  private onSilenceCallback: (() => void) | null = null;
  private silenceCallbackFired = false;
  voiceDetected = false;

  // Web Audio API for better web metering
  private webAudioContext: AudioContext | null = null;
  private webAnalyser: AnalyserNode | null = null;
  private webMediaStream: MediaStream | null = null;
  private webMediaSource: MediaStreamAudioSourceNode | null = null;

  reset(): void {
    this.voiceDetected = false;
    this.silenceCallbackFired = false;
  }

  hadVoiceActivity(): boolean {
    return this.voiceDetected;
  }

  startMaxRecordingTimer(onFire: () => void): void {
    this.clearMaxRecordingTimer();
    this.maxRecordingTimer = setTimeout(() => {
      logger.log('[SilenceDetection] Hard max recording time reached, forcing stop');
      onFire();
    }, HARD_MAX_RECORDING_MS);
  }

  startSilenceDetection(
    recording: Audio.Recording | null,
    recordingStartTime: number,
    onSilence: () => void,
  ): void {
    this.stopSilenceDetection();
    this.onSilenceCallback = onSilence;
    let silentSince = 0;
    let fallbackScheduled = false;

    logger.log('[SilenceDetection] Starting silence detection (platform:', Platform.OS, ', web:', isWeb, ')');

    this.silenceTimer = setTimeout(() => {
      if (this.silenceCallbackFired) return;
      logger.log('[SilenceDetection] Fallback timer fired — metering did not detect voice/silence in time');
      this.voiceDetected = true;
      this.fireSilenceCallback();
    }, FALLBACK_RECORD_DURATION_MS);
    fallbackScheduled = true;
    logger.log('[SilenceDetection] Fallback timer scheduled at', FALLBACK_RECORD_DURATION_MS, 'ms');

    this.meteringInterval = setInterval(async () => {
      if (!recording || this.silenceCallbackFired) {
        this.stopSilenceDetection();
        return;
      }

      const elapsed = Date.now() - recordingStartTime;
      if (elapsed < MIN_RECORDING_MS) return;

      try {
        let db: number | null = null;

        if (isWeb) {
          db = this.getWebAudioLevel();
          if (db === null) return;
        } else {
          const status = await recording.getStatusAsync();
          if (!status.isRecording) return;
          const rawDb = status.metering ?? -160;
          if (rawDb <= METERING_NO_DATA_DB) return;
          db = rawDb;
        }

        if (db >= VOICE_DETECTED_DB) {
          if (!this.voiceDetected) {
            logger.log('[SilenceDetection] Voice detected (dB:', db.toFixed(1), ')');
            if (fallbackScheduled && this.silenceTimer) {
              clearTimeout(this.silenceTimer);
              this.silenceTimer = null;
              fallbackScheduled = false;
              logger.log('[SilenceDetection] Fallback timer cancelled — metering working');
              this.silenceTimer = setTimeout(() => {
                if (this.silenceCallbackFired) return;
                logger.log('[SilenceDetection] Extended fallback: voice detected but silence never came');
                this.fireSilenceCallback();
              }, HARD_MAX_RECORDING_MS - elapsed);
            }
          }
          this.voiceDetected = true;
          silentSince = 0;
          return;
        }

        if (!this.voiceDetected) return;

        if (db < SILENCE_THRESHOLD_DB) {
          if (silentSince === 0) silentSince = Date.now();
          const silentFor = Date.now() - silentSince;
          if (silentFor >= SILENCE_DURATION_MS) {
            logger.log('[SilenceDetection] Silence detected after speech (', silentFor, 'ms, dB:', db.toFixed(1), ')');
            this.fireSilenceCallback();
          }
        } else {
          silentSince = 0;
        }
      } catch {
        // recording may have ended
      }
    }, METERING_INTERVAL_MS);
  }

  fireSilenceCallback(): void {
    if (this.silenceCallbackFired) return;
    this.silenceCallbackFired = true;
    const cb = this.onSilenceCallback;
    this.stopSilenceDetection();
    cb?.();
  }

  stopSilenceDetection(): void {
    if (this.meteringInterval) {
      clearInterval(this.meteringInterval);
      this.meteringInterval = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.onSilenceCallback = null;
  }

  clearMaxRecordingTimer(): void {
    if (this.maxRecordingTimer) {
      clearTimeout(this.maxRecordingTimer);
      this.maxRecordingTimer = null;
    }
  }

  async setupWebAudioAnalyser(): Promise<void> {
    try {
      if (typeof window === 'undefined' || !window.AudioContext) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.webMediaStream = stream;
      this.webAudioContext = new AudioContext();
      this.webAnalyser = this.webAudioContext.createAnalyser();
      this.webAnalyser.fftSize = 256;
      this.webAnalyser.smoothingTimeConstant = 0.3;
      this.webMediaSource = this.webAudioContext.createMediaStreamSource(stream);
      this.webMediaSource.connect(this.webAnalyser);
      logger.log('[SilenceDetection] Web Audio API analyser initialized');
    } catch (err) {
      logger.warn('[SilenceDetection] Web Audio API setup failed, using fallback:', err);
      this.cleanupWebAudio();
    }
  }

  private getWebAudioLevel(): number | null {
    if (!this.webAnalyser) return null;
    try {
      const dataArray = new Uint8Array(this.webAnalyser.frequencyBinCount);
      this.webAnalyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      if (avg === 0) return -160;
      const db = 20 * Math.log10(avg / 255);
      return db;
    } catch {
      return null;
    }
  }

  cleanupWebAudio(): void {
    try { this.webMediaSource?.disconnect(); } catch { /* ignore */ }
    try { this.webAnalyser?.disconnect(); } catch { /* ignore */ }
    try { this.webAudioContext?.close(); } catch { /* ignore */ }
    if (this.webMediaStream) {
      this.webMediaStream.getTracks().forEach(t => t.stop());
    }
    this.webMediaSource = null;
    this.webAnalyser = null;
    this.webAudioContext = null;
    this.webMediaStream = null;
  }
}

export const silenceDetectionService = new SilenceDetectionService();
