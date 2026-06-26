import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useNotificationStore } from '../../state/NotificationStore';
import { useAuthStore } from '../../state/AuthStore';
import { useOrdersQuery } from '../../hooks/useOrdersQuery';
import { colors, spacing, radii } from '../../theme/theme';
import type { AppNotification } from '../../models/Notification';

const STATUS_MESSAGES: Record<string, string> = {
  PLACED: 'Your order has been placed and is waiting to be accepted.',
  ACCEPTED: 'Great news! The restaurant accepted your order.',
  PREPARING: 'Your order is being prepared in the kitchen.',
  READY: 'Your order is ready and waiting for pickup.',
  PICKED_UP: 'A driver has picked up your order.',
  OUT_FOR_DELIVERY: 'Your order is on its way to you!',
  DELIVERED: 'Your order was delivered. Enjoy your meal! 🎉',
  CANCELED: 'Your order was canceled.',
};

const ICON_MAP: Record<string, string> = {
  orderUpdate: '\uD83D\uDCE6',
  promotion: '\uD83C\uDF81',
  reminder: '\u23F0',
  system: '\u2699\uFE0F',
};

export const NotificationsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { notifications, markAsRead, markAllAsRead } = useNotificationStore();
  const { user, role } = useAuthStore();
  const { data: orders = [] } = useOrdersQuery(user?.id, role);

  /* Derive order-status notifications from real orders */
  const orderNotifications = useMemo<AppNotification[]>(() => {
    return orders.map(order => {
      const lastEvent = [...order.timeline].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )[0];
      return {
        id: `order-${order.id}`,
        title: `Order #${order.id.slice(0, 8)} — ${lastEvent?.status.replace(/_/g, ' ') ?? order.status}`,
        body: STATUS_MESSAGES[order.status] ?? `Status: ${order.status}`,
        type: 'orderUpdate' as const,
        isRead: !['PLACED', 'ACCEPTED', 'PREPARING', 'OUT_FOR_DELIVERY'].includes(order.status),
        createdAt: lastEvent?.timestamp ?? order.createdAt,
        orderId: order.id,
      };
    });
  }, [orders]);

  /* Merge store notifications + derived ones, sorted newest first */
  const allNotifications = useMemo(() => {
    const seen = new Set(notifications.map(n => n.id));
    const merged = [
      ...notifications,
      ...orderNotifications.filter(n => !seen.has(n.id)),
    ];
    return merged.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [notifications, orderNotifications]);

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const renderItem = ({ item }: { item: AppNotification }) => (
    <Pressable
      style={[s.card, !item.isRead && s.cardUnread]}
      onPress={() => {
        markAsRead(item.id);
        if (item.orderId) {
          router.push(`/customer/order/${item.orderId}` as any);
        }
      }}
    >
      <View style={[s.iconCircle, !item.isRead && s.iconCircleUnread]}>
        <Text style={s.icon}>{ICON_MAP[item.type] ?? '\uD83D\uDD14'}</Text>
      </View>
      <View style={s.body}>
        <View style={s.titleRow}>
          <Text style={[s.title, !item.isRead && s.titleUnread]} numberOfLines={1}>{item.title}</Text>
          {!item.isRead && <View style={s.dot} />}
        </View>
        <Text style={s.message} numberOfLines={2}>{item.body}</Text>
        <Text style={s.time}>{timeAgo(item.createdAt)}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={s.backBtn}>{'\u2190'}</Text>
        </Pressable>
        <Text style={s.headerTitle}>Notifications</Text>
        <Pressable onPress={markAllAsRead}>
          <Text style={s.markAll}>Read all</Text>
        </Pressable>
      </View>
      <FlatList
        data={allNotifications}
        keyExtractor={n => n.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>{'\uD83D\uDD14'}</Text>
            <Text style={s.emptyText}>No notifications yet</Text>
          </View>
        }
      />
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  backBtn: { fontSize: 24, color: colors.textPrimary },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  markAll: { fontSize: 13, fontWeight: '600', color: colors.accent },
  card: { flexDirection: 'row', backgroundColor: colors.cardBackground, borderRadius: radii.medium, padding: spacing.md, marginBottom: spacing.sm },
  cardUnread: { backgroundColor: '#FFF8E1', borderLeftWidth: 3, borderLeftColor: colors.accent },
  iconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  iconCircleUnread: { backgroundColor: colors.accent + '15' },
  icon: { fontSize: 20 },
  body: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  titleUnread: { fontWeight: '800' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginLeft: 6 },
  message: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  time: { fontSize: 11, color: colors.textSecondary, marginTop: 6 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: 16, color: colors.textSecondary },
});
