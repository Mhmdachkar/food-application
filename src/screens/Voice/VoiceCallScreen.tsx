import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  TextInput,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVoiceCallStore, DEFAULT_QUICK_CHIPS } from '../../state/VoiceCallStore';
import { useMenuQuery, MENU_QUERY_KEY } from '../../hooks/useMenuQuery';
import { useQueryClient } from '@tanstack/react-query';
import { useCartStore } from '../../state/CartStore';
import { colors, spacing, radii } from '../../theme/theme';
import type { ConversationMessage, QuickChip } from '../../models/VoiceCallTypes';
import { logger } from '../../utils/logger';

const { width: SCREEN_W } = Dimensions.get('window');

const CHIP_ICONS: Record<string, string> = {
  fire: '\uD83D\uDD25',
  leaf: '\uD83C\uDF3F',
  clock: '\u23F1\uFE0F',
  sparkles: '\u2728',
  pepper: '\uD83C\uDF36\uFE0F',
  heart: '\u2764\uFE0F',
};

const IDLE_FEATURES = [
  { icon: '\uD83D\uDCAC', title: 'Natural Chat', desc: 'Talk like you would to a friend' },
  { icon: '\uD83C\uDF74', title: 'Menu Expert', desc: 'Knows every dish and ingredient' },
  { icon: '\uD83E\uDDE0', title: 'Remembers You', desc: 'Your preferences, always' },
  { icon: '\u26A1', title: 'Quick Actions', desc: 'Reorder, modify, check out' },
];

const PulsingOrb: React.FC<{ isActive: boolean; state: string }> = ({ isActive, state }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  const ring1 = useRef(new Animated.Value(1)).current;
  const ring2 = useRef(new Animated.Value(1)).current;
  const ring1Op = useRef(new Animated.Value(0.4)).current;
  const ring2Op = useRef(new Animated.Value(0.2)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isActive) {
      scale.setValue(1);
      opacity.setValue(0.6);
      ring1.setValue(1);
      ring2.setValue(1);
      return;
    }

    const pulseSpeed = state === 'thinking' ? 600 : 1200;

    const mainPulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: state === 'thinking' ? 1.15 : 1.08, duration: pulseSpeed, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: pulseSpeed, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: pulseSpeed, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: pulseSpeed, useNativeDriver: true }),
        ]),
      ]),
    );

    const ringPulse1 = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ring1, { toValue: 1.6, duration: 2000, useNativeDriver: true }),
          Animated.timing(ring1Op, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ring1, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(ring1Op, { toValue: 0.4, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );

    const ringPulse2 = Animated.loop(
      Animated.sequence([
        Animated.delay(600),
        Animated.parallel([
          Animated.timing(ring2, { toValue: 1.8, duration: 2400, useNativeDriver: true }),
          Animated.timing(ring2Op, { toValue: 0, duration: 2400, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ring2, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(ring2Op, { toValue: 0.2, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );

    const rotateAnim = Animated.loop(
      Animated.timing(rotate, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true }),
    );

    mainPulse.start();
    ringPulse1.start();
    ringPulse2.start();
    rotateAnim.start();
    return () => { mainPulse.stop(); ringPulse1.stop(); ringPulse2.stop(); rotateAnim.stop(); };
  }, [isActive, state]);

  const orbColor = state === 'listening' ? '#E53935' : state === 'transcribing' ? '#FF9800' : state === 'thinking' ? colors.accent : state === 'speaking' ? '#43A047' : state === 'error' ? colors.danger : '#4A90D9';
  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={orbStyles.wrapper}>
      {/* Ripple rings */}
      <Animated.View style={[orbStyles.ring, { borderColor: orbColor, opacity: ring2Op, transform: [{ scale: ring2 }] }]} />
      <Animated.View style={[orbStyles.ring, { borderColor: orbColor, opacity: ring1Op, transform: [{ scale: ring1 }] }]} />
      {/* Glow */}
      <Animated.View
        style={[
          orbStyles.glow,
          { backgroundColor: orbColor, opacity: Animated.multiply(opacity, 0.25), transform: [{ scale: Animated.multiply(scale, 1.5) }, { rotate: spin }] },
        ]}
      />
      {/* Main orb */}
      <Animated.View style={[orbStyles.orb, { backgroundColor: orbColor, opacity, transform: [{ scale }] }]}>
        <Text style={orbStyles.icon}>
          {state === 'thinking' ? '\uD83E\uDD14' : state === 'error' ? '\u26A0\uFE0F' : '\uD83C\uDF5C'}
        </Text>
      </Animated.View>
      {/* Status label */}
      <View style={orbStyles.statusPill}>
        {state === 'thinking' && <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 6 }} />}
        <Text style={[orbStyles.label, (state === 'thinking' || state === 'listening' || state === 'transcribing') && { color: colors.accent }]}>
          {state === 'listening' ? 'Listening...' : state === 'transcribing' ? 'Processing...' : state === 'thinking' ? 'Thinking...' : state === 'speaking' ? 'Speaking...' : state === 'error' ? 'Error' : isActive ? 'Connected' : 'Ready'}
        </Text>
      </View>
    </View>
  );
};

const orbStyles = StyleSheet.create({
  wrapper: { alignItems: 'center', paddingVertical: spacing.md },
  ring: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
  },
  glow: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
  },
  orb: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  icon: { fontSize: 34 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

const TypingIndicator: React.FC = () => {
  const d1 = useRef(new Animated.Value(0.3)).current;
  const d2 = useRef(new Animated.Value(0.3)).current;
  const d3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0.3, duration: 300, useNativeDriver: true }),
      ]));
    const a1 = anim(d1, 0); const a2 = anim(d2, 150); const a3 = anim(d3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={bubbleStyles.typingRow}>
      <View style={bubbleStyles.avatarSmall}><Text style={bubbleStyles.avatarText}>{'\uD83C\uDF5C'}</Text></View>
      <View style={[bubbleStyles.bubble, bubbleStyles.assistantBubble, bubbleStyles.typingBubble]}>
        {[d1, d2, d3].map((d, i) => (
          <Animated.View key={i} style={[bubbleStyles.typingDot, { opacity: d }]} />
        ))}
      </View>
    </View>
  );
};

const ChatBubble = React.memo<{ message: ConversationMessage }>(({ message }) => {
  const isUser = message.role === 'user';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(isUser ? 20 : -20)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        bubbleStyles.container,
        isUser ? bubbleStyles.userAlign : bubbleStyles.assistantAlign,
        { opacity: fadeAnim, transform: [{ translateX: slideAnim }, { scale: scaleAnim }] },
      ]}
    >
      {!isUser && (
        <View style={bubbleStyles.avatarSmall}>
          <Text style={bubbleStyles.avatarText}>{'\uD83C\uDF5C'}</Text>
        </View>
      )}
      <View style={[bubbleStyles.bubble, isUser ? bubbleStyles.userBubble : bubbleStyles.assistantBubble]}>
        <Text style={isUser ? bubbleStyles.userText : bubbleStyles.assistantText}>
          {message.text}
        </Text>
        <Text style={[bubbleStyles.time, isUser && { color: 'rgba(255,255,255,0.55)' }]}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </Animated.View>
  );
});

const bubbleStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingHorizontal: spacing.md,
    alignItems: 'flex-end',
  },
  userAlign: { justifyContent: 'flex-end' },
  assistantAlign: { justifyContent: 'flex-start' },
  avatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  avatarText: { fontSize: 14 },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 22,
  },
  userBubble: {
    backgroundColor: '#4A6CF7',
    borderBottomRightRadius: 6,
    shadowColor: '#4A6CF7',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: '#F0F0F5',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  userText: { color: '#FFFFFF', fontSize: 15, lineHeight: 22, fontWeight: '500' },
  assistantText: { color: colors.textPrimary, fontSize: 15, lineHeight: 22 },
  time: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    marginBottom: 10,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 5,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textSecondary,
  },
});

export const VoiceCallScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: menuItems = [], isLoading: dataLoading } = useMenuQuery();
  const queryClient = useQueryClient();
  const {
    messages,
    callState,
    isCallActive,
    isLiveMode,
    isTTSEnabled,
    isMuted,
    isSpeakerOn,
    isRecording,
    showQuickChips,
    quickChips,
    startCall,
    endCall,
    toggleTTS,
    toggleMute,
    toggleSpeaker,
    toggleLiveMode,
    sendTextMessage,
    sendQuickChip,
    lastActionResult,
    lastOrderId,
    startRecording,
    stopRecording,
    connectionError,
  } = useVoiceCallStore();
  const cartItemCount = useCartStore(s => s.itemCount());
  const [text, setText] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const listRef = useRef<FlatList>(null);

  // Log every state transition for on-device debugging
  useEffect(() => {
    const entry = `[${new Date().toLocaleTimeString()}] ${callState} rec=${isRecording} live=${isLiveMode} mute=${isMuted}`;
    logger.log('[VoiceCallScreen]', entry);
    setDebugLog(prev => [...prev.slice(-15), entry]);
  }, [callState, isRecording, isLiveMode, isMuted]);

  const handleStart = useCallback(async () => {
    setIsStarting(true);
    try {
      let items = menuItems;
      if (items.length === 0) {
        logger.log('[VoiceCallScreen] Menu empty, refreshing...');
        const { menuService } = await import('../../services/MenuService');
        const result = await queryClient.fetchQuery({
          queryKey: MENU_QUERY_KEY,
          queryFn: async () => {
            await menuService.fetchMenuItems();
            return menuService.state.menuItems;
          },
        });
        items = result ?? [];
      }
      if (items.length === 0) {
        logger.warn('[VoiceCallScreen] Still no menu items after refresh');
      }
      await startCall(items);
    } finally {
      setIsStarting(false);
    }
  }, [startCall, menuItems, queryClient]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    await sendTextMessage(trimmed);
  }, [text, sendTextMessage]);

  const handleChip = useCallback(
    async (chip: QuickChip) => {
      await sendQuickChip(chip);
    },
    [sendQuickChip],
  );

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  if (!isCallActive) {
    return (
      <ScrollView style={[styles.idleContainer, { paddingTop: insets.top }]} contentContainerStyle={styles.idleScroll}>
        {/* Back button */}
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>

        <View style={styles.idleHero}>
          <View style={styles.idleOrbOuter}>
            <View style={styles.idleOrbRing} />
            <View style={styles.idleOrb}>
              <Text style={styles.idleOrbIcon}>{'\uD83C\uDF5C'}</Text>
            </View>
          </View>
          <Text style={styles.idleTitle}>Food Assistant</Text>
          <Text style={styles.idleSubtitle}>
            Your personal AI-powered food concierge. Ask anything about the menu, get tailored recommendations, or place orders with just your words.
          </Text>
        </View>
        <View style={styles.featureGrid}>
          {IDLE_FEATURES.map(f => (
            <View key={f.title} style={styles.featureCard}>
              <Text style={styles.featureCardIcon}>{f.icon}</Text>
              <Text style={styles.featureCardTitle}>{f.title}</Text>
              <Text style={styles.featureCardDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>
        <Pressable
          style={({ pressed }) => [styles.startButton, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }, isStarting && { opacity: 0.6 }]}
          onPress={handleStart}
          disabled={isStarting}
        >
          {isStarting ? (
            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 10 }} />
          ) : (
            <Text style={styles.startButtonIcon}>{'\uD83C\uDF99\uFE0F'}</Text>
          )}
          <Text style={styles.startButtonText}>{isStarting ? 'Starting...' : 'Start Conversation'}</Text>
        </Pressable>
        <Text style={styles.idleFooter}>Powered by AI {'\u00B7'} Your data stays private</Text>
      </ScrollView>
    );
  }

  // Get the last messages for live captions
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');

  // ── LIVE CALL MODE ── (phone-call-like full screen)
  if (isLiveMode) {
    return (
      <View style={[callStyles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/* Top bar */}
        <View style={callStyles.topBar}>
          <View style={callStyles.dotGreen} />
          <Text style={callStyles.topTitle}>Food Assistant</Text>
          <Pressable onPress={() => setShowDebug(d => !d)}>
            <Text style={callStyles.topStatus}>
              {callState === 'listening' ? 'Listening' : callState === 'transcribing' ? 'Processing' : callState === 'thinking' ? 'Thinking' : callState === 'speaking' ? 'Speaking' : callState === 'error' ? 'Error' : 'Connected'}
            </Text>
          </Pressable>
        </View>

        {/* Debug overlay — tap status text to toggle */}
        {showDebug && (
          <View style={callStyles.debugOverlay}>
            {debugLog.map((line, i) => (
              <Text key={i} style={callStyles.debugLine}>{line}</Text>
            ))}
          </View>
        )}

        {/* Connection error banner */}
        {connectionError && (
          <View style={callStyles.errorBanner}>
            <Text style={callStyles.errorBannerText}>{connectionError}</Text>
          </View>
        )}

        {/* Action toast */}
        {lastActionResult && lastActionResult.action.type !== 'none' && (
          <View style={[callStyles.actionToast, lastActionResult.success ? callStyles.actionToastSuccess : callStyles.actionToastError]}>
            <Text style={callStyles.actionToastIcon}>
              {lastActionResult.success
                ? lastActionResult.action.type === 'add_to_cart' ? '\uD83D\uDED2' : lastActionResult.action.type === 'remove_from_cart' ? '\uD83D\uDDD1\uFE0F' : lastActionResult.action.type === 'clear_cart' ? '\uD83E\uDDF9' : '\u2705'
                : '\u26A0\uFE0F'}
            </Text>
            <Text style={callStyles.actionToastText} numberOfLines={1}>{lastActionResult.message}</Text>
          </View>
        )}

        {/* Order placed badge */}
        {lastOrderId && (
          <View style={[callStyles.cartBadge, { backgroundColor: 'rgba(67,160,71,0.25)' }]}>
            <Text style={callStyles.cartBadgeIcon}>{'\u2705'}</Text>
            <Text style={callStyles.cartBadgeText}>Order #{lastOrderId.slice(0, 6)} placed</Text>
          </View>
        )}

        {/* Cart badge */}
        {cartItemCount > 0 && !lastOrderId && (
          <View style={callStyles.cartBadge}>
            <Text style={callStyles.cartBadgeIcon}>{'\uD83D\uDED2'}</Text>
            <Text style={callStyles.cartBadgeText}>{cartItemCount} item{cartItemCount !== 1 ? 's' : ''}</Text>
          </View>
        )}

        {/* Center area */}
        <View style={callStyles.center}>
          <PulsingOrb isActive={isCallActive} state={callState} />
          <View style={callStyles.captionBox}>
            {callState === 'listening' && (
              <Text style={callStyles.listenText}>{'\uD83C\uDF99\uFE0F'} Speak now...</Text>
            )}
            {callState === 'transcribing' && (
              <View style={callStyles.row}>
                <ActivityIndicator size="small" color="#FF9800" />
                <Text style={callStyles.processText}> Transcribing...</Text>
              </View>
            )}
            {callState === 'thinking' && (
              <View style={callStyles.row}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={callStyles.processText}> Thinking...</Text>
              </View>
            )}
            {lastUserMsg && callState !== 'listening' && (
              <Text style={callStyles.userCaption} numberOfLines={2}>You: {lastUserMsg.text}</Text>
            )}
            {lastAssistantMsg && (callState === 'speaking' || callState === 'idle') && (
              <Text style={callStyles.aiCaption} numberOfLines={4}>{lastAssistantMsg.text}</Text>
            )}
          </View>
        </View>

        {/* Bottom controls */}
        <View style={callStyles.controls}>
          <Pressable style={[callStyles.ctrlBtn, isMuted && callStyles.ctrlActive]} onPress={toggleMute}>
            <Text style={callStyles.ctrlIcon}>{isMuted ? '\uD83D\uDD07' : '\uD83C\uDF99\uFE0F'}</Text>
            <Text style={callStyles.ctrlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </Pressable>
          <Pressable style={[callStyles.ctrlBtn, isSpeakerOn && callStyles.ctrlActive]} onPress={toggleSpeaker}>
            <Text style={callStyles.ctrlIcon}>{isSpeakerOn ? '\uD83D\uDD0A' : '\uD83D\uDD08'}</Text>
            <Text style={callStyles.ctrlLabel}>Speaker</Text>
          </Pressable>
          <Pressable style={callStyles.endBtn} onPress={endCall}>
            <Text style={callStyles.endIcon}>{'\uD83D\uDCF5'}</Text>
          </Pressable>
          <Pressable style={[callStyles.ctrlBtn, !isTTSEnabled && callStyles.ctrlActive]} onPress={toggleTTS}>
            <Text style={callStyles.ctrlIcon}>{isTTSEnabled ? '\uD83D\uDDE3\uFE0F' : '\uD83E\uDD10'}</Text>
            <Text style={callStyles.ctrlLabel}>Voice</Text>
          </Pressable>
          <Pressable style={callStyles.ctrlBtn} onPress={toggleLiveMode}>
            <Text style={callStyles.ctrlIcon}>{'\u2328\uFE0F'}</Text>
            <Text style={callStyles.ctrlLabel}>Text</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── TEXT / MANUAL MODE ──
  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerDot} />
          <Text style={styles.headerTitle}>Food Assistant</Text>
        </View>
        <View style={styles.headerControls}>
          <Pressable style={styles.controlBtn} onPress={toggleLiveMode}>
            <Text style={styles.controlIcon}>{'\uD83D\uDCDE'}</Text>
          </Pressable>
          <Pressable style={styles.endCallBtn} onPress={endCall}>
            <Text style={styles.endCallIcon}>{'\u2716\uFE0F'}</Text>
          </Pressable>
        </View>
      </View>
      <PulsingOrb isActive={isCallActive} state={callState} />
      {connectionError && (
        <View style={styles.textModeError}>
          <Text style={styles.textModeErrorText}>{connectionError}</Text>
        </View>
      )}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m: ConversationMessage) => m.id}
        renderItem={({ item }) => <ChatBubble message={item} />}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        showsVerticalScrollIndicator={false}
      />
      {(callState === 'thinking' || callState === 'transcribing') && <TypingIndicator />}
      {showQuickChips && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer} style={styles.chipsScroll}>
          {quickChips.map(chip => (
            <Pressable key={chip.id} style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]} onPress={() => handleChip(chip)}>
              <Text style={styles.chipIcon}>{CHIP_ICONS[chip.icon] ?? '\uD83D\uDCAC'}</Text>
              <Text style={styles.chipLabel}>{chip.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <View style={styles.inputBar}>
        <Pressable
          style={({ pressed }) => [styles.micBtn, isRecording && styles.micBtnRecording, (callState === 'thinking' || callState === 'transcribing' || callState === 'speaking') && styles.micBtnDisabled, pressed && { opacity: 0.7 }]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={callState === 'thinking' || callState === 'transcribing' || callState === 'speaking'}
        >
          <Text style={styles.micIcon}>{isRecording ? '\u23F9\uFE0F' : '\uD83C\uDF99\uFE0F'}</Text>
        </Pressable>
        <TextInput
          style={styles.textInput}
          value={text}
          onChangeText={setText}
          placeholder={isRecording ? 'Listening...' : 'Type a message...'}
          placeholderTextColor={isRecording ? '#E53935' : colors.textSecondary}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={callState !== 'thinking' && !isRecording}
        />
        <Pressable
          style={({ pressed }) => [styles.sendBtn, (!text.trim() || callState === 'thinking' || isRecording) && styles.sendBtnDisabled, pressed && { opacity: 0.7 }]}
          onPress={handleSend}
          disabled={!text.trim() || callState === 'thinking' || isRecording}
        >
          <Text style={styles.sendIcon}>{'\u2B06\uFE0F'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

/* ── Live Call Styles ── */
const callStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A1A2E' },
  topBar: { alignItems: 'center', paddingVertical: 16 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#43A047', marginBottom: 8, shadowColor: '#43A047', shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  topTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  topStatus: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  captionBox: { marginTop: 24, paddingHorizontal: 32, minHeight: 80, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  listenText: { fontSize: 18, fontWeight: '700', color: '#E53935' },
  processText: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  userCaption: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginBottom: 8 },
  aiCaption: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', textAlign: 'center', lineHeight: 24 },
  controls: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 12 },
  ctrlBtn: { width: 56, height: 72, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  ctrlActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  ctrlIcon: { fontSize: 22 },
  ctrlLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.6)', marginTop: 4, textTransform: 'uppercase' },
  endBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center', shadowColor: '#FF3B30', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  endIcon: { fontSize: 26 },
  actionToast: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginTop: 4 },
  actionToastSuccess: { backgroundColor: 'rgba(67,160,71,0.2)' },
  actionToastError: { backgroundColor: 'rgba(229,57,53,0.2)' },
  actionToastIcon: { fontSize: 16, marginRight: 8 },
  actionToastText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)', maxWidth: 260 },
  cartBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', backgroundColor: 'rgba(74,108,247,0.25)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, marginTop: 8 },
  cartBadgeIcon: { fontSize: 14, marginRight: 6 },
  cartBadgeText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  errorBanner: { alignSelf: 'center', backgroundColor: 'rgba(229,57,53,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, marginTop: 4, maxWidth: '90%' },
  errorBannerText: { fontSize: 12, fontWeight: '600', color: '#FF6B6B', textAlign: 'center' },
  debugOverlay: { backgroundColor: 'rgba(0,0,0,0.85)', marginHorizontal: 8, borderRadius: 8, padding: 8, maxHeight: 200 },
  debugLine: { fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#4ADE80', lineHeight: 13 },
});

/* ── Idle + Text Mode Styles ── */
const styles = StyleSheet.create({
  idleContainer: { flex: 1, backgroundColor: '#F7F8FC' },
  idleScroll: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: 12, paddingBottom: 40 },
  backBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 4, marginBottom: 8 },
  backBtnText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginLeft: 6 },
  idleHero: { alignItems: 'center', marginBottom: 32 },
  idleOrbOuter: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  idleOrbRing: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 2, borderColor: '#4A90D920' },
  idleOrb: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#4A6CF7', alignItems: 'center', justifyContent: 'center', shadowColor: '#4A6CF7', shadowOpacity: 0.4, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  idleOrbIcon: { fontSize: 48 },
  idleTitle: { fontSize: 30, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: spacing.sm },
  idleSubtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 23, maxWidth: 320 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32, width: '100%' },
  featureCard: { width: (SCREEN_W - spacing.lg * 2 - 12) / 2, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F0F0F5', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  featureCardIcon: { fontSize: 26, marginBottom: 8 },
  featureCardTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginBottom: 3 },
  featureCardDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
  startButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4A6CF7', paddingHorizontal: 40, paddingVertical: 18, borderRadius: 28, width: '100%', shadowColor: '#4A6CF7', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8, marginBottom: 16 },
  startButtonIcon: { fontSize: 20, marginRight: 10 },
  startButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  idleFooter: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  container: { flex: 1, backgroundColor: '#F7F8FC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F5', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.success, marginRight: spacing.sm, shadowColor: colors.success, shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  headerControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  controlBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F4F5F9', alignItems: 'center', justifyContent: 'center' },
  controlIcon: { fontSize: 16 },
  endCallBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FF3B3010', alignItems: 'center', justifyContent: 'center', marginLeft: 2, borderWidth: 1.5, borderColor: '#FF3B3030' },
  endCallIcon: { fontSize: 14 },
  messageList: { flex: 1 },
  messageContent: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  chipsScroll: { maxHeight: 50 },
  chipsContainer: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1.5, borderColor: '#EDEDF3', marginRight: spacing.sm, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  chipPressed: { backgroundColor: '#4A6CF708', borderColor: '#4A6CF740' },
  chipIcon: { fontSize: 14, marginRight: 6 },
  chipLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F0F0F5', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: -2 }, elevation: 2 },
  textInput: { flex: 1, height: 46, borderRadius: 23, backgroundColor: '#F4F5F9', paddingHorizontal: 18, fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#4A6CF7', alignItems: 'center', justifyContent: 'center', marginLeft: 8, shadowColor: '#4A6CF7', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  sendBtnDisabled: { opacity: 0.35 },
  sendIcon: { fontSize: 18 },
  micBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#F4F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 8, borderWidth: 1.5, borderColor: '#EDEDF3' },
  micBtnRecording: { backgroundColor: '#FFEBEE', borderColor: '#E53935' },
  micBtnDisabled: { opacity: 0.4 },
  micIcon: { fontSize: 20 },
  textModeError: { backgroundColor: '#FFF3F3', borderWidth: 1, borderColor: '#FFD0D0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginHorizontal: spacing.md, marginBottom: 4 },
  textModeErrorText: { fontSize: 12, fontWeight: '600', color: '#D32F2F', textAlign: 'center' },
});

