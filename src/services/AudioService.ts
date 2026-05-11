import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { voiceAIService } from './VoiceAIService';
import { logger } from '../utils/logger';

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

const SILENCE_THRESHOLD_DB = -38;
const VOICE_DETECTED_DB = -30;
const SILENCE_DURATION_MS = 2500;
const METERING_INTERVAL_MS = 200;
const MIN_RECORDING_MS = 800;
const TTS_NATIVE_TIMEOUT_MS = 12000;

// Hard cap: recording will ALWAYS stop after this, regardless of metering
const HARD_MAX_RECORDING_MS = 12000;
// Time-based fallback: if metering doesn't work, record for this long then stop
const FALLBACK_RECORD_DURATION_MS = 5000;
// Number of metering polls to check before deciding metering is broken
const METERING_CHECK_POLLS = 5;
// What metering value means "no data" (expo-av returns -160 or undefined when broken)
const METERING_NO_DATA_DB = -120;

// Web-specific
const WEB_MIN_RECORD_MS = 3000;
const WEB_MAX_RECORD_MS = 10000;
const WEB_SILENCE_CHECK_MS = 1500;

export class AudioService {
  private recording: Audio.Recording | null = null;
  private isSpeaking = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private meteringInterval: ReturnType<typeof setInterval> | null = null;
  private recordingStartTime = 0;
  private onSilenceCallback: (() => void) | null = null;
  private voiceDetected = false;
  private silenceCallbackFired = false;
  private maxRecordingTimer: ReturnType<typeof setTimeout> | null = null;
  private ttsLanguage = 'en-US';
  private detectedLang = 'en';

  // Web Audio API for better web metering
  private webAudioContext: AudioContext | null = null;
  private webAnalyser: AnalyserNode | null = null;
  private webMediaStream: MediaStream | null = null;
  private webMediaSource: MediaStreamAudioSourceNode | null = null;

  // Web Speech API for browser-native STT (replaces Pollinations STT on web)
  private webSpeechRecognition: any = null;
  private webSpeechTranscript = '';
  private webSpeechActive = false;

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
      logger.error('[AudioService] Permission error:', err);
      return false;
    }
  }

  /**
   * Start recording audio from the microphone.
   * In live mode, pass onSilence to auto-stop after silence.
   *
   * On WEB: Uses browser's SpeechRecognition API which handles recording,
   * silence detection, AND transcription all in one — zero API calls needed.
   *
   * On NATIVE: Uses expo-av recording + silence detection + Pollinations STT.
   */
  async startRecording(onSilence?: () => void): Promise<boolean> {
    // ── WEB: Use browser SpeechRecognition ──
    if (isWeb) {
      return this.startWebSpeechRecognition(onSilence);
    }

    // ── NATIVE: Use expo-av recording ──
    try {
      if (this.recording) {
        await this.cancelRecording();
      }
      await this.stopPlaybackAsync();

      const hasPermission = await this.ensureMicPermission();
      if (!hasPermission) {
        logger.error('[AudioService] Microphone permission denied');
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
        logger.warn('[AudioService] Audio mode switch failed, retrying:', modeErr);
        await new Promise(r => setTimeout(r, 200));
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      }

      logger.log('[AudioService] Starting native recording...');
      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);
      this.recording = recording;
      this.recordingStartTime = Date.now();
      this.onSilenceCallback = onSilence ?? null;
      this.voiceDetected = false;
      this.silenceCallbackFired = false;
      this.clearMaxRecordingTimer();

      logger.log('[AudioService] Native recording started (silence:', !!onSilence, ')');

      if (onSilence) {
        this.startSilenceDetection();
        this.maxRecordingTimer = setTimeout(() => {
          logger.log('[AudioService] Hard max recording time reached, forcing stop');
          this.fireSilenceCallback();
        }, HARD_MAX_RECORDING_MS);
      }

      return true;
    } catch (err) {
      logger.error('[AudioService] Start recording error:', err);
      this.recording = null;
      return false;
    }
  }

  /**
   * Web-only: Start browser SpeechRecognition.
   * Handles recording + silence detection + transcription in one step.
   * When speech ends (silence detected by browser), fires onSilence callback.
   */
  private startWebSpeechRecognition(onSilence?: () => void): boolean {
    try {
      this.stopWebSpeechRecognition();
      this.stopPlayback();

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        logger.error('[AudioService] SpeechRecognition not supported in this browser');
        return false;
      }

      this.webSpeechTranscript = '';
      this.webSpeechActive = true;
      this.voiceDetected = false;
      this.silenceCallbackFired = false;
      this.recordingStartTime = Date.now();
      this.onSilenceCallback = onSilence ?? null;

      const recognition = new SpeechRecognition();
      recognition.continuous = false; // Auto-stop after silence
      recognition.interimResults = true;
      recognition.lang = this.ttsLanguage; // Match TTS language
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
        logger.log('[AudioService] Web STT interim:', transcript.substring(0, 60));
      };

      recognition.onend = () => {
        logger.log('[AudioService] Web SpeechRecognition ended, transcript:', this.webSpeechTranscript.substring(0, 60) || '(empty)');
        this.webSpeechActive = false;
        // Fire silence callback to trigger the transcribe→AI→TTS flow
        if (!this.silenceCallbackFired) {
          this.silenceCallbackFired = true;
          const cb = this.onSilenceCallback;
          this.onSilenceCallback = null;
          cb?.();
        }
      };

      recognition.onerror = (event: any) => {
        logger.warn('[AudioService] Web SpeechRecognition error:', event.error);
        this.webSpeechActive = false;
        // 'no-speech' is normal — user didn't speak, just fire silence
        if (!this.silenceCallbackFired) {
          this.silenceCallbackFired = true;
          const cb = this.onSilenceCallback;
          this.onSilenceCallback = null;
          cb?.();
        }
      };

      recognition.start();
      this.webSpeechRecognition = recognition;

      // Safety timeout: force stop after HARD_MAX_RECORDING_MS
      this.maxRecordingTimer = setTimeout(() => {
        logger.log('[AudioService] Web STT hard timeout, stopping');
        this.stopWebSpeechRecognition();
      }, HARD_MAX_RECORDING_MS);

      logger.log('[AudioService] Web SpeechRecognition started (lang:', this.ttsLanguage, ')');
      return true;
    } catch (err) {
      logger.error('[AudioService] Web SpeechRecognition start error:', err);
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

  /**
   * Set up Web Audio API AnalyserNode for real metering on web.
   * Falls back gracefully if unavailable.
   */
  private async setupWebAudioAnalyser(): Promise<void> {
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
      logger.log('[AudioService] Web Audio API analyser initialized');
    } catch (err) {
      logger.warn('[AudioService] Web Audio API setup failed, using fallback:', err);
      this.cleanupWebAudio();
    }
  }

  /**
   * Get current audio level in dB using Web Audio API.
   * Returns null if analyser is not available.
   */
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
      // Convert 0-255 scale to approximate dB (-160 to 0)
      if (avg === 0) return -160;
      const db = 20 * Math.log10(avg / 255);
      return db;
    } catch {
      return null;
    }
  }

  private cleanupWebAudio(): void {
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

  /**
   * Poll recording metering to detect silence and auto-stop.
   *
   * ARCHITECTURE: Three-tier approach for BOTH web and native:
   *
   * 1. METERING: If metering returns real dB values AND voice is detected (>= -30dB),
   *    use voice-detect → silence-after-voice logic.
   *
   * 2. FALLBACK TIMER: If voice is never detected within FALLBACK_RECORD_DURATION_MS,
   *    assume user spoke and force-fire silence callback. This handles:
   *    - Web: browser mic gain too low, Web Audio API returning weak values
   *    - Native: expo-av metering returning -160 / undefined
   *
   * 3. HARD CAP: maxRecordingTimer (set in startRecording) always fires as final safety net.
   *
   * The fallback timer is ALWAYS scheduled. If metering detects voice+silence first,
   * the fallback is cancelled. This guarantees the recording always stops.
   */
  private startSilenceDetection(): void {
    this.stopSilenceDetection();
    let silentSince = 0;
    let fallbackScheduled = false;

    logger.log('[AudioService] Starting silence detection (platform:', Platform.OS, ', web:', isWeb, ')');

    // ── ALWAYS schedule a fallback timer ──
    // This guarantees recording stops even if metering never detects voice.
    // If metering works and detects voice→silence first, fireSilenceCallback()
    // will set silenceCallbackFired=true and the fallback becomes a no-op.
    this.silenceTimer = setTimeout(() => {
      if (this.silenceCallbackFired) return;
      logger.log('[AudioService] Fallback timer fired — metering did not detect voice/silence in time');
      this.voiceDetected = true;
      this.fireSilenceCallback();
    }, FALLBACK_RECORD_DURATION_MS);
    fallbackScheduled = true;
    logger.log('[AudioService] Fallback timer scheduled at', FALLBACK_RECORD_DURATION_MS, 'ms');

    this.meteringInterval = setInterval(async () => {
      if (!this.recording || this.silenceCallbackFired) {
        this.stopSilenceDetection();
        return;
      }

      const elapsed = Date.now() - this.recordingStartTime;
      if (elapsed < MIN_RECORDING_MS) return;

      try {
        let db: number | null = null;

        if (isWeb) {
          // Web: try Web Audio API analyser
          db = this.getWebAudioLevel();
          if (db === null) {
            // No analyser available — fallback timer will handle it
            return;
          }
        } else {
          // Native: expo-av metering
          const status = await this.recording.getStatusAsync();
          if (!status.isRecording) return;
          const rawDb = status.metering ?? -160;
          // If metering returns -160 (no data), ignore — fallback timer handles it
          if (rawDb <= METERING_NO_DATA_DB) return;
          db = rawDb;
        }

        // ── Metering returned a real value ──

        // Voice detection
        if (db >= VOICE_DETECTED_DB) {
          if (!this.voiceDetected) {
            logger.log('[AudioService] Voice detected (dB:', db.toFixed(1), ')');
            // Voice detected! Cancel the fallback timer — metering is working,
            // we'll now wait for silence after speech instead.
            if (fallbackScheduled && this.silenceTimer) {
              clearTimeout(this.silenceTimer);
              this.silenceTimer = null;
              fallbackScheduled = false;
              logger.log('[AudioService] Fallback timer cancelled — metering working');
              // Schedule a new, longer fallback in case silence is never detected
              this.silenceTimer = setTimeout(() => {
                if (this.silenceCallbackFired) return;
                logger.log('[AudioService] Extended fallback: voice detected but silence never came');
                this.fireSilenceCallback();
              }, HARD_MAX_RECORDING_MS - elapsed);
            }
          }
          this.voiceDetected = true;
          silentSince = 0;
          return;
        }

        // Silence detection (only after voice was detected via metering)
        if (!this.voiceDetected) return;

        if (db < SILENCE_THRESHOLD_DB) {
          if (silentSince === 0) silentSince = Date.now();
          const silentFor = Date.now() - silentSince;
          if (silentFor >= SILENCE_DURATION_MS) {
            logger.log('[AudioService] Silence detected after speech (', silentFor, 'ms, dB:', db.toFixed(1), ')');
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

  private fireSilenceCallback(): void {
    if (this.silenceCallbackFired) return;
    this.silenceCallbackFired = true;
    const cb = this.onSilenceCallback;
    this.stopSilenceDetection();
    cb?.();
  }

  private stopSilenceDetection(): void {
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

  private clearMaxRecordingTimer(): void {
    if (this.maxRecordingTimer) {
      clearTimeout(this.maxRecordingTimer);
      this.maxRecordingTimer = null;
    }
  }

  hadVoiceActivity(): boolean {
    return this.voiceDetected;
  }

  /**
   * Stop recording and return transcribed text.
   *
   * On WEB: Returns the transcript already captured by SpeechRecognition (no API call).
   * On NATIVE: Stops expo-av recording and sends audio to Pollinations STT.
   */
  async stopRecordingAndTranscribe(language?: string): Promise<string> {
    // ── WEB: Return stored SpeechRecognition transcript ──
    if (isWeb) {
      this.stopWebSpeechRecognition();
      const transcript = this.webSpeechTranscript.trim();
      logger.log('[AudioService] Web STT final transcript:', transcript.substring(0, 80) || '(empty)');
      this.webSpeechTranscript = '';
      return transcript;
    }

    // ── NATIVE: Stop expo-av recording and transcribe via API ──
    this.stopSilenceDetection();
    this.clearMaxRecordingTimer();

    if (!this.recording) {
      throw new Error('No active recording');
    }

    try {
      logger.log('[AudioService] Stopping native recording...');
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;

      if (!uri) {
        throw new Error('No recording URI available');
      }

      const recordDuration = Date.now() - this.recordingStartTime;
      logger.log('[AudioService] Recording saved, duration:', recordDuration, 'ms');

      if (recordDuration < 500) {
        logger.log('[AudioService] Recording too short, skipping transcription');
        return '';
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      return await voiceAIService.transcribeFileUri(uri, 'audio/wav', 'recording.wav', language);
    } catch (err: any) {
      this.recording = null;
      logger.error('[AudioService] Transcription pipeline error:', err);
      throw new Error(err?.message ?? 'Failed to process voice input');
    }
  }

  async cancelRecording(): Promise<void> {
    if (isWeb) {
      this.stopWebSpeechRecognition();
      this.webSpeechTranscript = '';
      return;
    }
    this.stopSilenceDetection();
    this.clearMaxRecordingTimer();
    if (this.recording) {
      try {
        await this.recording.stopAndUnloadAsync();
      } catch {
        // ignore
      }
      this.recording = null;
    }
  }

  private playbackSound: Audio.Sound | null = null;
  private _permissionGranted: boolean | null = null;

  /**
   * Pre-request mic permission so it's ready when recording starts.
   * Call once early (e.g. before TTS greeting) to avoid delays in the auto-listen loop.
   */
  async ensureMicPermission(): Promise<boolean> {
    if (this._permissionGranted === true) return true;
    const granted = await this.requestPermissions();
    this._permissionGranted = granted;
    return granted;
  }

  /**
   * Properly await all playback resource cleanup.
   * Unlike stopPlayback(), this waits for async unloads to complete.
   */
  async stopPlaybackAsync(): Promise<void> {
    try { Speech.stop(); } catch { /* ignore */ }
    if (this.playbackSound) {
      try {
        await this.playbackSound.stopAsync();
        await this.playbackSound.unloadAsync();
      } catch { /* ignore */ }
      this.playbackSound = null;
    }
    if (this.webAudioElement) {
      try {
        this.webAudioElement.pause();
        this.webAudioElement.src = '';
      } catch { /* ignore */ }
      this.webAudioElement = null;
    }
    this.isSpeaking = false;
  }

  /**
   * Speak text aloud.
   *
   * Strategy per platform:
   *   Native (iOS/Android):
   *     1. expo-speech (instant, no network, most reliable)
   *     2. Pollinations GET stream URL → expo-av (better voice, but adds latency)
   *   Web:
   *     1. Pollinations POST → blob URL → HTML Audio
   *     2. Pollinations GET → blob URL → HTML Audio
   *     3. expo-speech (SpeechSynthesis) fallback
   *
   * Arabic always routes to expo-speech with ar-SA for best pronunciation.
   */
  async playTTS(text: string, voice: string = 'nova'): Promise<void> {
    try {
      await this.stopPlaybackAsync();
      this.isSpeaking = true;
      logger.log('[AudioService] Speaking (', this.detectedLang, '):', text.substring(0, 60));

      if (!isWeb) {
        await this.playTTSNative(text, voice);
      } else {
        await this.playTTSWeb(text, voice);
      }
    } catch (err) {
      logger.error('[AudioService] TTS error:', err);
      this.isSpeaking = false;
    }
  }

  /**
   * Native TTS: expo-speech first (instant, reliable), Pollinations stream as enhancement.
   * Always resolves — never blocks the conversation loop.
   */
  private async playTTSNative(text: string, voice: string): Promise<void> {
    // expo-speech is the primary TTS engine on native — zero network latency
    await this.speakWithExpoSpeech(text);
  }

  /**
   * Web TTS: use browser SpeechSynthesis directly (via expo-speech).
   * Pollinations free tier has no audio model, so we skip API TTS entirely.
   * This gives zero-latency speech with no network dependency.
   */
  private async playTTSWeb(text: string, voice: string): Promise<void> {
    await this.speakWithExpoSpeech(text);
  }

  /**
   * Play an audio URL on web only (native uses playTTSNative instead).
   * Kept for any other audio playback needs.
   */
  private async playAudioUrl(audioUrl: string): Promise<void> {
    if (isWeb) {
      await this.playWebAudio(audioUrl);
    } else {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      } catch { /* ignore */ }
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, volume: 1.0 },
      );
      this.playbackSound = sound;
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          sound.unloadAsync().catch(() => {});
          this.playbackSound = null;
          reject(new Error('Playback timeout'));
        }, 60000);
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            clearTimeout(timeout);
            this.isSpeaking = false;
            sound.unloadAsync().catch(() => {});
            this.playbackSound = null;
            resolve();
          }
        });
      });
    }
  }

  // Cache the selected female voice identifier (web only)
  private _femaleVoice: string | null = null;
  private _voiceSearchDone = false;

  /**
   * Find a female voice from the browser's SpeechSynthesis voices.
   * Prefers voices with "female" in the name, or well-known female voices.
   */
  private findFemaleVoice(lang: string): string | null {
    if (!isWeb || typeof window === 'undefined') return null;
    if (this._voiceSearchDone) return this._femaleVoice;
    try {
      const synth = window.speechSynthesis;
      const voices = synth.getVoices();
      if (voices.length === 0) return null; // voices not loaded yet
      this._voiceSearchDone = true;

      const langPrefix = lang.split('-')[0].toLowerCase();

      // Prefer: female keyword, then known female voice names
      const femaleKeywords = ['female', 'woman', 'girl', 'zira', 'samantha', 'karen', 'fiona', 'moira', 'tessa', 'victoria', 'susan', 'hazel', 'catherine'];
      const langVoices = voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));
      const allCandidates = langVoices.length > 0 ? langVoices : voices;

      for (const v of allCandidates) {
        const name = v.name.toLowerCase();
        if (femaleKeywords.some(kw => name.includes(kw))) {
          logger.log('[AudioService] Selected female voice:', v.name, v.lang);
          this._femaleVoice = v.name;
          return v.name;
        }
      }
      // Fallback: pick first voice for the language (many defaults are female)
      if (langVoices.length > 0) {
        this._femaleVoice = langVoices[0].name;
        logger.log('[AudioService] Using first lang voice:', langVoices[0].name);
        return this._femaleVoice;
      }
    } catch (err) {
      logger.warn('[AudioService] Voice search error:', err);
    }
    return null;
  }

  /**
   * Split text into sentence-sized chunks for reliable TTS playback.
   * Browser SpeechSynthesis often cuts off text longer than ~200 chars.
   */
  private splitTextForTTS(text: string): string[] {
    // Split on sentence boundaries
    const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g);
    if (!sentences) return [text];

    const MAX_CHUNK = 180;
    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      if ((current + sentence).length > MAX_CHUNK && current.length > 0) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim()) chunks.push(current.trim());

    // If no sentence boundaries were found, just return the original
    return chunks.length > 0 ? chunks : [text];
  }

  /**
   * Speak with expo-speech — primary TTS engine on native.
   * Reliable, no network latency, supports all languages.
   * Uses a female voice, splits long text into chunks to prevent cutoff.
   */
  private async speakWithExpoSpeech(text: string): Promise<void> {
    const chunks = this.splitTextForTTS(text);
    const lang = this.detectedLang === 'ar' ? 'ar-SA' : this.ttsLanguage;
    logger.log('[AudioService] expo-speech speaking, lang:', lang, 'chunks:', chunks.length, 'text:', text.substring(0, 60));

    // Find female voice on web
    const voiceName = this.findFemaleVoice(lang);

    for (const chunk of chunks) {
      if (!this.isSpeaking) break; // Stopped externally
      await this.speakChunk(chunk, lang, voiceName);
    }
    this.isSpeaking = false;
  }

  /**
   * Speak a single chunk of text. Returns a promise that resolves when done.
   */
  private speakChunk(text: string, lang: string, voiceName: string | null): Promise<void> {
    return new Promise<void>((resolve) => {
      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        resolve();
      };
      try {
        const options: Record<string, any> = {
          language: lang,
          rate: this.detectedLang === 'ar' ? 0.9 : 1.0,
          pitch: 1.1, // Slightly higher pitch for feminine voice
          onDone: done,
          onStopped: done,
          onError: (err: any) => {
            logger.warn('[AudioService] expo-speech chunk error:', err);
            done();
          },
        };
        // Set voice on web if we found a female one
        if (voiceName && isWeb) {
          options.voice = voiceName;
        }
        Speech.speak(text, options);
        // Scale timeout by text length: ~80ms per character + 3s base
        const timeoutMs = Math.max(8000, 3000 + text.length * 80);
        setTimeout(() => {
          if (!resolved) {
            logger.warn('[AudioService] expo-speech chunk timeout after', timeoutMs, 'ms');
            Speech.stop();
            done();
          }
        }, timeoutMs);
      } catch (err) {
        logger.warn('[AudioService] expo-speech chunk threw:', err);
        done();
      }
    });
  }

  private playWebAudio(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('No window object'));
        return;
      }
      const audio = new window.Audio(url);
      this.webAudioElement = audio;

      const cleanup = () => {
        this.webAudioElement = null;
        try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      };

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Web audio playback timeout'));
      }, 60000);

      audio.onended = () => {
        clearTimeout(timeout);
        cleanup();
        resolve();
      };
      audio.onerror = (e) => {
        clearTimeout(timeout);
        cleanup();
        reject(e);
      };
      audio.play().catch((err) => {
        clearTimeout(timeout);
        cleanup();
        reject(err);
      });
    });
  }

  private webAudioElement: HTMLAudioElement | null = null;

  stopPlayback(): void {
    try { Speech.stop(); } catch { /* ignore */ }
    if (this.playbackSound) {
      try {
        this.playbackSound.stopAsync();
        this.playbackSound.unloadAsync();
      } catch { /* ignore */ }
      this.playbackSound = null;
    }
    if (this.webAudioElement) {
      try {
        this.webAudioElement.pause();
        this.webAudioElement.src = '';
      } catch { /* ignore */ }
      this.webAudioElement = null;
    }
    this.isSpeaking = false;
  }

  getIsPlaying(): boolean {
    return this.isSpeaking;
  }

  getIsRecording(): boolean {
    return this.recording !== null;
  }
}

export const audioService = new AudioService();
