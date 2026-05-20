import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { logger } from '../../utils/logger';

const isWeb = Platform.OS === 'web';

export class PlaybackService {
  private isSpeaking = false;
  private playbackSound: Audio.Sound | null = null;
  private webAudioElement: HTMLAudioElement | null = null;
  private detectedLang = 'en';
  private ttsLanguage = 'en-US';

  // Cache the selected female voice identifier (web only)
  private _femaleVoice: string | null = null;
  private _voiceSearchDone = false;

  setLanguage(lang: string, ttsLanguage: string): void {
    this.detectedLang = lang;
    this.ttsLanguage = ttsLanguage;
  }

  async playTTS(text: string, voice: string = 'nova'): Promise<void> {
    try {
      await this.stopPlaybackAsync();
      this.isSpeaking = true;
      logger.log('[Playback] Speaking (', this.detectedLang, '):', text.substring(0, 60));

      if (!isWeb) {
        await this.playTTSNative(text, voice);
      } else {
        await this.playTTSWeb(text, voice);
      }
    } catch (err) {
      logger.error('[Playback] TTS error:', err);
      this.isSpeaking = false;
    }
  }

  private async playTTSNative(text: string, _voice: string): Promise<void> {
    await this.speakWithExpoSpeech(text);
  }

  private async playTTSWeb(text: string, _voice: string): Promise<void> {
    await this.speakWithExpoSpeech(text);
  }

  async playAudioUrl(audioUrl: string): Promise<void> {
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

  private findFemaleVoice(lang: string): string | null {
    if (!isWeb || typeof window === 'undefined') return null;
    if (this._voiceSearchDone) return this._femaleVoice;
    try {
      const synth = window.speechSynthesis;
      const voices = synth.getVoices();
      if (voices.length === 0) return null;
      this._voiceSearchDone = true;

      const langPrefix = lang.split('-')[0].toLowerCase();

      const femaleKeywords = ['female', 'woman', 'girl', 'zira', 'samantha', 'karen', 'fiona', 'moira', 'tessa', 'victoria', 'susan', 'hazel', 'catherine'];
      const langVoices = voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));
      const allCandidates = langVoices.length > 0 ? langVoices : voices;

      for (const v of allCandidates) {
        const name = v.name.toLowerCase();
        if (femaleKeywords.some(kw => name.includes(kw))) {
          logger.log('[Playback] Selected female voice:', v.name, v.lang);
          this._femaleVoice = v.name;
          return v.name;
        }
      }
      if (langVoices.length > 0) {
        this._femaleVoice = langVoices[0].name;
        logger.log('[Playback] Using first lang voice:', langVoices[0].name);
        return this._femaleVoice;
      }
    } catch (err) {
      logger.warn('[Playback] Voice search error:', err);
    }
    return null;
  }

  private splitTextForTTS(text: string): string[] {
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

    return chunks.length > 0 ? chunks : [text];
  }

  private async speakWithExpoSpeech(text: string): Promise<void> {
    const chunks = this.splitTextForTTS(text);
    const lang = this.detectedLang === 'ar' ? 'ar-SA' : this.ttsLanguage;
    logger.log('[Playback] expo-speech speaking, lang:', lang, 'chunks:', chunks.length, 'text:', text.substring(0, 60));

    const voiceName = this.findFemaleVoice(lang);

    for (const chunk of chunks) {
      if (!this.isSpeaking) break;
      await this.speakChunk(chunk, lang, voiceName);
    }
    this.isSpeaking = false;
  }

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
          pitch: 1.1,
          onDone: done,
          onStopped: done,
          onError: (err: any) => {
            logger.warn('[Playback] expo-speech chunk error:', err);
            done();
          },
        };
        if (voiceName && isWeb) {
          options.voice = voiceName;
        }
        Speech.speak(text, options);
        const timeoutMs = Math.max(8000, 3000 + text.length * 80);
        setTimeout(() => {
          if (!resolved) {
            logger.warn('[Playback] expo-speech chunk timeout after', timeoutMs, 'ms');
            Speech.stop();
            done();
          }
        }, timeoutMs);
      } catch (err) {
        logger.warn('[Playback] expo-speech chunk threw:', err);
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
}
