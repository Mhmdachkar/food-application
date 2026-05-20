import { create } from 'zustand';
import type {
  ConversationMessage,
  VoiceCallState,
  QuickChip,
} from '../models/VoiceCallTypes';
import type { MenuItem } from '../models/MenuItem';
import { menuSearchService } from '../services/MenuSearchService';
import { foodMemoryService } from '../services/FoodMemoryService';
import { voiceAIService } from '../services/VoiceAIService';
import { audioService } from '../services/AudioService';
import type { ChatMessage } from '../models/VoiceCallTypes';
import type { VoiceAction, ActionResult } from '../models/VoiceActions';
import { fuzzyMatchItemName } from '../models/VoiceActions';
import { useCartStore } from './CartStore';
import { useAuthStore } from './AuthStore';
import { useDataStore } from './DataStore';
import { logger } from '../utils/logger';

export const DEFAULT_QUICK_CHIPS: QuickChip[] = [
  { id: '1', label: "What's popular?", icon: 'fire', message: "What's popular right now?" },
  { id: '2', label: 'Something healthy', icon: 'leaf', message: 'I want something healthy and light' },
  { id: '3', label: 'Quick & cheap', icon: 'clock', message: 'What can I get that is quick and affordable?' },
  { id: '4', label: 'Surprise me!', icon: 'sparkles', message: "Surprise me! Pick something delicious" },
  { id: '5', label: 'Spicy food', icon: 'pepper', message: 'I want something spicy' },
  { id: '6', label: 'Comfort food', icon: 'heart', message: 'I need some comfort food' },
];

const CART_QUICK_CHIPS: QuickChip[] = [
  { id: 'c1', label: 'View cart', icon: 'cart', message: "What's in my cart?" },
  { id: 'c2', label: "That's all", icon: 'check', message: "That's all, I'm done ordering" },
  { id: 'c3', label: 'Add more', icon: 'plus', message: "What else do you recommend?" },
  { id: 'c4', label: 'Clear cart', icon: 'trash', message: 'Clear my cart' },
];

const POST_ORDER_CHIPS: QuickChip[] = [
  { id: 'p1', label: 'Order again', icon: 'refresh', message: 'I want to place another order' },
  { id: 'p2', label: 'Goodbye', icon: 'wave', message: 'Thanks, bye!' },
];

function getContextualChips(): QuickChip[] {
  const cart = useCartStore.getState();
  if (!cart.isEmpty()) return CART_QUICK_CHIPS;
  return DEFAULT_QUICK_CHIPS;
}

export interface VoiceCallStateStore {
  callState: VoiceCallState;
  isCallActive: boolean;
  isLiveMode: boolean;
  isTTSEnabled: boolean;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isRecording: boolean;
  detectedLanguage: string;
  menuItemsFull: MenuItem[];
  lastActionResult: ActionResult | null;
  messages: ConversationMessage[];
  conversationHistory: ChatMessage[];
  showQuickChips: boolean;
  quickChips: QuickChip[];
  connectionError: string | null;
  orderAddress: string;
  lastOrderId: string | null;
  startCall: (menuItems: MenuItem[]) => Promise<void>;
  endCall: () => void;
  toggleTTS: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleLiveMode: () => void;
  sendTextMessage: (text: string) => Promise<void>;
  sendQuickChip: (chip: QuickChip) => Promise<void>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
}

// Track pending auto-listen timers so we can cancel on endCall
let _pendingTimers: ReturnType<typeof setTimeout>[] = [];
let _consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 3;
// Prevent concurrent startRecording / stopRecording calls from racing
let _recordingBusy = false;

function _trackTimer(timer: ReturnType<typeof setTimeout>): ReturnType<typeof setTimeout> {
  _pendingTimers.push(timer);
  return timer;
}

function _clearAllTimers(): void {
  for (const t of _pendingTimers) {
    clearTimeout(t);
  }
  _pendingTimers = [];
}

async function speakWithTTS(text: string, enabled: boolean): Promise<void> {
  if (!enabled) return;
  try {
    await audioService.playTTS(text, 'nova');
  } catch (err) {
    logger.warn('[VoiceCallStore] TTS playback failed, ignoring:', err);
  }
}

/**
 * Detect language from user text.
 * Checks for Arabic Unicode ranges and common script patterns.
 */
function detectLanguage(text: string): string {
  const arabicRange = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  if (arabicRange.test(text)) return 'ar';
  return 'en';
}

/**
 * Parse action block(s) from AI response.
 * Format: |||ACTION:{ JSON }|||
 */
export function parseAction(text: string): { cleanText: string; action: VoiceAction | null } {
  // Match action blocks: |||ACTION:{...}||| — also handle missing closing |||
  const actionRegex = /\.?\s*\|{2,3}\s*ACTION\s*:\s*([\s\S]+?)\|{2,3}/gi;
  const matches = [...text.matchAll(actionRegex)];

  if (matches.length === 0) {
    // Also catch partial/malformed action tags the AI might emit
    const partialRegex = /\.?\s*\|{2,3}\s*ACTION\s*:\s*\{[^}]*\}?\s*\|{0,3}\s*$/gi;
    let cleanText = text.replace(partialRegex, '').trim();
    // Remove any leftover |||...  fragments
    cleanText = cleanText.replace(/\|{2,3}[^|]*$/g, '').trim();
    return { cleanText, action: null };
  }

  // Strip ALL action blocks (including leading dots/punctuation) from display text
  let cleanText = text.replace(actionRegex, '').trim();
  // Clean up leftover punctuation, double spaces, trailing dots from stripping
  cleanText = cleanText
    .replace(/\s{2,}/g, ' ')
    .replace(/\.\s*$/, '')       // intentional: strip trailing dot for cleaner TTS output
    .replace(/^\.\s*/, '')       // leading dot
    .trim();

  // If clean text is empty after stripping, provide a minimal fallback
  if (!cleanText) cleanText = '';

  const rawJson = matches[0][1].trim();
  try {
    const action = JSON.parse(rawJson) as VoiceAction;
    return { cleanText, action };
  } catch {
    const stripped = rawJson
      .replace(/^```json?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    try {
      const action = JSON.parse(stripped) as VoiceAction;
      return { cleanText, action };
    } catch {
      logger.warn('[VoiceCallStore] Failed to parse action JSON:', rawJson);
      return { cleanText, action: null };
    }
  }
}

function cartContextString(): string {
  const cart = useCartStore.getState();
  if (cart.isEmpty()) return 'Cart is empty.';
  const lines = cart.items.map(ci => {
    let line = `- ${ci.quantity}x ${ci.menuItem.name} ($${(ci.menuItem.price * ci.quantity).toFixed(2)})`;
    if (ci.specialInstructions) line += ` [note: ${ci.specialInstructions}]`;
    return line;
  });
  lines.push(`Subtotal: $${cart.subtotal().toFixed(2)} | Total: $${cart.total().toFixed(2)}`);
  return lines.join('\n');
}

export async function executeAction(
  action: VoiceAction,
  menuItems: MenuItem[],
  storeGet: () => VoiceCallStateStore,
  storeSet: (partial: Partial<VoiceCallStateStore>) => void,
): Promise<ActionResult> {
  const cartStore = useCartStore.getState();
  const menuNames = menuItems.map(m => m.name);
  const cartNames = cartStore.items.map(ci => ci.menuItem.name);

  switch (action.type) {
    case 'add_to_cart': {
      const matchedName = fuzzyMatchItemName(action.itemName, menuNames);
      if (!matchedName) {
        return { success: false, message: `"${action.itemName}" not found on the menu.`, action };
      }
      const item = menuItems.find(m => m.name === matchedName)!;
      if (!item.isAvailable) {
        return { success: false, message: `${item.name} is currently unavailable.`, action };
      }
      const qty = Math.max(1, action.quantity || 1);
      cartStore.addItem(item, qty, action.modifiers || {}, action.instructions || '');
      return {
        success: true,
        message: `Added ${qty}x ${item.name} ($${(item.price * qty).toFixed(2)}) to your cart.`,
        action,
      };
    }

    case 'remove_from_cart': {
      const matchedCart = fuzzyMatchItemName(action.itemName, cartNames);
      if (!matchedCart) {
        return { success: false, message: `"${action.itemName}" is not in your cart.`, action };
      }
      const cartItem = cartStore.items.find(ci => ci.menuItem.name === matchedCart)!;
      cartStore.removeItem(cartItem);
      return { success: true, message: `Removed ${cartItem.menuItem.name} from your cart.`, action };
    }

    case 'update_quantity': {
      const matchedCart = fuzzyMatchItemName(action.itemName, cartNames);
      if (!matchedCart) {
        return { success: false, message: `"${action.itemName}" is not in your cart.`, action };
      }
      const cartItem = cartStore.items.find(ci => ci.menuItem.name === matchedCart)!;
      const newQty = Math.max(0, action.quantity);
      if (newQty === 0) {
        cartStore.removeItem(cartItem);
        return { success: true, message: `Removed ${cartItem.menuItem.name} from your cart.`, action };
      }
      cartStore.updateQuantity(cartItem, newQty);
      return { success: true, message: `Updated ${cartItem.menuItem.name} to ${newQty}x.`, action };
    }

    case 'set_item_note': {
      const success = cartStore.setItemNote(action.itemName, action.note);
      if (!success) {
        return { success: false, message: `"${action.itemName}" is not in your cart. Add it first, then I can add notes.`, action };
      }
      return { success: true, message: `Note added to ${action.itemName}: "${action.note}"`, action };
    }

    case 'clear_cart': {
      if (cartStore.isEmpty()) {
        return { success: true, message: 'Your cart is already empty.', action };
      }
      cartStore.clear();
      return { success: true, message: 'Cart cleared.', action };
    }

    case 'view_cart': {
      return { success: true, message: cartContextString(), action };
    }

    case 'apply_promo': {
      cartStore.applyPromo(action.code);
      return { success: true, message: `Promo code "${action.code}" applied.`, action };
    }

    case 'set_delivery_notes': {
      useCartStore.setState({ deliveryNotes: action.notes });
      return { success: true, message: `Delivery notes updated.`, action };
    }

    case 'set_address': {
      storeSet({ orderAddress: action.address });
      return { success: true, message: `Delivery address set: ${action.address}`, action };
    }

    case 'confirm_order': {
      const cart = useCartStore.getState();
      if (cart.isEmpty()) {
        return { success: false, message: 'Your cart is empty — add items first.', action };
      }
      const address = storeGet().orderAddress;
      if (!address) {
        return { success: false, message: 'I need your delivery address first. What is your address?', action };
      }
      // Actually place the order via Supabase
      try {
        const user = useAuthStore.getState().user;
        const userId = user?.id ?? 'voice-order-guest';
        const customerName = user?.name ?? 'Voice Order Customer';
        const orderId = await useDataStore.getState().placeOrderViaSupabase({
          userId,
          customerName,
          items: cart.items,
          address: {
            street: address,
            city: '',
            state: '',
            zip: '',
            notes: cart.deliveryNotes || '',
          },
          notes: cart.deliveryNotes || 'Ordered via Voice AI',
          promoCode: cart.promoCode || null,
          tip: cart.tipAmount(),
          paymentMethod: 'cash',
        });
        if (orderId) {
          storeSet({ lastOrderId: orderId });
          const itemCount = cart.itemCount();
          const total = cart.total();
          cart.clear();
          return {
            success: true,
            message: `Order #${orderId.slice(0, 6)} placed! ${itemCount} item${itemCount !== 1 ? 's' : ''}, total $${total.toFixed(2)}. You can track it in your Orders page.`,
            action,
          };
        }
        // Supabase failed — place locally as fallback
        logger.warn('[VoiceCallStore] Supabase order failed, placing locally');
      } catch (err: any) {
        logger.warn('[VoiceCallStore] Order placement error:', err?.message);
      }
      // Fallback: local-only order confirmation
      const itemCount = cart.itemCount();
      const total = cart.total();
      const fallbackId = `VO-${Date.now()}`;
      storeSet({ lastOrderId: fallbackId });
      useDataStore.getState().placeOrderLocally({
        id: fallbackId,
        customerId: useAuthStore.getState().user?.id ?? 'guest',
        customerName: useAuthStore.getState().user?.name ?? 'Guest',
        items: cart.items,
        status: 'PLACED',
        timeline: [{ id: `${fallbackId}-placed`, status: 'PLACED', timestamp: new Date().toISOString(), note: 'Placed via Voice AI' }],
        subtotal: cart.subtotal(),
        tax: cart.tax(),
        deliveryFee: cart.deliveryFee(),
        tip: cart.tipAmount(),
        total: cart.total(),
        deliveryAddress: { street: address, city: '', state: '', zip: '', notes: '' },
        deliveryNotes: cart.deliveryNotes || '',
        promoCode: cart.promoCode || null,
        promoDiscount: cart.promoDiscount,
        createdAt: new Date().toISOString(),
      });
      cart.clear();
      return {
        success: true,
        message: `Order #${fallbackId.slice(0, 8)} placed! ${itemCount} item${itemCount !== 1 ? 's' : ''}, total $${total.toFixed(2)}. Check your Orders page for updates.`,
        action,
      };
    }

    case 'none':
    default:
      return { success: true, message: '', action };
  }
}

export const useVoiceCallStore = create<VoiceCallStateStore>((set, get) => ({
  callState: 'idle',
  isCallActive: false,
  isLiveMode: true,
  isTTSEnabled: true,
  isMuted: false,
  isSpeakerOn: false,
  isRecording: false,
  detectedLanguage: 'en',
  menuItemsFull: [],
  lastActionResult: null,
  messages: [],
  conversationHistory: [],
  showQuickChips: true,
  quickChips: DEFAULT_QUICK_CHIPS,
  connectionError: null,
  orderAddress: '',
  lastOrderId: null,

  startCall: async menuItems => {
    _clearAllTimers();
    set({ connectionError: null, orderAddress: '', lastOrderId: null });

    // Request mic permission FIRST — before greeting TTS — so the permission
    // dialog doesn't interfere with auto-listen and the user grants it up front.
    const micOk = await audioService.ensureMicPermission();
    if (!micOk) {
      logger.error('[VoiceCallStore] Mic permission denied — call cannot proceed in live mode');
      set({ connectionError: 'Microphone permission is required for voice calls. Please allow microphone access.' });
    }

    await foodMemoryService.load();
    menuSearchService.buildIndex(menuItems);
    logger.log('[VoiceCallStore] Menu items loaded for call:', menuItems.length);

    // Verify API connectivity (non-blocking — call starts either way)
    voiceAIService.verifyConnection().then(connCheck => {
      if (!connCheck.ok) {
        logger.error('[VoiceCallStore] Connection check failed:', connCheck.error);
        set({ connectionError: connCheck.error ?? 'Cannot reach AI service' });
      }
    });

    const hasPrefs =
      foodMemoryService.memory.dislikedIngredients.length > 0 ||
      !!foodMemoryService.memory.defaultDrink;

    const greetingText = hasPrefs
      ? "Welcome back! I remember your preferences. What sounds good today?"
      : "Hey there! I'm your food assistant. What are you craving today?";

    const greeting: ConversationMessage = {
      id: `${Date.now()}`,
      role: 'assistant',
      text: greetingText,
      timestamp: new Date().toISOString(),
      proposedActions: [],
      isDecisionCard: false,
    };

    set({
      isCallActive: true,
      callState: 'speaking',
      menuItemsFull: menuItems,
      detectedLanguage: 'en',
      messages: [greeting],
      conversationHistory: [{ role: 'assistant', content: greetingText }],
      showQuickChips: true,
      quickChips: DEFAULT_QUICK_CHIPS,
    });

    await speakWithTTS(greetingText, get().isTTSEnabled);
    logger.log('[VoiceCallStore] Greeting TTS finished, scheduling auto-listen');
    set({ callState: 'idle' });
    _autoListenAfterSpeak(get, set);
  },

  endCall: () => {
    _clearAllTimers();
    _consecutiveErrors = 0;
    _recordingBusy = false;
    audioService.stopPlayback();
    audioService.cancelRecording();
    set({
      isCallActive: false,
      callState: 'idle',
      isLiveMode: true,
      isRecording: false,
      detectedLanguage: 'en',
      menuItemsFull: [],
      lastActionResult: null,
      messages: [],
      conversationHistory: [],
      showQuickChips: true,
      connectionError: null,
      orderAddress: '',
      lastOrderId: null,
    });
  },

  toggleTTS: () => {
    const current = get().isTTSEnabled;
    if (current) audioService.stopPlayback();
    set({ isTTSEnabled: !current });
  },

  toggleMute: () => {
    const wasMuted = get().isMuted;
    set({ isMuted: !wasMuted });
    if (wasMuted && get().isLiveMode && get().callState === 'idle' && !get().isRecording) {
      get().startRecording();
    }
    if (!wasMuted && get().isRecording) {
      audioService.cancelRecording();
      set({ isRecording: false, callState: 'idle' });
    }
  },

  toggleSpeaker: () => set(s => ({ isSpeakerOn: !s.isSpeakerOn })),

  toggleLiveMode: () => {
    const current = get().isLiveMode;
    set({ isLiveMode: !current });
    if (!current && get().isCallActive && get().callState === 'idle' && !get().isRecording && !get().isMuted) {
      _trackTimer(setTimeout(() => get().startRecording(), 300));
    }
    if (current && get().isRecording) {
      audioService.cancelRecording();
      set({ isRecording: false, callState: 'idle', showQuickChips: true });
    }
  },

  sendQuickChip: async (chip: QuickChip) => {
    await get().sendTextMessage(chip.message);
  },

  startRecording: async () => {
    const s = get();
    if (_recordingBusy || s.isRecording || s.callState === 'thinking' || s.callState === 'transcribing' || s.callState === 'speaking' || s.isMuted) {
      logger.log('[VoiceCallStore] startRecording blocked — busy:', _recordingBusy, 'state:', s.callState, 'recording:', s.isRecording, 'muted:', s.isMuted);
      return;
    }
    _recordingBusy = true;

    try {
      audioService.stopPlayback();

      const onSilence = get().isLiveMode
        ? () => {
            logger.log('[VoiceCallStore] Silence callback fired');
            if (get().isRecording) {
              get().stopRecording().catch(err => {
                logger.error('[VoiceCallStore] stopRecording from silence failed:', err);
                _recordingBusy = false;
                _scheduleAutoListen(get, set, 1500);
              });
            }
          }
        : undefined;

      const started = await audioService.startRecording(onSilence);
      if (started) {
        logger.log('[VoiceCallStore] Recording started, entering listening state');
        set({ isRecording: true, callState: 'listening', showQuickChips: false });
      } else {
        logger.warn('[VoiceCallStore] Failed to start recording');
        _scheduleAutoListen(get, set, 1000);
      }
    } finally {
      _recordingBusy = false;
    }
  },

  stopRecording: async () => {
    if (!get().isRecording) {
      logger.log('[VoiceCallStore] stopRecording called but not recording');
      return;
    }
    _recordingBusy = true;
    logger.log('[VoiceCallStore] Stopping recording...');
    set({ isRecording: false, callState: 'transcribing' });

    try {
      const transcription = await audioService.stopRecordingAndTranscribe(get().detectedLanguage);
      const trimmed = transcription?.trim() ?? '';
      logger.log('[VoiceCallStore] Transcription result:', JSON.stringify(trimmed.substring(0, 80)), 'hadVoice:', audioService.hadVoiceActivity());

      if (trimmed.length > 0) {
        _consecutiveErrors = 0; // Reset on successful transcription
        const lang = detectLanguage(trimmed);
        if (lang !== get().detectedLanguage) {
          logger.log('[VoiceCallStore] Language detected:', lang);
          set({ detectedLanguage: lang });
          audioService.setLanguage(lang);
        }
        await get().sendTextMessage(trimmed);
      } else {
        logger.log('[VoiceCallStore] Empty transcription, re-listening...');
        _scheduleAutoListen(get, set, 400);
      }
    } catch (err: any) {
      logger.error('[VoiceCallStore] STT error:', err);
      _consecutiveErrors++;

      if (_consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        // Too many consecutive errors — pause auto-listen, show helpful message
        logger.warn('[VoiceCallStore] Too many consecutive STT errors, pausing auto-listen');
        const pauseMessage: ConversationMessage = {
          id: `${Date.now()}-stt-pause`,
          role: 'assistant',
          text: "I'm having trouble hearing you. The voice service may be temporarily unavailable. You can type your message below or try speaking again in a moment.",
          timestamp: new Date().toISOString(),
          proposedActions: [],
          isDecisionCard: false,
        };
        set(state => ({
          messages: [...state.messages, pauseMessage],
          callState: 'idle',
          showQuickChips: true,
        }));
        _consecutiveErrors = 0;
        // Retry after a longer delay
        _trackTimer(setTimeout(() => _tryStartRecording(get), 8000));
        return;
      }

      if (audioService.hadVoiceActivity()) {
        const errorMessage: ConversationMessage = {
          id: `${Date.now()}-stt-error`,
          role: 'assistant',
          text: err?.message ?? "I couldn't understand that. Please try again.",
          timestamp: new Date().toISOString(),
          proposedActions: [],
          isDecisionCard: false,
        };
        set(state => ({
          messages: [...state.messages, errorMessage],
          callState: 'error',
          showQuickChips: !get().isLiveMode,
        }));
      }
      _scheduleAutoListen(get, set, 1500);
    } finally {
      _recordingBusy = false;
    }
  },

  sendTextMessage: async text => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (get().callState === 'thinking') return;

    const now = new Date().toISOString();
    const userMessage: ConversationMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      text: trimmed,
      timestamp: now,
      proposedActions: [],
      isDecisionCard: false,
    };

    const prevHistory = get().conversationHistory;
    const MAX_STORED_HISTORY = 20;
    const trimmedHistory = prevHistory.length > MAX_STORED_HISTORY
      ? prevHistory.slice(-MAX_STORED_HISTORY)
      : prevHistory;
    const updatedHistory: ChatMessage[] = [
      ...trimmedHistory,
      { role: 'user', content: trimmed },
    ];

    set(state => ({
      messages: [...state.messages, userMessage],
      conversationHistory: updatedHistory,
      callState: 'thinking',
      showQuickChips: false,
      lastActionResult: null,
    }));

    const { menuItemsFull, detectedLanguage } = get();
    const menuContext = menuItemsFull.length > 0
      ? menuSearchService.richContextString(menuItemsFull)
      : menuSearchService.fullContextString();
    const foodMemoryContext = foodMemoryService.contextString();
    const cartCtx = cartContextString();

    try {
      const fullMenuContext = `${menuContext}\n\nCURRENT CART:\n${cartCtx}`;

      // Detect language from user text for accurate hint to chat
      const msgLang = detectLanguage(trimmed);
      const chatLang = msgLang !== 'en' ? msgLang : detectedLanguage;

      // Single API call — intent classification is now part of the main prompt
      const rawReply = await voiceAIService.chat(
        updatedHistory,
        fullMenuContext,
        foodMemoryContext,
        chatLang,
      );

      const { cleanText: spokenText, action } = parseAction(rawReply);

      let actionResult: ActionResult | null = null;
      if (action && action.type !== 'none') {
        actionResult = await executeAction(action, menuItemsFull, get, set);
        if (!actionResult.success) {
          logger.warn('[VoiceCallStore] Action failed:', actionResult.message);
        } else {
          logger.log('[VoiceCallStore] Action executed:', actionResult.message);
        }
      }

      const displayText = spokenText || rawReply;

      const assistantMessage: ConversationMessage = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        text: displayText,
        timestamp: new Date().toISOString(),
        proposedActions: [],
        isDecisionCard: false,
      };

      const historyWithReply: ChatMessage[] = [
        ...updatedHistory,
        { role: 'assistant', content: displayText },
      ];

      // Update language based on AI reply too (if it's Arabic, keep Arabic)
      const replyLang = detectLanguage(displayText);
      if (replyLang === 'ar' && get().detectedLanguage !== 'ar') {
        set({ detectedLanguage: 'ar' });
        audioService.setLanguage('ar');
      }

      // Determine contextual quick chips based on state
      const isOrderJustPlaced = actionResult?.success && action?.type === 'confirm_order';
      const nextChips = isOrderJustPlaced
        ? POST_ORDER_CHIPS
        : getContextualChips();

      set(state => ({
        messages: [...state.messages, assistantMessage],
        conversationHistory: historyWithReply,
        callState: 'speaking',
        showQuickChips: !get().isLiveMode,
        quickChips: nextChips,
        lastActionResult: actionResult,
      }));

      await speakWithTTS(displayText, get().isTTSEnabled);
      if (get().isCallActive) {
        set({ callState: 'idle' });
      }
      _autoListenAfterSpeak(get, set);
    } catch (e: any) {
      logger.error('[VoiceCallStore] sendTextMessage error:', e);
      const errorText = e?.message ?? 'Something went wrong talking to the assistant. Please try again.';
      const errorMessage: ConversationMessage = {
        id: `${Date.now()}-error`,
        role: 'assistant',
        text: errorText,
        timestamp: new Date().toISOString(),
        proposedActions: [],
        isDecisionCard: false,
      };
      set(state => ({
        messages: [...state.messages, errorMessage],
        callState: 'error',
        showQuickChips: !get().isLiveMode,
      }));
      _scheduleAutoListen(get, set, 2000);
    }
  },
}));

function _tryStartRecording(get: () => VoiceCallStateStore): void {
  const current = get();
  if (
    current.isCallActive &&
    current.isLiveMode &&
    !current.isMuted &&
    !current.isRecording &&
    current.callState !== 'thinking' &&
    current.callState !== 'transcribing' &&
    current.callState !== 'speaking'
  ) {
    logger.log('[VoiceCallStore] Auto-listen: starting recording');
    get().startRecording().catch(err => {
      logger.error('[VoiceCallStore] Auto-listen startRecording error:', err);
    });
  } else {
    logger.log('[VoiceCallStore] Auto-listen: skipped (state:', current.callState, 'recording:', current.isRecording, ')');
  }
}

function _scheduleAutoListen(
  get: () => VoiceCallStateStore,
  set: (partial: Partial<VoiceCallStateStore>) => void,
  delayMs: number,
) {
  const s = get();
  if (!s.isLiveMode || !s.isCallActive || s.isMuted) {
    if (s.callState !== 'thinking') {
      set({ callState: 'idle', showQuickChips: !s.isLiveMode });
    }
    return;
  }
  if (s.callState !== 'thinking') {
    logger.log('[VoiceCallStore] _scheduleAutoListen: setting idle, delay:', delayMs, 'ms');
    set({ callState: 'idle' });
  }
  _trackTimer(setTimeout(() => _tryStartRecording(get), delayMs));
}

function _autoListenAfterSpeak(
  get: () => VoiceCallStateStore,
  set: (partial: Partial<VoiceCallStateStore>) => void,
) {
  // Primary: try starting recording after a short delay
  _scheduleAutoListen(get, set, 300);

  // Safety net: retry at 2s and 5s if we're still idle
  _trackTimer(setTimeout(() => _tryStartRecording(get), 2000));
  _trackTimer(setTimeout(() => _tryStartRecording(get), 5000));
}
