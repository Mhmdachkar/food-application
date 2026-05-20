import type { ChatMessage } from '../models/VoiceCallTypes';
import { VoiceSTTService } from './voice/VoiceSTTService';
import { VoiceTTSService } from './voice/VoiceTTSService';
import { VoiceChatService } from './voice/VoiceChatService';

export { VoiceSTTService } from './voice/VoiceSTTService';
export { VoiceTTSService } from './voice/VoiceTTSService';
export { VoiceChatService } from './voice/VoiceChatService';

export class VoiceAIService {
  private sttService = new VoiceSTTService();
  private ttsService = new VoiceTTSService();
  private chatService = new VoiceChatService();

  verifyConnection(): Promise<{ ok: boolean; error?: string }> {
    return this.chatService.verifyConnection();
  }

  transcribeAudioBlob(audioBlob: Blob, filename?: string, language?: string): Promise<string> {
    return this.sttService.transcribeAudioBlob(audioBlob, filename, language);
  }

  transcribeFileUri(fileUri: string, mimeType?: string, filename?: string, language?: string): Promise<string> {
    return this.sttService.transcribeFileUri(fileUri, mimeType, filename, language);
  }

  chat(messages: ChatMessage[], menuContext: string, foodMemoryContext: string, language?: string): Promise<string> {
    return this.chatService.chat(messages, menuContext, foodMemoryContext, language);
  }

  generateTtsAudioUrl(text: string, voice?: string): Promise<string> {
    return this.ttsService.generateTtsAudioUrl(text, voice);
  }

  getTtsStreamUrl(text: string, voice?: string): string {
    return this.ttsService.getTtsStreamUrl(text, voice);
  }

  generateTtsAudioUrlGet(text: string, voice?: string): Promise<string> {
    return this.ttsService.generateTtsAudioUrlGet(text, voice);
  }
}

export const voiceAIService = new VoiceAIService();
