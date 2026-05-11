import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMessageStore } from '../../state/MessageStore';
import { useAuthStore } from '../../state/AuthStore';
import { colors, spacing, radii } from '../../theme/theme';
import type { Message } from '../../models/Message';

/* ──────────────────── Message Bubble ──────────────────── */

const MessageBubble: React.FC<{ msg: Message; isOwn: boolean }> = ({ msg, isOwn }) => {
  const time = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (msg.senderRole === 'system') {
    return (
      <View style={s.systemRow}>
        <View style={s.systemBubble}>
          {msg.type === 'eta_update' && <Text style={s.systemIcon}>{'\u23F0'}</Text>}
          {msg.type === 'status_update' && <Text style={s.systemIcon}>{'\uD83D\uDCE6'}</Text>}
          <Text style={s.systemText}>{msg.text}</Text>
          <Text style={s.systemTime}>{time}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.bubbleRow, isOwn ? s.bubbleRowRight : s.bubbleRowLeft]}>
      {!isOwn && (
        <View style={s.avatarSmall}>
          <Text style={s.avatarSmallText}>{msg.senderName.charAt(0)}</Text>
        </View>
      )}
      <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}>
        {!isOwn && <Text style={s.senderName}>{msg.senderName}</Text>}
        <Text style={[s.bubbleText, isOwn ? s.bubbleTextOwn : s.bubbleTextOther]}>
          {msg.text}
        </Text>
        <View style={s.bubbleMeta}>
          <Text style={[s.bubbleTime, isOwn && s.bubbleTimeOwn]}>{time}</Text>
          {isOwn && (
            <Text style={s.readReceipt}>{msg.read ? '\u2713\u2713' : '\u2713'}</Text>
          )}
        </View>
      </View>
    </View>
  );
};

/* ──────────────────── Chat Screen ──────────────────── */

interface ChatScreenProps {
  orderId: string;
  otherPartyName: string;
  otherPartyRole: 'customer' | 'driver';
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  orderId,
  otherPartyName,
  otherPartyRole,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    getThread,
    sendMessage,
    markThreadRead,
  } = useMessageStore();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const thread = getThread(orderId);
  const messages = thread?.messages ?? [];

  // Mark as read when opened
  useEffect(() => {
    if (user && orderId) {
      markThreadRead(orderId, user.id);
    }
  }, [user, orderId, messages.length, markThreadRead]);

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed || !user) return;

    sendMessage({
      orderId,
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role as 'customer' | 'driver',
      text: trimmed,
    });
    setInputText('');

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [inputText, user, orderId, sendMessage]);

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => (
      <MessageBubble msg={item} isOwn={item.senderId === user?.id} />
    ),
    [user?.id],
  );

  return (
    <KeyboardAvoidingView
      style={[s.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backIcon}>{'\u2190'}</Text>
        </Pressable>
        <View style={s.headerAvatar}>
          <Text style={s.headerAvatarText}>{otherPartyName.charAt(0)}</Text>
        </View>
        <View style={s.headerInfo}>
          <Text style={s.headerName}>{otherPartyName}</Text>
          <Text style={s.headerRole}>
            {otherPartyRole === 'driver' ? 'Your Driver' : 'Customer'}
            {' \u00B7 '}Order #{orderId.slice(0, 6)}
          </Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={renderMessage}
        contentContainerStyle={s.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={s.emptyChat}>
            <Text style={s.emptyChatEmoji}>{'\uD83D\uDCAC'}</Text>
            <Text style={s.emptyChatTitle}>Start a conversation</Text>
            <Text style={s.emptyChatDesc}>
              Messages with your {otherPartyRole} will appear here
            </Text>
          </View>
        }
      />

      {/* Input Bar */}
      <View style={[s.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={s.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={500}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <Pressable
          style={[s.sendBtn, !inputText.trim() && s.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Text style={s.sendBtnText}>{'\u2191'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

/* ──────────────────── Styles ──────────────────── */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5FA' },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 8, marginRight: 4 },
  backIcon: { fontSize: 22, color: colors.textPrimary, fontWeight: '600' },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerAvatarText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  headerRole: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },

  /* Messages List */
  messagesList: { padding: spacing.md, paddingBottom: 8 },

  /* Bubble Row */
  bubbleRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end' },
  bubbleRowLeft: { justifyContent: 'flex-start' },
  bubbleRowRight: { justifyContent: 'flex-end' },

  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  avatarSmallText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  /* Bubble */
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleOwn: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#EDEDF0',
  },
  senderName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: 2,
  },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextOwn: { color: '#FFF' },
  bubbleTextOther: { color: colors.textPrimary },

  bubbleMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, justifyContent: 'flex-end', gap: 4 },
  bubbleTime: { fontSize: 10, color: colors.textSecondary },
  bubbleTimeOwn: { color: 'rgba(255,255,255,0.7)' },
  readReceipt: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },

  /* System Message */
  systemRow: { alignItems: 'center', marginVertical: 10 },
  systemBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDEDF0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 6,
    maxWidth: '85%',
  },
  systemIcon: { fontSize: 14 },
  systemText: { fontSize: 12, color: colors.textSecondary, flex: 1 },
  systemTime: { fontSize: 10, color: colors.textTertiary },

  /* Input Bar */
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F5FA',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: colors.textPrimary,
    maxHeight: 100,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: colors.border },
  sendBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },

  /* Empty */
  emptyChat: { alignItems: 'center', paddingVertical: 60 },
  emptyChatEmoji: { fontSize: 48, marginBottom: 12 },
  emptyChatTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  emptyChatDesc: { fontSize: 14, color: colors.textSecondary, marginTop: 4, textAlign: 'center', maxWidth: 250 },
});
