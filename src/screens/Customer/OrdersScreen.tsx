import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../state/AuthStore';
import { useOrdersQuery } from '../../hooks/useOrdersQuery';
import { OrderCardSkeletonList } from '../../components/skeletons/OrderCardSkeleton';
import { useFeedbackStore } from '../../state/FeedbackStore';
import { colors, spacing, radii } from '../../theme/theme';
import { Card } from '../../theme/components/Card';
import { EmptyState } from '../../theme/components/EmptyState';
import type { Order, OrderStatus } from '../../models/Order';

const STATUS_COLORS: Record<OrderStatus, string> = {
  PLACED: colors.accent,
  ACCEPTED: colors.success,
  PREPARING: colors.warning,
  READY: colors.success,
  PICKED_UP: '#20C997',
  OUT_FOR_DELIVERY: colors.accent,
  DELIVERED: colors.success,
  CANCELED: colors.danger,
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  PLACED: 'Placed',
  ACCEPTED: 'Accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
  PICKED_UP: 'Picked Up',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELED: 'Canceled',
};

/* ── OrderCard: extracted as a proper component so useState is valid ── */
const OrderCard = React.memo<{
  order: Order;
  getFeedbackForOrder: (orderId: string) => any;
  router: ReturnType<typeof useRouter>;
}>(({ order, getFeedbackForOrder, router }) => {
  const [expanded, setExpanded] = React.useState(false);

  const sortedTimeline = [...order.timeline].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return (
    <Card style={styles.orderCard}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderId}>Order #{order.id.slice(0, 8)}</Text>
            <Text style={styles.orderDate}>
              {new Date(order.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.orderHeaderRight}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: STATUS_COLORS[order.status] },
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {STATUS_LABELS[order.status]}
              </Text>
            </View>
            <Text style={styles.orderTotal}>${order.total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Item summary */}
        <Text style={styles.itemCount} numberOfLines={1}>
          {order.items.map(i => `${i.quantity}x ${i.menuItem.name}`).join(', ')}
        </Text>

        {/* Driver info */}
        {order.driverName && (
          <View style={styles.driverRow}>
            <Ionicons name="bicycle-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.driverInfo}>{order.driverName}</Text>
          </View>
        )}

        {/* Expand indicator */}
        <View style={styles.expandRow}>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.accent} />
          <Text style={styles.expandText}>
            {expanded ? 'Hide Details' : 'Show Details'}
          </Text>
        </View>
      </Pressable>

      {/* Expanded section */}
      {expanded && (
        <View style={styles.expandedSection}>
          {/* Order items */}
          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>Items</Text>
            {order.items.map((item, idx) => (
              <View key={idx} style={styles.orderItem}>
                <Text style={styles.orderItemName}>
                  {item.quantity}x {item.menuItem.name}
                </Text>
                <Text style={styles.orderItemPrice}>
                  ${(item.menuItem.price * item.quantity).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>

          {/* Delivery address */}
          <View style={styles.addressSection}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <Text style={styles.addressText}>
              {order.deliveryAddress.street}
            </Text>
            <Text style={styles.addressText}>
              {order.deliveryAddress.city}, {order.deliveryAddress.state}{' '}
              {order.deliveryAddress.zip}
            </Text>
            {order.deliveryNotes && (
              <Text style={styles.deliveryNotes}>
                Note: {order.deliveryNotes}
              </Text>
            )}
          </View>

          {/* Timeline */}
          <View style={styles.timelineSection}>
            <Text style={styles.sectionTitle}>Order Timeline</Text>
            <View style={styles.timeline}>
              {sortedTimeline.map((event, index) => {
                const isLast = index === sortedTimeline.length - 1;
                const date = new Date(event.timestamp);
                const timeStr = date.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <View key={event.id} style={styles.timelineEvent}>
                    <View style={styles.timelineLeft}>
                      <View
                        style={[
                          styles.timelineDot,
                          { backgroundColor: STATUS_COLORS[event.status] },
                        ]}
                      />
                      {!isLast && <View style={styles.timelineLine} />}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineStatus}>
                        {STATUS_LABELS[event.status]}
                      </Text>
                      <Text style={styles.timelineTime}>{timeStr}</Text>
                      {event.note && (
                        <Text style={styles.timelineNote}>{event.note}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Feedback & Report buttons for delivered orders */}
          {order.status === 'DELIVERED' && (
            <View style={styles.feedbackRow}>
              {getFeedbackForOrder(order.id) ? (
                <View style={styles.feedbackDone}>
                  <Text style={styles.feedbackDoneIcon}>{"\u2705"}</Text>
                  <Text style={styles.feedbackDoneText}>Feedback submitted</Text>
                </View>
              ) : (
                <Pressable
                  style={styles.feedbackBtn}
                  onPress={() => router.push({ pathname: '/customer/feedback' as any, params: { orderId: order.id } })}
                >
                  <Text style={styles.feedbackBtnIcon}>{"\u2B50"}</Text>
                  <Text style={styles.feedbackBtnText}>Rate Order</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.reportBtn}
                onPress={() => router.push({ pathname: '/customer/report' as any, params: { orderId: order.id } })}
              >
                <Text style={styles.reportBtnIcon}>{"\u26A0\uFE0F"}</Text>
                <Text style={styles.reportBtnText}>Report Issue</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </Card>
  );
});

const ACTIVE_STATUSES: OrderStatus[] = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'OUT_FOR_DELIVERY'];

export const OrdersScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, role } = useAuthStore();
  const { data: allOrders = [], isLoading, refetch } = useOrdersQuery(user?.id, role);
  const { getFeedbackForOrder, load: loadFeedback, isLoaded: feedbackLoaded } = useFeedbackStore();
  const [tab, setTab] = useState<'active' | 'past'>('active');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!feedbackLoaded) loadFeedback();
  }, [feedbackLoaded, loadFeedback]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const customerOrders =
    user && role === 'customer'
      ? allOrders.filter(o => o.customerId === user.id)
      : allOrders;

  const activeOrders = useMemo(() => customerOrders.filter(o => ACTIVE_STATUSES.includes(o.status)), [customerOrders]);
  const pastOrders = useMemo(() => customerOrders.filter(o => !ACTIVE_STATUSES.includes(o.status)), [customerOrders]);
  const displayedOrders = tab === 'active' ? activeOrders : pastOrders;

  if (isLoading && allOrders.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>My Orders</Text>
        </View>
        <OrderCardSkeletonList count={5} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>My Orders</Text>
        <Text style={styles.orderCountLabel}>{customerOrders.length} total</Text>
      </View>

      {/* Tab Filter */}
      <View style={styles.tabRow}>
        <Pressable style={[styles.tabBtn, tab === 'active' && styles.tabBtnActive]} onPress={() => setTab('active')}>
          <Text style={[styles.tabBtnText, tab === 'active' && styles.tabBtnTextActive]}>Active ({activeOrders.length})</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === 'past' && styles.tabBtnActive]} onPress={() => setTab('past')}>
          <Text style={[styles.tabBtnText, tab === 'past' && styles.tabBtnTextActive]}>Past ({pastOrders.length})</Text>
        </Pressable>
      </View>

      {displayedOrders.length === 0 ? (
        <EmptyState
          title={tab === 'active' ? 'No active orders' : 'No past orders'}
          message={tab === 'active' ? 'Place an order to see it here' : 'Your order history will appear here'}
        />
      ) : (
        <FlatList
          data={displayedOrders}
          keyExtractor={order => order.id}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              getFeedbackForOrder={getFeedbackForOrder}
              router={router}
            />
          )}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  orderCountLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: '#EEEEEE',
    borderRadius: radii.small,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radii.small - 2,
  },
  tabBtnActive: {
    backgroundColor: colors.cardBackground,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabBtnTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  orderCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  orderDate: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  orderHeaderRight: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.small,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  itemCount: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  driverInfo: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  expandText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  expandedSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  itemsSection: {
    marginBottom: spacing.md,
  },
  orderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  orderItemName: {
    fontSize: 13,
    color: colors.textPrimary,
    flex: 1,
  },
  orderItemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  addressSection: {
    marginBottom: spacing.md,
  },
  addressText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  deliveryNotes: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  timelineSection: {
    marginBottom: spacing.sm,
  },
  timeline: {
    marginLeft: spacing.xs,
  },
  timelineEvent: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  timelineLeft: {
    width: 20,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: spacing.xs,
  },
  timelineStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  timelineTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  timelineNote: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  feedbackDone: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success + '10',
    borderRadius: radii.small,
    paddingVertical: 10,
  },
  feedbackDoneIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  feedbackDoneText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
  feedbackBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.small,
    paddingVertical: 10,
  },
  feedbackBtnIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  feedbackBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.danger + '10',
    borderRadius: radii.small,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.danger + '30',
  },
  reportBtnIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },
  reportBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger,
  },
});
