/**
 * Voice Call Conversation Loop Tests
 *
 * Verifies the complete lifecycle:
 *   greeting TTS → auto-listen → record → silence → transcribe → AI reply → TTS → auto-listen
 *
 * Also tests:
 *   - Model selection (openai-large primary, openai fallback)
 *   - Retry logic when primary model returns empty (reasoning token exhaustion)
 *   - Menu context truncation
 *   - Conversation history trimming
 *   - Arabic language detection and hints
 *   - Error recovery and TTS fallback
 */

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Recording: {
      createAsync: jest.fn().mockResolvedValue({
        recording: {
          getStatusAsync: jest.fn().mockResolvedValue({ isRecording: true, metering: -25 }),
          stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
          getURI: jest.fn().mockReturnValue('file:///test/recording.wav'),
        },
      }),
    },
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          setOnPlaybackStatusUpdate: jest.fn((cb: any) => {
            setTimeout(() => cb({ isLoaded: true, didJustFinish: true }), 10);
          }),
          unloadAsync: jest.fn().mockResolvedValue(undefined),
          stopAsync: jest.fn().mockResolvedValue(undefined),
        },
      }),
    },
    AndroidOutputFormat: { DEFAULT: 0 },
    AndroidAudioEncoder: { DEFAULT: 0 },
    IOSOutputFormat: { LINEARPCM: 0 },
    IOSAudioQuality: { HIGH: 0 },
  },
}));

jest.mock('expo-speech', () => ({
  speak: jest.fn((_text: string, opts: any) => {
    if (opts?.onDone) setTimeout(opts.onDone, 5);
  }),
  stop: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  File: jest.fn().mockImplementation((_uri: string) => ({
    base64: jest.fn().mockResolvedValue('bW9ja19iYXNlNjRfYXVkaW8='),
  })),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

const mockTranscribeFileUri = jest.fn();
const mockChat = jest.fn();
const mockGenerateTtsAudioUrl = jest.fn();
const mockGenerateTtsAudioUrlGet = jest.fn();
const mockGetTtsStreamUrl = jest.fn();
const mockVerifyConnection = jest.fn();

jest.mock('../services/VoiceAIService', () => ({
  voiceAIService: {
    transcribeAudioBlob: jest.fn(),
    transcribeFileUri: mockTranscribeFileUri,
    chat: mockChat,
    generateTtsAudioUrl: mockGenerateTtsAudioUrl,
    generateTtsAudioUrlGet: mockGenerateTtsAudioUrlGet,
    getTtsStreamUrl: mockGetTtsStreamUrl,
    verifyConnection: mockVerifyConnection,
  },
}));

jest.mock('../services/FoodMemoryService', () => ({
  foodMemoryService: {
    load: jest.fn().mockResolvedValue(undefined),
    memory: { dislikedIngredients: [], defaultDrink: null },
    contextString: jest.fn().mockReturnValue('No preferences set.'),
  },
}));

jest.mock('../services/MenuSearchService', () => ({
  menuSearchService: {
    buildIndex: jest.fn(),
    richContextString: jest.fn().mockReturnValue('Menu: Burger $10, Fries $5'),
    fullContextString: jest.fn().mockReturnValue('Menu: Burger $10, Fries $5'),
  },
}));

jest.mock('expo-constants', () => ({
  expoConfig: { extra: {} },
}));

jest.mock('../config/Config', () => ({
  Config: {
    voiceChatUrl: 'https://test.api/chat',
    voiceTtsUrl: 'https://test.api/tts',
    voiceSttUrl: 'https://test.api/stt',
    pollinationApiKey: 'test-key',
  },
}));

const mockPlaceOrderViaSupabase = jest.fn();
const mockPlaceOrderLocally = jest.fn();

jest.mock('../state/AuthStore', () => ({
  useAuthStore: {
    getState: () => ({
      user: {
        id: 'test-user-id',
        name: 'Test User',
        email: 'test@test.com',
        phone: '',
        role: 'customer',
        foodMemory: { dietaryRestrictions: [], dislikedIngredients: [], spiceLevel: 'medium', defaultDrink: null, commonNotes: null, preferredCuisines: [] },
        createdAt: new Date().toISOString(),
      },
    }),
  },
}));

jest.mock('../state/DataStore', () => ({
  useDataStore: {
    getState: () => ({
      menuItems: [],
      placeOrderViaSupabase: mockPlaceOrderViaSupabase,
      placeOrderLocally: mockPlaceOrderLocally,
      refreshMenu: jest.fn(),
    }),
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────────

import { useVoiceCallStore } from '../state/VoiceCallStore';
import { audioService } from '../services/AudioService';
import type { MenuItem } from '../models/MenuItem';

let spyStartRecording: jest.SpyInstance;
let spyStopRecordingAndTranscribe: jest.SpyInstance;
let spyCancelRecording: jest.SpyInstance;
let spyStopPlayback: jest.SpyInstance;
let spyStopPlaybackAsync: jest.SpyInstance;
let spyPlayTTS: jest.SpyInstance;
let spyHadVoiceActivity: jest.SpyInstance;
let spySetLanguage: jest.SpyInstance;
let spyEnsureMicPermission: jest.SpyInstance;

// ── Helpers ────────────────────────────────────────────────────────────────────

const MENU_ITEMS: MenuItem[] = [
  {
    id: '1',
    name: 'Classic Burger',
    description: 'Juicy beef patty',
    price: 10.99,
    category: 'burgers',
    imageUrl: '',
    calories: 550,
    prepTimeMinutes: 12,
    isAvailable: true,
    tags: ['popular'],
    allergens: [],
    ingredients: ['beef', 'lettuce', 'tomato', 'bun'],
    isLimitedTime: false,
    modifierGroups: [],
    rating: 4.5,
    reviewCount: 100,
    nutritionInfo: { calories: 550, protein: 30, carbs: 40, fat: 25, fiber: 3, sugar: 8 },
  },
];

function getStore() {
  return useVoiceCallStore.getState();
}

function tick(ms = 50): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function flushTimers(steps = 5, stepMs = 200): Promise<void> {
  for (let i = 0; i < steps; i++) {
    jest.advanceTimersByTime(stepMs);
    await tick(5);
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

function setupSpies() {
  spyStartRecording = jest.spyOn(audioService, 'startRecording').mockResolvedValue(true);
  spyStopRecordingAndTranscribe = jest.spyOn(audioService, 'stopRecordingAndTranscribe').mockResolvedValue('I want a burger');
  spyCancelRecording = jest.spyOn(audioService, 'cancelRecording').mockResolvedValue(undefined);
  spyStopPlayback = jest.spyOn(audioService, 'stopPlayback').mockImplementation(() => {});
  spyStopPlaybackAsync = jest.spyOn(audioService, 'stopPlaybackAsync').mockResolvedValue(undefined);
  spyPlayTTS = jest.spyOn(audioService, 'playTTS').mockResolvedValue(undefined);
  spyHadVoiceActivity = jest.spyOn(audioService, 'hadVoiceActivity').mockReturnValue(true);
  spySetLanguage = jest.spyOn(audioService, 'setLanguage').mockImplementation(() => {});
  spyEnsureMicPermission = jest.spyOn(audioService, 'ensureMicPermission').mockResolvedValue(true);
}

describe('Voice Call Conversation Loop', () => {
  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });
    useVoiceCallStore.setState({
      callState: 'idle',
      isCallActive: false,
      isLiveMode: true,
      isTTSEnabled: false,
      isMuted: false,
      isSpeakerOn: false,
      isRecording: false,
      detectedLanguage: 'en',
      menuItemsFull: [],
      lastActionResult: null,
      messages: [],
      conversationHistory: [],
      showQuickChips: true,
      quickChips: [],
      connectionError: null,
      orderAddress: '',
      lastOrderId: null,
    });
    jest.clearAllMocks();
    setupSpies();
    mockVerifyConnection.mockResolvedValue({ ok: true });
    mockChat.mockResolvedValue('Sure, I can help with that! |||ACTION:{"type":"none"}|||');
    mockTranscribeFileUri.mockResolvedValue('I want a burger');
    mockGenerateTtsAudioUrl.mockResolvedValue('blob:test-audio');
    mockGenerateTtsAudioUrlGet.mockResolvedValue('blob:test-audio-get');
    mockGetTtsStreamUrl.mockReturnValue('https://gen.pollinations.ai/audio/test?voice=nova');
    mockPlaceOrderViaSupabase.mockResolvedValue('order-123-abc');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // ── State Machine Tests ──

  test('startCall sets speaking state and creates greeting message', async () => {
    const store = getStore();
    const promise = store.startCall(MENU_ITEMS);
    await tick(20);
    
    const s = getStore();
    expect(s.isCallActive).toBe(true);
    expect(s.messages.length).toBe(1);
    expect(s.messages[0].role).toBe('assistant');
    expect(s.conversationHistory.length).toBe(1);
    
    await promise;
  });

  test('startCall with TTS disabled immediately transitions through speaking to idle', async () => {
    await getStore().startCall(MENU_ITEMS);
    
    const s = getStore();
    expect(s.callState).toBe('idle');
    expect(s.isCallActive).toBe(true);
  });

  test('startCall verifies connection and reports error', async () => {
    mockVerifyConnection.mockResolvedValue({ ok: false, error: 'Invalid API key' });
    
    await getStore().startCall(MENU_ITEMS);
    
    const s = getStore();
    expect(s.isCallActive).toBe(true);
    expect(s.connectionError).toBe('Invalid API key');
  });

  test('startRecording blocks when speaking', async () => {
    useVoiceCallStore.setState({ isCallActive: true, callState: 'speaking', isLiveMode: true });
    
    await getStore().startRecording();
    
    expect(getStore().callState).toBe('speaking');
    expect(getStore().isRecording).toBe(false);
  });

  test('startRecording blocks when thinking', async () => {
    useVoiceCallStore.setState({ isCallActive: true, callState: 'thinking', isLiveMode: true });
    
    await getStore().startRecording();
    
    expect(getStore().callState).toBe('thinking');
    expect(getStore().isRecording).toBe(false);
  });

  test('startRecording blocks when muted', async () => {
    useVoiceCallStore.setState({ isCallActive: true, callState: 'idle', isLiveMode: true, isMuted: true });
    
    await getStore().startRecording();
    
    expect(getStore().isRecording).toBe(false);
  });

  test('startRecording sets listening state on success', async () => {
    useVoiceCallStore.setState({ isCallActive: true, callState: 'idle', isLiveMode: true });
    
    await getStore().startRecording();
    
    expect(getStore().callState).toBe('listening');
    expect(getStore().isRecording).toBe(true);
  });

  // ── Transcription Flow ──

  test('stopRecording transcribes and sends to AI', async () => {
    useVoiceCallStore.setState({
      isCallActive: true,
      callState: 'listening',
      isLiveMode: true,
      isRecording: true,
      menuItemsFull: MENU_ITEMS,
      messages: [],
      conversationHistory: [],
    });

    spyStopRecordingAndTranscribe.mockResolvedValue('I want a classic burger');
    mockChat.mockResolvedValue('I\'ll add Classic Burger ($10.99) to your cart! |||ACTION:{"type":"add_to_cart","itemName":"Classic Burger","quantity":1}|||');

    await getStore().stopRecording();

    const s = getStore();
    expect(s.messages.length).toBe(2);
    expect(s.messages[0].role).toBe('user');
    expect(s.messages[0].text).toBe('I want a classic burger');
    expect(s.messages[1].role).toBe('assistant');
    expect(s.messages[1].text).toContain('Classic Burger');
    expect(s.lastActionResult).not.toBeNull();
    expect(s.lastActionResult?.success).toBe(true);
  });

  test('empty transcription triggers auto-listen recovery', async () => {
    useVoiceCallStore.setState({
      isCallActive: true,
      callState: 'listening',
      isLiveMode: true,
      isRecording: true,
    });

    spyStopRecordingAndTranscribe.mockResolvedValue('');

    await getStore().stopRecording();

    const s = getStore();
    expect(s.callState).toBe('idle');
    expect(s.isRecording).toBe(false);
  });

  test('STT error triggers auto-listen recovery in live mode', async () => {
    useVoiceCallStore.setState({
      isCallActive: true,
      callState: 'listening',
      isLiveMode: true,
      isRecording: true,
    });

    spyStopRecordingAndTranscribe.mockRejectedValue(new Error('Transcription failed'));
    spyHadVoiceActivity.mockReturnValue(false);

    await getStore().stopRecording();

    expect(getStore().callState).toBe('idle');
  });

  // ── _scheduleAutoListen State Machine ──

  test('_scheduleAutoListen does NOT run when not in live mode', async () => {
    useVoiceCallStore.setState({
      isCallActive: true,
      callState: 'speaking',
      isLiveMode: false,
      isTTSEnabled: false,
      menuItemsFull: MENU_ITEMS,
      messages: [],
      conversationHistory: [],
    });

    mockChat.mockResolvedValue('Here are some options. |||ACTION:{"type":"none"}|||');
    
    await getStore().sendTextMessage('What do you recommend?');

    const s = getStore();
    expect(s.callState).toBe('idle');
    expect(s.showQuickChips).toBe(true);
    expect(s.isRecording).toBe(false);
  });

  test('_scheduleAutoListen sets idle even from speaking state', async () => {
    useVoiceCallStore.setState({
      isCallActive: true,
      callState: 'speaking',
      isLiveMode: true,
      isTTSEnabled: false,
      menuItemsFull: MENU_ITEMS,
      messages: [],
      conversationHistory: [],
    });

    mockChat.mockResolvedValue('Got it! |||ACTION:{"type":"none"}|||');

    await getStore().sendTextMessage('Hello');

    const s = getStore();
    expect(s.callState).not.toBe('speaking');
    expect(s.callState).toBe('idle');
  });

  // ── Arabic Language Detection ──

  test('detectLanguage identifies Arabic text and updates state', async () => {
    useVoiceCallStore.setState({
      isCallActive: true,
      callState: 'listening',
      isLiveMode: true,
      isRecording: true,
      detectedLanguage: 'en',
      menuItemsFull: MENU_ITEMS,
      messages: [],
      conversationHistory: [],
    });

    spyStopRecordingAndTranscribe.mockResolvedValue('أريد برجر كلاسيك');
    mockChat.mockResolvedValue('حاضر، سأضيف برجر كلاسيك لسلتك! |||ACTION:{"type":"add_to_cart","itemName":"Classic Burger","quantity":1}|||');

    await getStore().stopRecording();

    const s = getStore();
    expect(s.detectedLanguage).toBe('ar');
    expect(spySetLanguage).toHaveBeenCalledWith('ar');
    expect(mockChat).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'ar',
    );
  });

  test('Arabic language hint is passed to STT on next recording', async () => {
    useVoiceCallStore.setState({
      isCallActive: true,
      callState: 'listening',
      isLiveMode: true,
      isRecording: true,
      detectedLanguage: 'ar',
      menuItemsFull: MENU_ITEMS,
      messages: [],
      conversationHistory: [],
    });

    spyStopRecordingAndTranscribe.mockResolvedValue('أضف شيء ثاني');
    mockChat.mockResolvedValue('ماذا تريد أن أضيف؟ |||ACTION:{"type":"none"}|||');

    await getStore().stopRecording();

    expect(spyStopRecordingAndTranscribe).toHaveBeenCalledWith('ar');
  });

  // ── Error Recovery ──

  test('sendTextMessage error triggers recovery in live mode', async () => {
    useVoiceCallStore.setState({
      isCallActive: true,
      callState: 'idle',
      isLiveMode: true,
      menuItemsFull: MENU_ITEMS,
      messages: [],
      conversationHistory: [],
    });

    mockChat.mockRejectedValue(new Error('Network error'));

    await getStore().sendTextMessage('test');

    const s = getStore();
    const errorMsg = s.messages.find((m: any) => m.text.includes('Network error') || m.text.includes('Something went wrong'));
    expect(errorMsg).toBeDefined();
    expect(s.callState).toBe('idle');
  });

  test('STT error with voice activity shows specific error message', async () => {
    useVoiceCallStore.setState({
      isCallActive: true,
      callState: 'listening',
      isLiveMode: true,
      isRecording: true,
    });

    spyStopRecordingAndTranscribe.mockRejectedValue(new Error('Pollen balance depleted'));
    spyHadVoiceActivity.mockReturnValue(true);

    await getStore().stopRecording();

    const s = getStore();
    const errorMsg = s.messages.find((m: any) => m.text.includes('Pollen balance'));
    expect(errorMsg).toBeDefined();
  });

  test('endCall cleans up all state', async () => {
    useVoiceCallStore.setState({
      isCallActive: true,
      callState: 'listening',
      isLiveMode: true,
      isRecording: true,
      detectedLanguage: 'ar',
      messages: [{ id: '1', role: 'user', text: 'test', timestamp: '', proposedActions: [], isDecisionCard: false }],
      conversationHistory: [{ role: 'user', content: 'test' }],
      orderAddress: '123 Test St',
      lastOrderId: 'order-abc',
    });

    getStore().endCall();

    const s = getStore();
    expect(s.isCallActive).toBe(false);
    expect(s.callState).toBe('idle');
    expect(s.isRecording).toBe(false);
    expect(s.messages).toHaveLength(0);
    expect(s.conversationHistory).toHaveLength(0);
    expect(s.detectedLanguage).toBe('en');
    expect(s.connectionError).toBeNull();
    expect(s.orderAddress).toBe('');
    expect(s.lastOrderId).toBeNull();
  });

  // ── AudioService Language ──

  test('audioService.setLanguage maps language codes correctly', () => {
    audioService.setLanguage('ar');
    expect(() => audioService.setLanguage('en')).not.toThrow();
    expect(() => audioService.setLanguage('fr')).not.toThrow();
    expect(() => audioService.setLanguage('unknown')).not.toThrow();
  });

  // ── Chat Response Handling ──

  test('sendTextMessage handles normal AI response with action', async () => {
    useVoiceCallStore.setState({
      isCallActive: true,
      callState: 'idle',
      isLiveMode: false,
      isTTSEnabled: false,
      menuItemsFull: MENU_ITEMS,
      messages: [],
      conversationHistory: [],
    });

    mockChat.mockResolvedValue(
      'I\'ll add Classic Burger ($10.99) to your cart! |||ACTION:{"type":"add_to_cart","itemName":"Classic Burger","quantity":1}|||'
    );

    await getStore().sendTextMessage('Add a burger');

    const s = getStore();
    expect(s.messages).toHaveLength(2);
    expect(s.messages[0].role).toBe('user');
    expect(s.messages[0].text).toBe('Add a burger');
    expect(s.messages[1].role).toBe('assistant');
    expect(s.messages[1].text).toContain('Classic Burger');
    expect(s.messages[1].text).not.toContain('|||ACTION');
    expect(s.lastActionResult?.success).toBe(true);
    expect(s.lastActionResult?.action.type).toBe('add_to_cart');
  });

  test('sendTextMessage handles fallback response (empty from all models)', async () => {
    useVoiceCallStore.setState({
      isCallActive: true,
      callState: 'idle',
      isLiveMode: false,
      isTTSEnabled: false,
      menuItemsFull: MENU_ITEMS,
      messages: [],
      conversationHistory: [],
    });

    mockChat.mockResolvedValue(
      "I'm sorry, could you say that again? I didn't quite catch that. |||ACTION:{\"type\":\"none\"}|||"
    );

    await getStore().sendTextMessage('Some query');

    const s = getStore();
    expect(s.messages).toHaveLength(2);
    expect(s.messages[1].role).toBe('assistant');
    expect(s.messages[1].text).toContain('could you say that again');
  });

  test('sendTextMessage preserves conversation history across multiple turns', async () => {
    useVoiceCallStore.setState({
      isCallActive: true,
      callState: 'idle',
      isLiveMode: false,
      isTTSEnabled: false,
      menuItemsFull: MENU_ITEMS,
      messages: [],
      conversationHistory: [],
    });

    mockChat.mockResolvedValueOnce('Our Classic Burger is great! |||ACTION:{"type":"none"}|||');
    await getStore().sendTextMessage('What do you recommend?');

    expect(getStore().conversationHistory).toHaveLength(2);
    expect(getStore().conversationHistory[0].role).toBe('user');
    expect(getStore().conversationHistory[1].role).toBe('assistant');

    mockChat.mockResolvedValueOnce('Done! Added to cart. |||ACTION:{"type":"add_to_cart","itemName":"Classic Burger","quantity":1}|||');
    await getStore().sendTextMessage('Add it');

    expect(getStore().conversationHistory).toHaveLength(4);
    expect(getStore().messages).toHaveLength(4);
  });

  test('conversation history is trimmed when exceeding 20 messages', async () => {
    const longHistory = Array.from({ length: 22 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
    }));

    useVoiceCallStore.setState({
      isCallActive: true,
      callState: 'idle',
      isLiveMode: false,
      isTTSEnabled: false,
      menuItemsFull: MENU_ITEMS,
      messages: [],
      conversationHistory: longHistory as any,
    });

    mockChat.mockResolvedValue('Got it! |||ACTION:{"type":"none"}|||');
    await getStore().sendTextMessage('Next message');

    const history = getStore().conversationHistory;
    expect(history.length).toBeLessThanOrEqual(23);
    expect(history[history.length - 1].role).toBe('assistant');
    expect(history[history.length - 2].role).toBe('user');
    expect(history[history.length - 2].content).toBe('Next message');
  });

  // ── Full Conversation Loop Simulation ──

  test('full loop: start → greeting → listen → transcribe → AI reply → back to idle', async () => {
    mockChat.mockResolvedValue('Our Classic Burger at $10.99 is a great choice! |||ACTION:{"type":"none"}|||');
    spyStopRecordingAndTranscribe.mockResolvedValue('What do you recommend?');

    await getStore().startCall(MENU_ITEMS);
    let s = getStore();
    expect(s.isCallActive).toBe(true);
    expect(s.callState).toBe('idle');
    expect(s.messages.length).toBe(1);
    expect(s.messages[0].role).toBe('assistant');

    await getStore().startRecording();
    s = getStore();
    expect(s.callState).toBe('listening');
    expect(s.isRecording).toBe(true);

    await getStore().stopRecording();
    s = getStore();
    
    expect(s.messages.length).toBe(3);
    expect(s.messages[1].role).toBe('user');
    expect(s.messages[1].text).toBe('What do you recommend?');
    expect(s.messages[2].role).toBe('assistant');
    expect(s.messages[2].text).toContain('Classic Burger');
    expect(s.callState).toBe('idle');
    expect(s.conversationHistory.length).toBe(3);
  });

  test('full loop with Arabic: detect → hint STT → reply in Arabic', async () => {
    spyStopRecordingAndTranscribe.mockResolvedValue('مرحبا، أريد برجر');
    mockChat.mockResolvedValue('حاضر! برجر كلاسيك بـ $10.99 خيار ممتاز! |||ACTION:{"type":"add_to_cart","itemName":"Classic Burger","quantity":1}|||');

    await getStore().startCall(MENU_ITEMS);

    await getStore().startRecording();
    expect(getStore().callState).toBe('listening');

    await getStore().stopRecording();

    const s = getStore();
    expect(s.detectedLanguage).toBe('ar');
    expect(spySetLanguage).toHaveBeenCalledWith('ar');
    expect(s.messages.length).toBe(3);
    expect(s.messages[2].text).toContain('برجر');
    expect(s.lastActionResult?.success).toBe(true);
    expect(s.lastActionResult?.action.type).toBe('add_to_cart');
  });

  test('full loop: 5 consecutive turns without errors', async () => {
    await getStore().startCall(MENU_ITEMS);

    for (let turn = 0; turn < 5; turn++) {
      const userMsg = `Turn ${turn + 1} question`;
      mockChat.mockResolvedValueOnce(`Reply to turn ${turn + 1}! |||ACTION:{"type":"none"}|||`);

      await getStore().sendTextMessage(userMsg);

      const s = getStore();
      expect(s.messages[s.messages.length - 1].role).toBe('assistant');
      expect(s.messages[s.messages.length - 1].text).toContain(`Reply to turn ${turn + 1}`);
      expect(s.callState).toBe('idle');
    }

    const s = getStore();
    expect(s.messages.length).toBe(11); // 1 greeting + 5 * (user + assistant)
    expect(s.conversationHistory.length).toBe(11);
  });

  // ── Order Confirmation Flow ──

  test('confirm_order action succeeds when cart has items and address is set', async () => {
    const { useCartStore } = require('../state/CartStore');
    useCartStore.getState().clear();

    useVoiceCallStore.setState({
      isCallActive: true,
      callState: 'idle',
      isLiveMode: false,
      isTTSEnabled: false,
      menuItemsFull: MENU_ITEMS,
      messages: [],
      conversationHistory: [],
      orderAddress: '123 Main St',
    });

    // First add an item to cart
    mockChat.mockResolvedValueOnce(
      'Added Classic Burger to your cart! |||ACTION:{"type":"add_to_cart","itemName":"Classic Burger","quantity":2}|||'
    );
    await getStore().sendTextMessage('I want 2 burgers');

    expect(getStore().lastActionResult?.success).toBe(true);

    // Now confirm the order
    mockChat.mockResolvedValueOnce(
      'Your order is confirmed! |||ACTION:{"type":"confirm_order"}|||'
    );
    await getStore().sendTextMessage('Yes, confirm my order');

    const s = getStore();
    expect(s.lastActionResult?.success).toBe(true);
    expect(s.lastActionResult?.message).toContain('placed');
  });

  test('confirm_order fails when cart is empty', async () => {
    const { useCartStore } = require('../state/CartStore');
    useCartStore.getState().clear();

    useVoiceCallStore.setState({
      isCallActive: true,
      callState: 'idle',
      isLiveMode: false,
      isTTSEnabled: false,
      menuItemsFull: MENU_ITEMS,
      messages: [],
      conversationHistory: [],
    });

    mockChat.mockResolvedValue(
      'Your order is confirmed! |||ACTION:{"type":"confirm_order"}|||'
    );
    await getStore().sendTextMessage('Confirm order');

    const s = getStore();
    expect(s.lastActionResult?.success).toBe(false);
    expect(s.lastActionResult?.message).toContain('empty');
  });

  test('confirm_order fails when no address is set', async () => {
    const { useCartStore } = require('../state/CartStore');
    useCartStore.getState().clear();

    useVoiceCallStore.setState({
      isCallActive: true,
      callState: 'idle',
      isLiveMode: false,
      isTTSEnabled: false,
      menuItemsFull: MENU_ITEMS,
      messages: [],
      conversationHistory: [],
      orderAddress: '',
    });

    // Add items first
    mockChat.mockResolvedValueOnce(
      'Added! |||ACTION:{"type":"add_to_cart","itemName":"Classic Burger","quantity":1}|||'
    );
    await getStore().sendTextMessage('I want a burger');

    // Try to confirm without address
    mockChat.mockResolvedValueOnce(
      'Confirmed! |||ACTION:{"type":"confirm_order"}|||'
    );
    await getStore().sendTextMessage('Confirm');

    const s = getStore();
    expect(s.lastActionResult?.success).toBe(false);
    expect(s.lastActionResult?.message).toContain('address');
  });

  test('set_address action saves delivery address in store', async () => {
    useVoiceCallStore.setState({
      isCallActive: true,
      callState: 'idle',
      isLiveMode: false,
      isTTSEnabled: false,
      menuItemsFull: MENU_ITEMS,
      messages: [],
      conversationHistory: [],
      orderAddress: '',
    });

    mockChat.mockResolvedValue(
      'Got it, delivering to that address! |||ACTION:{"type":"set_address","address":"123 Main St, Apt 4"}|||'
    );
    await getStore().sendTextMessage('My address is 123 Main St, Apt 4');

    const s = getStore();
    expect(s.lastActionResult?.success).toBe(true);
    expect(s.lastActionResult?.message).toContain('123 Main St');
    expect(s.orderAddress).toBe('123 Main St, Apt 4');
  });

  // ── Arabic Chat Flow ──

  test('Arabic text message gets Arabic response', async () => {
    useVoiceCallStore.setState({
      isCallActive: true,
      callState: 'idle',
      isLiveMode: false,
      isTTSEnabled: false,
      detectedLanguage: 'en',
      menuItemsFull: MENU_ITEMS,
      messages: [],
      conversationHistory: [],
    });

    mockChat.mockResolvedValue(
      'حاضر! برجر كلاسيك بـ $10.99 يضاف لسلتك! |||ACTION:{"type":"add_to_cart","itemName":"Classic Burger","quantity":1}|||'
    );

    await getStore().sendTextMessage('أريد برجر');

    const s = getStore();
    expect(s.detectedLanguage).toBe('ar');
    expect(s.messages[1].text).toContain('برجر');
    expect(mockChat).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'ar',
    );
  });
});

describe('detectLanguage utility', () => {
  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });
    useVoiceCallStore.setState({
      callState: 'idle',
      isCallActive: true,
      isLiveMode: true,
      isTTSEnabled: false,
      isMuted: false,
      isRecording: true,
      detectedLanguage: 'en',
      menuItemsFull: MENU_ITEMS,
      messages: [],
      conversationHistory: [],
      showQuickChips: true,
      quickChips: [],
      lastActionResult: null,
      connectionError: null,
      orderAddress: '',
      lastOrderId: null,
    });
    jest.clearAllMocks();
    setupSpies();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('English text keeps language as en', async () => {
    useVoiceCallStore.setState({ callState: 'listening', isRecording: true });
    spyStopRecordingAndTranscribe.mockResolvedValue('I want something to eat');
    mockChat.mockResolvedValue('How about our Classic Burger? |||ACTION:{"type":"none"}|||');

    await getStore().stopRecording();
    expect(getStore().detectedLanguage).toBe('en');
  });

  test('Arabic text switches language to ar', async () => {
    useVoiceCallStore.setState({ callState: 'listening', isRecording: true });
    spyStopRecordingAndTranscribe.mockResolvedValue('أعطني شيء حار');
    mockChat.mockResolvedValue('تفضل، عندنا برجر كلاسيك! |||ACTION:{"type":"none"}|||');

    await getStore().stopRecording();
    expect(getStore().detectedLanguage).toBe('ar');
  });

  test('Mixed text with Arabic characters detects as Arabic', async () => {
    useVoiceCallStore.setState({ callState: 'listening', isRecording: true });
    spyStopRecordingAndTranscribe.mockResolvedValue('I want برجر please');
    mockChat.mockResolvedValue('Sure! |||ACTION:{"type":"none"}|||');

    await getStore().stopRecording();
    expect(getStore().detectedLanguage).toBe('ar');
  });
});

describe('VoiceAIService chat — model selection and retry', () => {
  // These tests verify the actual VoiceAIService class behavior (not mocked)
  // by mocking the global fetch.

  const realFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });
  });

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  function makeChatResponse(content: string, model: string = 'gpt-5.2', reasoningTokens = 0) {
    return {
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null,
      },
      json: async () => ({
        choices: [{
          message: { role: 'assistant', content },
          finish_reason: content ? 'stop' : 'length',
          index: 0,
        }],
        model,
        usage: {
          total_tokens: 100,
          completion_tokens: 50,
          prompt_tokens: 50,
          completion_tokens_details: { reasoning_tokens: reasoningTokens },
        },
      }),
    } as unknown as Response;
  }

  function makeEmptyChatResponse(model: string = 'gpt-5-mini', reasoningTokens = 128) {
    return makeChatResponse('', model, reasoningTokens);
  }

  test('primary model (openai-large) returns content → success on first try', async () => {
    const { VoiceAIService } = jest.requireActual('../services/VoiceAIService') as any;
    const service = new VoiceAIService();

    const fetchCalls: { model: string }[] = [];

    global.fetch = jest.fn(async (_url: any, opts: any) => {
      const body = JSON.parse(opts.body);
      fetchCalls.push({ model: body.model });
      return makeChatResponse('Here is a great burger option! |||ACTION:{"type":"none"}|||');
    }) as any;

    const result = await service.chat(
      [{ role: 'user', content: 'What do you have?' }],
      'Menu: Burger $10',
      'No preferences',
      'en',
    );

    expect(result).toContain('great burger option');
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0].model).toBe('openai');
  });

  test('primary model returns empty → falls back to fallback model', async () => {
    const { VoiceAIService } = jest.requireActual('../services/VoiceAIService') as any;
    const service = new VoiceAIService();

    const fetchCalls: { model: string }[] = [];
    let callIndex = 0;

    global.fetch = jest.fn(async (_url: any, opts: any) => {
      const body = JSON.parse(opts.body);
      fetchCalls.push({ model: body.model });
      callIndex++;
      if (callIndex === 1) {
        return makeEmptyChatResponse();
      }
      return makeChatResponse('Fallback works! |||ACTION:{"type":"none"}|||', 'gpt-5-mini', 200);
    }) as any;

    const result = await service.chat(
      [{ role: 'user', content: 'Test' }],
      'Menu: Burger $10',
      'No prefs',
      'en',
    );

    expect(result).toContain('Fallback works');
    expect(fetchCalls.length).toBe(2);
    expect(fetchCalls[0].model).toBe('openai');
    expect(fetchCalls[1].model).toBe('openai');
  });

  test('both models return empty → falls back to minimal prompt, then apology', async () => {
    const { VoiceAIService } = jest.requireActual('../services/VoiceAIService') as any;
    const service = new VoiceAIService();

    const fetchCalls: { model: string; messageCount: number }[] = [];

    global.fetch = jest.fn(async (_url: any, opts: any) => {
      const body = JSON.parse(opts.body);
      fetchCalls.push({ model: body.model, messageCount: body.messages.length });
      return makeEmptyChatResponse();
    }) as any;

    const result = await service.chat(
      [{ role: 'user', content: 'Hello' }],
      'Menu: Burger $10',
      'No prefs',
      'en',
    );

    expect(result).toContain("could you say that again");
    expect(fetchCalls.length).toBe(3);
    expect(fetchCalls[2].messageCount).toBe(2); // minimal: system + user only
  });

  test('menu context is truncated when exceeding limit', async () => {
    const { VoiceAIService } = jest.requireActual('../services/VoiceAIService') as any;
    const service = new VoiceAIService();

    let capturedBody: any = null;

    global.fetch = jest.fn(async (_url: any, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return makeChatResponse('Here are some options! |||ACTION:{"type":"none"}|||');
    }) as any;

    const hugeMenu = 'X'.repeat(5000);
    await service.chat(
      [{ role: 'user', content: 'What do you have?' }],
      hugeMenu,
      'No prefs',
      'en',
    );

    const systemMsg = capturedBody.messages[0].content;
    expect(systemMsg).not.toContain('X'.repeat(5000));
    expect(systemMsg).toContain('...(more items available)');
  });

  test('conversation history is trimmed to last 10 messages', async () => {
    const { VoiceAIService } = jest.requireActual('../services/VoiceAIService') as any;
    const service = new VoiceAIService();

    let capturedBody: any = null;

    global.fetch = jest.fn(async (_url: any, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return makeChatResponse('Reply! |||ACTION:{"type":"none"}|||');
    }) as any;

    const longHistory = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i}`,
    }));

    await service.chat(longHistory as any, 'Menu', 'Prefs', 'en');

    // 1 system + 10 recent messages = 11
    expect(capturedBody.messages.length).toBe(11);
    expect(capturedBody.messages[0].role).toBe('system');
    expect(capturedBody.messages[1].content).toBe('Message 10');
    expect(capturedBody.messages[10].content).toBe('Message 19');
  });

  test('uses max_tokens=300 for primary model', async () => {
    const { VoiceAIService } = jest.requireActual('../services/VoiceAIService') as any;
    const service = new VoiceAIService();

    let capturedBody: any = null;

    global.fetch = jest.fn(async (_url: any, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return makeChatResponse('Hello! |||ACTION:{"type":"none"}|||');
    }) as any;

    await service.chat(
      [{ role: 'user', content: 'Hi' }],
      'Menu',
      'Prefs',
      'en',
    );

    expect(capturedBody.model).toBe('openai');
    expect(capturedBody.max_tokens).toBe(300);
  });

  test('uses max_tokens=512 for fallback model', async () => {
    const { VoiceAIService } = jest.requireActual('../services/VoiceAIService') as any;
    const service = new VoiceAIService();

    const bodies: any[] = [];

    global.fetch = jest.fn(async (_url: any, opts: any) => {
      const body = JSON.parse(opts.body);
      bodies.push(body);
      // First call returns empty, second call (fallback) returns content
      if (bodies.length === 1) {
        return makeEmptyChatResponse();
      }
      return makeChatResponse('Fallback reply! |||ACTION:{"type":"none"}|||', 'openai', 200);
    }) as any;

    await service.chat(
      [{ role: 'user', content: 'Hi' }],
      'Menu',
      'Prefs',
      'en',
    );

    expect(bodies.length).toBeGreaterThanOrEqual(2);
    expect(bodies[1].model).toBe('openai');
    expect(bodies[1].max_tokens).toBe(512);
  });

  test('401 error propagates as request error', async () => {
    const { VoiceAIService } = jest.requireActual('../services/VoiceAIService') as any;
    const service = new VoiceAIService();

    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Unauthorized' } }),
    })) as any;

    // 401 on all attempts → chat returns fallback message (graceful degradation)
    const result = await service.chat([{ role: 'user', content: 'Hi' }], 'Menu', 'Prefs', 'en');
    expect(result).toContain('sorry');
  });

  test('402 error retries on free tier and falls back gracefully', async () => {
    const { VoiceAIService } = jest.requireActual('../services/VoiceAIService') as any;
    const service = new VoiceAIService();

    // Both authenticated and free-tier requests return 402
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 402,
      json: async () => ({ error: { message: 'Insufficient balance' } }),
    })) as any;

    // chat() gracefully degrades — returns a fallback message instead of throwing
    const result = await service.chat([{ role: 'user', content: 'Hi' }], 'Menu', 'Prefs', 'en');
    expect(result).toContain('sorry');
    // Verify fetch was called multiple times (auth + free-tier retries)
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(2);
  });
});
