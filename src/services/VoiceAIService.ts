import { Config } from '../config/Config';
import { Platform } from 'react-native';
import { File as ExpoFile } from 'expo-file-system';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatMessage,
} from '../models/VoiceCallTypes';
import { logger } from '../utils/logger';

/**
 * Convert an ArrayBuffer to a base64 string.
 * Works on both web and native (React Native).
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // btoa is available on both web and React Native (Hermes)
  return btoa(binary);
}

const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

// Pollinations requires a 'referrer' field in request bodies to bypass
// browser Origin-header deprecation detection on the free tier.
const POLLINATIONS_REFERRER = 'smartfood-app';

const PRIMARY_MODEL = 'openai';
const FALLBACK_MODEL = 'openai';
const PRIMARY_MAX_TOKENS = 300;
const FALLBACK_MAX_TOKENS = 512;
const MAX_MENU_CONTEXT_CHARS = 2000;
const MAX_HISTORY_MESSAGES = 10;

function fetchWithTimeout(
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

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(
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

async function parseApiError(res: Response): Promise<string> {
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

/**
 * Extract content from a chat completion response, handling multiple formats.
 */
function extractContent(data: any): string {
  // Standard OpenAI format
  const c1 = data?.choices?.[0]?.message?.content;
  if (typeof c1 === 'string' && c1.trim()) return c1.trim();

  // Some APIs use delta instead of message
  const c2 = data?.choices?.[0]?.delta?.content;
  if (typeof c2 === 'string' && c2.trim()) return c2.trim();

  // Some APIs use text field directly
  const c3 = data?.choices?.[0]?.text;
  if (typeof c3 === 'string' && c3.trim()) return c3.trim();

  // Fallback: top-level text or content
  const c4 = data?.text ?? data?.content ?? data?.response ?? data?.output;
  if (typeof c4 === 'string' && c4.trim()) return c4.trim();

  // Multiple choices — try all
  if (Array.isArray(data?.choices)) {
    for (const choice of data.choices) {
      const ct = choice?.message?.content ?? choice?.text ?? choice?.delta?.content;
      if (typeof ct === 'string' && ct.trim()) return ct.trim();
    }
  }

  return '';
}

export class VoiceAIService {
  private chatUrl = 'https://text.pollinations.ai/';
  private ttsUrl = Config.voiceTtsUrl || 'https://text.pollinations.ai/openai';
  private sttUrl = Config.voiceSttUrl || 'https://text.pollinations.ai/openai';

  private getHeaders(): Record<string, string> {
    // Anonymous free tier — NO Authorization header.
    // Sending any auth triggers Pollinations' "authenticated users" deprecation notice.
    return {
      'Content-Type': 'application/json',
    };
  }

  async verifyConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      // Check if text.pollinations.ai is reachable via the models endpoint
      const urlObj = new URL(this.chatUrl);
      const baseUrl = urlObj.origin;
      const res = await fetchWithTimeout(
        `${baseUrl}/models`,
        { method: 'GET' },
        8000,
      );
      if (res.ok) return { ok: true };
      // Any response means reachable
      if (res.status < 500) return { ok: true };
      return { ok: false, error: `API returned ${res.status}` };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? 'Cannot reach Pollinations API' };
    }
  }

  /**
   * Speech-to-Text via text.pollinations.ai openai-audio model (WEB).
   * Converts audio blob to base64 and sends via the chat endpoint.
   */
  async transcribeAudioBlob(audioBlob: Blob, filename: string = 'recording.webm', language?: string): Promise<string> {
    if (audioBlob.size < 100) {
      logger.warn('[VoiceAI] Audio blob too small:', audioBlob.size);
      return '';
    }

    try {
      logger.log('[VoiceAI] STT request (web/base64), size:', audioBlob.size, 'lang:', language ?? 'auto');
      const base64 = await this._blobToBase64(audioBlob);
      return await this._transcribeBase64(base64, filename.endsWith('.wav') ? 'wav' : 'webm', language);
    } catch (err: any) {
      if (err?.message?.includes('timed out')) {
        throw new Error('Speech recognition timed out. Please try again.');
      }
      throw new Error(err?.message ?? 'Transcription failed');
    }
  }

  /**
   * Speech-to-Text via text.pollinations.ai openai-audio model (NATIVE).
   * Reads file, converts to base64, sends via chat endpoint.
   */
  async transcribeFileUri(fileUri: string, mimeType: string = 'audio/wav', filename: string = 'recording.wav', language?: string): Promise<string> {
    try {
      logger.log('[VoiceAI] STT request (native/base64), uri:', fileUri, 'lang:', language ?? 'auto');

      let base64: string;
      if (Platform.OS !== 'web') {
        // Native: read file using expo-file-system v19 File class
        try {
          const file = new ExpoFile(fileUri);
          const buffer = await file.arrayBuffer();
          base64 = arrayBufferToBase64(buffer);
          logger.log('[VoiceAI] Read file via ExpoFile.arrayBuffer(), base64 length:', base64.length);
        } catch (readErr: any) {
          logger.warn('[VoiceAI] ExpoFile.arrayBuffer() failed:', readErr?.message);
          // Fallback: try fetch + blob approach
          logger.log('[VoiceAI] Trying fetch+blob fallback for native...');
          try {
            const response = await fetch(fileUri);
            const blob = await response.blob();
            base64 = await this._blobToBase64(blob);
            logger.log('[VoiceAI] Read file via fetch+blob fallback, base64 length:', base64.length);
          } catch (fetchErr: any) {
            logger.error('[VoiceAI] fetch+blob fallback also failed:', fetchErr?.message);
            throw new Error('Could not read audio file for transcription');
          }
        }
      } else {
        // Web: use fetch + blob + FileReader
        const response = await fetch(fileUri);
        const blob = await response.blob();
        base64 = await this._blobToBase64(blob);
      }

      if (!base64 || base64.length < 100) {
        logger.warn('[VoiceAI] Base64 audio too small:', base64?.length ?? 0);
        return '';
      }

      const format = mimeType.includes('wav') ? 'wav' : mimeType.includes('webm') ? 'webm' : 'mp3';
      return await this._transcribeBase64(base64, format, language);
    } catch (err: any) {
      if (err?.message?.includes('timed out')) {
        throw new Error('Speech recognition timed out. Please try again.');
      }
      logger.error('[VoiceAI] transcribeFileUri error:', err?.message, err?.stack);
      throw new Error(err?.message ?? 'Transcription failed');
    }
  }

  /**
   * Convert a Blob to a base64 string (without the data URL prefix).
   */
  private _blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Strip the data:audio/...;base64, prefix
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read audio file'));
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Send base64-encoded audio to text.pollinations.ai for transcription
   * using the openai-audio model via the OpenAI-compatible chat endpoint.
   */
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
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    }, REQUEST_TIMEOUT_MS, 1);

    if (!res.ok) {
      const errMsg = await parseApiError(res);
      logger.error('[VoiceAI] STT error:', res.status, errMsg);
      throw new Error(`Transcription failed (${res.status}): ${errMsg}`);
    }

    const data = await res.json();
    const text = extractContent(data).trim();
    logger.log('[VoiceAI] STT result:', text.substring(0, 80) || '(empty)');
    return text;
  }

  /**
   * Main chat completion — sends conversation history + menu/prefs context.
   *
   * Intent classification is embedded in the main prompt to avoid a second API call.
   * Uses openai-large (GPT-5.2, non-reasoning) as primary; falls back to openai (GPT-5-mini,
   * reasoning) with high max_tokens if needed.
   * Returns the AI response text, never throws for empty responses (returns fallback instead).
   */
  async chat(
    messages: ChatMessage[],
    menuContext: string,
    foodMemoryContext: string,
    language: string = 'en',
  ): Promise<string> {
    const languageInstruction = language === 'ar'
      ? `LANGUAGE: Respond ENTIRELY in Arabic (العربية). Use natural Gulf/Levantine Arabic, not classical. All text must be Arabic.`
      : language !== 'en'
        ? `LANGUAGE: The user speaks "${language}". Respond in the same language.`
        : `LANGUAGE: English. If the user writes Arabic or another language, switch to that language.`;

    const trimmedMenu = menuContext.length > MAX_MENU_CONTEXT_CHARS
      ? menuContext.substring(0, MAX_MENU_CONTEXT_CHARS) + '\n...(more items available)'
      : menuContext;

    const recentMessages = messages.length > MAX_HISTORY_MESSAGES
      ? messages.slice(-MAX_HISTORY_MESSAGES)
      : messages;

    const systemContent = `You are Sara, a friendly and fast female food ordering assistant. Your tone is warm, cheerful, and conversational — like a helpful friend. All responses are spoken aloud via TTS.

${languageInstruction}

VOICE RULES:
- Keep responses ULTRA SHORT: 1-2 sentences max. This is a voice call, not a chat.
- Plain speech only. No markdown, bullets, asterisks, numbered lists, or special characters.
- For simple messages like "thanks", "okay", "sure", "bye" — respond in under 5 words.
- Never say "Sure!" or "Of course!" at the start of every reply. Vary your responses naturally.
- Bilingual: English and Arabic. Switch seamlessly based on user language.

CONVERSATION WORKFLOW:
1. BROWSING — User asks "what do you have?" / "show menu" / "what's good?"
   → Mention 2-3 top items with prices. Never dump the full menu.
   → Example: "Our classic burger is really popular at $12.99, and the caesar salad is great at $9.99. Want to try one?"

2. RECOMMENDATIONS — User asks for suggestions (popular, healthy, spicy, cheap, etc.)
   → Pick 2-3 matching items from the menu. Be specific with names and prices.
   → Example: "For something spicy, try the buffalo wings at $11.99 or the spicy chicken sandwich at $10.49."

3. ORDERING — User wants a specific item
   → Add it immediately with add_to_cart. Confirm in one sentence.
   → If the item has customization options (modifiers in menu), ask about them ONLY if they are marked required.
   → If item not found, suggest the closest match from the menu.
   → If item unavailable, say so and suggest an alternative.
   → Example: "Added the margherita pizza to your cart. Anything else?"

4. ITEM NOTES & CUSTOMIZATION — User says things like "no onions on the burger", "extra cheese", "make it spicy", "add ketchup"
   → If the note is about a specific item already in cart, use add_item_note with the item name and the note.
   → If the note is about an item being ordered right now, include "instructions" in the add_to_cart action.
   → Example user: "Add a burger but no pickles" → add_to_cart with instructions "no pickles"
   → Example user: "No onions on my pizza" → add_item_note for the pizza with "no onions"
   → ALWAYS confirm: "Got it, noted no pickles on your burger."

5. SMART SUGGESTIONS & UPSELLING — IMPORTANT: After adding a main item (burger, pizza, sandwich, pasta, chicken, sushi, bowl, etc.), proactively suggest complementary items:
   → If user ordered food but NO drink in cart: "Would you like a drink with that? We have cola, lemonade, and fresh juice."
   → If user ordered a burger/sandwich: "Want to make it a combo with fries and a drink?"
   → If user ordered pasta/pizza: "Would you like to add a side salad or garlic bread?"
   → If user ordered breakfast: "Want to add coffee or fresh juice?"
   → Only suggest ONCE per ordering round. Do NOT keep pushing if user says no or ignores.
   → If user has a default drink in preferences, suggest that specifically: "Want me to add your usual [defaultDrink]?"
   → Keep suggestions brief and natural, not pushy.

6. MULTIPLE ITEMS — User orders several things at once
   → Add each item. Confirm all in one sentence.
   → Example: "Added 2 burgers and a cola. Anything else?"

7. CART REVIEW — User asks "what's in my cart?" / "how much?"
   → Use view_cart action. Summarize items and total briefly.
   → Example: "You have 2 burgers and a cola, total $28.47. Ready to order?"

8. MODIFY CART — User wants to remove/change items
   → Execute remove_from_cart or update_quantity immediately. Confirm briefly.
   → Example: "Removed the cola. Your cart now has 2 burgers at $25.98."

9. CHECKOUT — User says "that's all" / "I'm done" / "checkout" / "خلاص" / "تمام"
   → If cart is empty: "Your cart is empty. What would you like to order?"
   → If cart has food but NO drink and user hasn't declined a drink yet: suggest a drink ONE last time before checkout.
   → If no address set: "What's your delivery address?" (ask ONCE only)
   → If address set: Execute confirm_order immediately.

10. ADDRESS — User provides delivery address
    → Execute set_address, then confirm_order in the same response.
    → Example: "Got it, delivering to 123 Main Street. Order confirmed!"

11. DELIVERY NOTES — User adds general delivery instructions ("ring doorbell", "leave at door", etc.)
    → Execute set_delivery_notes. Confirm briefly.
    → These are different from item notes. Delivery notes are for the driver, item notes are for the kitchen.

12. PROMO CODE — User mentions a promo or discount code
    → Execute apply_promo with the code. Confirm if it worked.

13. POST-ORDER — After order is confirmed
    → "Your order is on its way! You can track it in the Orders page. Anything else I can help with?"
    → If user says "bye" / "no" → "Enjoy your meal! Goodbye."

14. SMALL TALK — Greetings, thanks, jokes, off-topic
    → Keep it brief and steer back to food. 3-5 words max.
    → "hey" → "Hey! What can I get you?"
    → "thanks" → "You're welcome!"
    → "how are you" → "I'm great! Hungry for anything?"

15. DIETARY / ALLERGIES — User mentions allergies or dietary needs
    → Filter recommendations accordingly. Mention relevant tags from menu items.
    → "I'm allergic to nuts" → "Got it! The grilled chicken and caesar salad are nut-free. Want one?"

ACTION FORMAT — append exactly ONE action block at the END of every response:
|||ACTION:{"type":"<type>","itemName":"<name>","quantity":<n>}|||

Action types: add_to_cart, remove_from_cart, update_quantity, clear_cart, view_cart, apply_promo, set_delivery_notes, set_item_note, confirm_order, set_address, none
- For add_to_cart with notes: |||ACTION:{"type":"add_to_cart","itemName":"<name>","quantity":1,"instructions":"<special instructions>"}|||
- For set_item_note (add note to existing cart item): |||ACTION:{"type":"set_item_note","itemName":"<name>","note":"<note text>"}|||
- For set_address: |||ACTION:{"type":"set_address","address":"<full address>"}|||
- For set_delivery_notes: |||ACTION:{"type":"set_delivery_notes","notes":"<notes>"}|||
- For apply_promo: |||ACTION:{"type":"apply_promo","code":"<code>"}|||
- For simple responses with no action: |||ACTION:{"type":"none"}|||

USER PREFERENCES: ${foodMemoryContext}

CURRENT CART:
(Included in menu context below)

MENU:
${trimmedMenu}`.trim();

    const systemMessage: ChatMessage = { role: 'system', content: systemContent };
    const allMessages: ChatMessage[] = [systemMessage, ...recentMessages];

    logger.log('[VoiceAI] Chat request — url:', this.chatUrl, 'model:', PRIMARY_MODEL,
      'messages:', allMessages.length, 'lang:', language,
      'sysLen:', systemContent.length, 'menuLen:', trimmedMenu.length);

    // Attempt 1: primary model (openai-large / GPT-5.2, non-reasoning)
    const content = await this._chatRequest(allMessages, PRIMARY_MODEL, PRIMARY_MAX_TOKENS);
    if (content) return content;

    // Attempt 2: fallback model (openai / GPT-5-mini reasoning) with high token budget
    logger.warn('[VoiceAI] Primary model returned empty, trying fallback model:', FALLBACK_MODEL);
    const fallbackContent = await this._chatRequest(allMessages, FALLBACK_MODEL, FALLBACK_MAX_TOKENS);
    if (fallbackContent) return fallbackContent;

    // Attempt 3: minimal prompt — just the user's last message, no context
    const lastUserMsg = [...recentMessages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      logger.warn('[VoiceAI] Fallback model also empty, trying minimal prompt');
      const minimalMessages: ChatMessage[] = [
        { role: 'system', content: 'You are a helpful food ordering assistant. Be concise. End with |||ACTION:{"type":"none"}|||' },
        lastUserMsg,
      ];
      const minContent = await this._chatRequest(minimalMessages, PRIMARY_MODEL, PRIMARY_MAX_TOKENS);
      if (minContent) return minContent;
    }

    logger.error('[VoiceAI] All chat attempts returned empty');
    return "I'm sorry, could you say that again? I didn't quite catch that. |||ACTION:{\"type\":\"none\"}|||";
  }

  /**
   * Low-level chat completion request. Returns content string or empty string on failure.
   * Uses the root POST endpoint (text.pollinations.ai/) which returns plain text.
   */
  private async _chatRequest(
    messages: ChatMessage[],
    model: string,
    maxTokens: number,
  ): Promise<string> {
    const body = {
      model,
      messages,
      temperature: 0.3,
      max_tokens: maxTokens,
      referrer: POLLINATIONS_REFERRER,
    };

    try {
      logger.log('[VoiceAI] _chatRequest SENDING → url:', this.chatUrl, 'model:', model);
      const res = await fetchWithRetry(this.chatUrl, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errMsg = await parseApiError(res);
        logger.error('[VoiceAI] Chat error:', res.status, errMsg, 'model:', model);
        throw new Error(`AI request failed (${res.status}): ${errMsg}`);
      }

      // Root endpoint returns plain text; OpenAI-compat returns JSON
      const contentType = res.headers.get('content-type') || '';
      let content = '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        logger.log('[VoiceAI] Chat response (JSON) — model:', data?.model ?? model,
          'tokens:', data?.usage?.total_tokens);
        content = extractContent(data);
      } else {
        content = (await res.text()).trim();
        logger.log('[VoiceAI] Chat response (text) — model:', model, 'length:', content.length);
      }

      // Safety net: detect Pollinations deprecation notice and treat as empty
      if (content && (content.includes('legacy text API is being deprecated') || content.includes('IMPORTANT NOTICE'))) {
        logger.warn('[VoiceAI] Detected deprecation notice in response, treating as empty');
        return '';
      }

      if (content) {
        logger.log('[VoiceAI] Chat reply (', model, '):', content.substring(0, 120));
      }
      return content;
    } catch (err: any) {
      if (err?.message?.includes('timed out')) {
        throw new Error('The assistant is taking too long. Please try again.');
      }
      if (err?.message?.includes('Pollen') || err?.message?.includes('API key')) {
        throw err;
      }
      logger.error('[VoiceAI] _chatRequest error with', model, ':', err?.message);
      return '';
    }
  }

  /**
   * Generate TTS audio URL via text.pollinations.ai GET endpoint.
   */
  async generateTtsAudioUrl(text: string, voice: string = 'nova'): Promise<string> {
    const url = this.getTtsStreamUrl(text, voice);
    logger.log('[VoiceAI] TTS GET request, voice:', voice, 'length:', text.length);
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

export const voiceAIService = new VoiceAIService();
