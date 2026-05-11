import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessageStore } from '../../state/MessageStore';
import { colors } from '../../theme/theme';
import type { ChatThread } from '../../models/Message';

const ROLE_ICON: Record<string, string> = {
  customer: '\uD83D\uDC64',
  driver: '\uD83D\uDE97',
  admin: '\uD83D\uDC51',
  system: '\u2699\uFE0F',
};

/* ── Thread Detail Modal ── */
const ThreadDetailModal: React.FC<{
  visible: boolean;
  thread: ChatThread | null;
  onClose: () => void;
}> = ({ visible, thread, onClose }) => {
  if (!thread) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <Pressable style={s.modalSheet} onPress={e => e.stopPropagation()}>
          <View style={s.modalHandle} />
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>
              {thread.customerName} {'\u2194\uFE0F'} {thread.driverName}
            </Text>
            <Text style={s.modalSub}>
              Order #{thread.orderId.slice(0, 6)} {'\u00B7'} {thread.messages.length} messages
            </Text>
          </View>

          <ScrollView style={s.messagesScroll} showsVerticalScrollIndicator={false}>
            {thread.messages.map(msg => {
              const isSystem = msg.senderRole === 'system';
              const time = new Date(msg.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              if (isSystem) {
                return (
                  <View key={msg.id} style={s.systemMsg}>
                    <Text style={s.systemMsgText}>{msg.text}</Text>
                    <Text style={s.systemMsgTime}>{time}</Text>
                  </View>
                );
              }

              return (
                <View key={msg.id} style={s.msgRow}>
                  <View style={[s.msgRoleIcon, {
                    backgroundColor: msg.senderRole === 'customer' ? '#4A90D9' + '20' : '#20C997' + '20',
                  }]}>
                    <Text style={s.msgRoleEmoji}>{ROLE_ICON[msg.senderRole] ?? '\uD83D\uDCAC'}</Text>
                  </View>
                  <View style={s.msgContent}>
                    <View style={s.msgHeaderRow}>
                      <Text style={s.msgSender}>{msg.senderName}</Text>
                      <Text style={s.msgTime}>{time}</Text>
                    </View>
                    <Text style={s.msgText}>{msg.text}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <Pressable style={s.closeModalBtn} onPress={onClose}>
            <Text style={s.closeModalText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

/* ──────────────────────────── Main Screen ──────────────────────────── */

export const AdminMessagesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { threads, ratings, deliveryProofs } = useMessageStore();
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null);

  const allThreads = useMemo(() =>
    Object.values(threads).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    ),
  [threads]);

  const totalMessages = useMemo(
    () => allThreads.reduce((sum, t) => sum + t.messages.length, 0),
    [allThreads],
  );

  const totalRatings = ratings.length;
  const avgRating = totalRatings > 0
    ? (ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings).toFixed(1)
    : '—';
  const totalProofs = Object.keys(deliveryProofs).length;

  const renderThread = ({ item }: { item: ChatThread }) => {
    const lastMsg = item.lastMessage;
    const timeStr = lastMsg
      ? new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    const hasUnread = item.unreadCount > 0;

    return (
      <Pressable
        style={({ pressed }) => [s.threadCard, pressed && { transform: [{ scale: 0.98 }] }]}
        onPress={() => setSelectedThread(item)}
      >
        <View style={s.threadLeft}>
          <View style={s.threadAvatars}>
            <View style={[s.threadAvSmall, { backgroundColor: '#4A90D9' }]}>
              <Text style={s.threadAvText}>{item.customerName.charAt(0)}</Text>
            </View>
            <View style={[s.threadAvSmall, s.threadAvOverlap, { backgroundColor: '#20C997' }]}>
              <Text style={s.threadAvText}>{item.driverName.charAt(0)}</Text>
            </View>
          </View>
        </View>
        <View style={s.threadCenter}>
          <View style={s.threadNameRow}>
            <Text style={s.threadNames} numberOfLines={1}>
              {item.customerName} {'\u2194\uFE0F'} {item.driverName}
            </Text>
            {hasUnread && (
              <View style={s.unreadDot} />
            )}
          </View>
          <Text style={s.threadOrder}>Order #{item.orderId.slice(0, 6)}</Text>
          {lastMsg && (
            <Text style={s.threadPreview} numberOfLines={1}>
              {lastMsg.senderRole === 'system' ? '\u2699\uFE0F ' : ''}{lastMsg.text}
            </Text>
          )}
        </View>
        <View style={s.threadRight}>
          <Text style={s.threadTime}>{timeStr}</Text>
          <Text style={s.threadCount}>{item.messages.length} msgs</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Messages</Text>
        <Text style={s.subtitle}>Communication overview</Text>
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statIcon}>{'\uD83D\uDCAC'}</Text>
          <Text style={s.statNum}>{totalMessages}</Text>
          <Text style={s.statLabel}>Messages</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statIcon}>{'\uD83D\uDDE3\uFE0F'}</Text>
          <Text style={s.statNum}>{allThreads.length}</Text>
          <Text style={s.statLabel}>Threads</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statIcon}>{'\u2B50'}</Text>
          <Text style={s.statNum}>{avgRating}</Text>
          <Text style={s.statLabel}>{totalRatings} Ratings</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statIcon}>{'\uD83D\uDCF7'}</Text>
          <Text style={s.statNum}>{totalProofs}</Text>
          <Text style={s.statLabel}>Proofs</Text>
        </View>
      </View>

      {/* Ratings summary */}
      {totalRatings > 0 && (
        <View style={s.ratingsCard}>
          <Text style={s.ratingsTitle}>{'\u2B50'} Rating Distribution</Text>
          {[5, 4, 3, 2, 1].map(star => {
            const count = ratings.filter(r => r.rating === star).length;
            const pct = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
            return (
              <View key={star} style={s.ratingRow}>
                <Text style={s.ratingLabel}>{star}{'\u2B50'}</Text>
                <View style={s.ratingBarBg}>
                  <View style={[s.ratingBarFill, { width: `${pct}%` }]} />
                </View>
                <Text style={s.ratingCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Thread list */}
      <Text style={s.sectionTitle}>Chat Threads</Text>
      <FlatList
        data={allThreads}
        keyExtractor={item => item.orderId}
        renderItem={renderThread}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={{ fontSize: 40 }}>{'\uD83D\uDCAC'}</Text>
            <Text style={s.emptyTitle}>No conversations yet</Text>
            <Text style={s.emptyDesc}>Chat threads will appear here when customers and drivers communicate</Text>
          </View>
        }
      />

      <ThreadDetailModal
        visible={!!selectedThread}
        thread={selectedThread}
        onClose={() => setSelectedThread(null)}
      />
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFBFE' },

  /* Header */
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  title: { fontSize: 28, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  /* Stats */
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginTop: 14, marginBottom: 14 },
  statCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 12, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statNum: { fontSize: 20, fontWeight: '900', color: colors.textPrimary },
  statLabel: { fontSize: 10, color: colors.textSecondary, marginTop: 2, fontWeight: '600' },

  /* Ratings */
  ratingsCard: {
    marginHorizontal: 20, marginBottom: 16, backgroundColor: '#FFF', borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  ratingsTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  ratingLabel: { width: 36, fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  ratingBarBg: { flex: 1, height: 6, backgroundColor: '#F0F0F5', borderRadius: 3, marginHorizontal: 8, overflow: 'hidden' },
  ratingBarFill: { height: 6, borderRadius: 3, backgroundColor: '#F59E0B' },
  ratingCount: { width: 24, fontSize: 12, fontWeight: '700', color: colors.textPrimary, textAlign: 'right' },

  /* Section */
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, paddingHorizontal: 20, marginBottom: 10 },

  /* Thread List */
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  threadCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 18, padding: 14,
    marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  threadLeft: { marginRight: 12 },
  threadAvatars: { flexDirection: 'row', width: 52 },
  threadAvSmall: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  threadAvOverlap: { marginLeft: -16, borderWidth: 2, borderColor: '#FFF' },
  threadAvText: { fontSize: 14, fontWeight: '800', color: '#FFF' },
  threadCenter: { flex: 1 },
  threadNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  threadNames: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  threadOrder: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  threadPreview: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  threadRight: { alignItems: 'flex-end', marginLeft: 8 },
  threadTime: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  threadCount: { fontSize: 10, color: colors.textTertiary, marginTop: 2, fontWeight: '600' },

  /* Empty */
  emptyBox: { padding: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginTop: 12 },
  emptyDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 4, textAlign: 'center', lineHeight: 18 },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40, maxHeight: '85%',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalHeader: { marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: colors.textPrimary },
  modalSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  messagesScroll: { maxHeight: 400 },

  /* Messages in modal */
  systemMsg: {
    alignSelf: 'center', backgroundColor: '#F5F5FA', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, maxWidth: '80%',
  },
  systemMsgText: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  systemMsgTime: { fontSize: 10, color: colors.textTertiary, textAlign: 'center', marginTop: 2 },

  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' },
  msgRoleIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginTop: 2 },
  msgRoleEmoji: { fontSize: 14 },
  msgContent: { flex: 1, backgroundColor: '#F5F5FA', borderRadius: 14, padding: 10 },
  msgHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  msgSender: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  msgTime: { fontSize: 10, color: colors.textTertiary },
  msgText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },

  closeModalBtn: {
    backgroundColor: '#F5F5FA', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 16,
  },
  closeModalText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
});
