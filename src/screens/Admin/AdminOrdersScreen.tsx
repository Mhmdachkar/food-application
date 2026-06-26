import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../state/AuthStore';
import { useOrdersQuery } from '../../hooks/useOrdersQuery';
import { useDriversQuery } from '../../hooks/useDriversQuery';
import { orderService } from '../../services/OrderService';
import { ORDERS_QUERY_KEY } from '../../hooks/useOrdersQuery';
import { colors, spacing, radii } from '../../theme/theme';
import { Card } from '../../theme/components/Card';
import { EmptyState } from '../../theme/components/EmptyState';
import type { Order, OrderStatus } from '../../models/Order';

const STATUS_FILTERS: (OrderStatus | 'ALL')[] = [
  'ALL', 'PLACED', 'ACCEPTED', 'PREPARING', 'READY',
  'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELED',
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  PLACED: 'Placed', ACCEPTED: 'Accepted', PREPARING: 'Preparing', READY: 'Ready',
  PICKED_UP: 'Picked Up', OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered', CANCELED: 'Canceled',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  PLACED: '#4A90D9', ACCEPTED: '#845EF7', PREPARING: '#F59E0B', READY: '#10B981',
  PICKED_UP: '#20C997', OUT_FOR_DELIVERY: colors.accent,
  DELIVERED: colors.success, CANCELED: colors.danger,
};

/* Admin advances orders to the NEXT logical status.
 * READY → OUT_FOR_DELIVERY is intentionally skipped here — the driver
 * handles READY → PICKED_UP → OUT_FOR_DELIVERY via the driver app. */
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PLACED: 'ACCEPTED',
  ACCEPTED: 'PREPARING',
  PREPARING: 'READY',
};

const ADVANCE_LABEL: Partial<Record<OrderStatus, string>> = {
  PLACED: 'Accept Order',
  ACCEPTED: 'Start Preparing',
  PREPARING: 'Mark Ready for Pickup',
};

export const AdminOrdersScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  /* Poll every 20 s so new PLACED orders appear automatically */
  const { data: orders = [], isLoading } = useOrdersQuery(user?.id, 'admin', {
    refetchInterval: 60_000,
  });
  const { data: drivers = [] } = useDriversQuery(true);

  const [selectedFilter, setSelectedFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [mutating, setMutating] = useState(false);

  const filtered = selectedFilter === 'ALL'
    ? orders
    : orders.filter(o => o.status === selectedFilter);

  /* Counts badge for each filter */
  const countFor = (f: OrderStatus | 'ALL') =>
    f === 'ALL' ? orders.length : orders.filter(o => o.status === f).length;

  /* ── Mutations ── */
  const handleAdvance = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next || !user || mutating) return;
    setMutating(true);
    try {
      const ok = await orderService.updateStatus(order.id, next, user.id);
      if (ok) {
        queryClient.invalidateQueries({ queryKey: [...ORDERS_QUERY_KEY] });
        setSelectedOrder(null);
      } else {
        Alert.alert('Error', 'Could not advance order status. Please try again.');
      }
    } finally {
      setMutating(false);
    }
  };

  const handleCancel = async (order: Order) => {
    if (!user || mutating) return;
    Alert.alert(
      'Cancel Order',
      `Cancel order #${order.id.slice(0, 6)} for ${order.customerName}?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Order',
          style: 'destructive',
          onPress: async () => {
            setMutating(true);
            try {
              const ok = await orderService.updateStatus(order.id, 'CANCELED', user.id, 'Canceled by admin');
              if (ok) {
                queryClient.invalidateQueries({ queryKey: [...ORDERS_QUERY_KEY] });
                setSelectedOrder(null);
              }
            } finally {
              setMutating(false);
            }
          },
        },
      ],
    );
  };

  const handleAssignDriver = async (order: Order, driverId: string, driverName: string) => {
    if (!user || mutating) return;
    setMutating(true);
    try {
      const ok = await orderService.assignDriver(order.id, driverId, user.id);
      if (ok) {
        queryClient.invalidateQueries({ queryKey: [...ORDERS_QUERY_KEY] });
        setSelectedOrder(null);
      } else {
        Alert.alert('Error', 'Could not assign driver. They may already have an active order.');
      }
    } finally {
      setMutating(false);
    }
  };

  const renderOrder = ({ item: order }: { item: Order }) => (
    <Card style={styles.orderCard}>
      <Pressable onPress={() => setSelectedOrder(order)}>
        <View style={styles.orderHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderId}>#{order.id.slice(0, 8)}</Text>
            <Text style={styles.orderCustomer}>{order.customerName}</Text>
          </View>
          <View style={styles.orderRight}>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[order.status] }]}>
              <Text style={styles.statusText}>{STATUS_LABELS[order.status]}</Text>
            </View>
            <Text style={styles.orderTotal}>${order.total.toFixed(2)}</Text>
          </View>
        </View>
        <Text style={styles.orderMeta}>
          {order.items.length} item{order.items.length !== 1 ? 's' : ''} · {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {order.deliveryMethod === 'pickup' ? ' · Pickup' : ''}
        </Text>
        {order.driverName && <Text style={styles.driverText}>Driver: {order.driverName}</Text>}
        {/* Tap-to-advance hint for actionable statuses */}
        {NEXT_STATUS[order.status] && (
          <Text style={styles.advanceHint}>{ADVANCE_LABEL[order.status]} →</Text>
        )}
      </Pressable>
    </Card>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Orders</Text>
        {isLoading && <ActivityIndicator color={colors.accent} style={{ marginRight: spacing.lg }} />}
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        {STATUS_FILTERS.map(f => {
          const cnt = countFor(f);
          if (f !== 'ALL' && cnt === 0) return null;
          return (
            <Pressable
              key={f}
              style={[styles.filterChip, selectedFilter === f && styles.filterChipActive]}
              onPress={() => setSelectedFilter(f)}
            >
              <Text style={[styles.filterText, selectedFilter === f && styles.filterTextActive]}>
                {f === 'ALL' ? 'All' : STATUS_LABELS[f as OrderStatus]} {cnt > 0 ? `(${cnt})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={o => o.id}
        renderItem={renderOrder}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListEmptyComponent={<EmptyState title="No orders" message="No orders match the selected filter" />}
      />

      {/* Order detail bottom sheet */}
      <Modal visible={!!selectedOrder} animationType="slide" transparent>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedOrder(null)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            {selectedOrder && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>#{selectedOrder.id.slice(0, 8)}</Text>
                    <Text style={styles.modalMeta}>{selectedOrder.customerName}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[selectedOrder.status] }]}>
                    <Text style={styles.statusText}>{STATUS_LABELS[selectedOrder.status]}</Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaItem}>${selectedOrder.total.toFixed(2)} total</Text>
                  <Text style={styles.metaItem}>{selectedOrder.deliveryMethod === 'pickup' ? 'Pickup' : 'Delivery'}</Text>
                  <Text style={styles.metaItem}>{new Date(selectedOrder.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                </View>

                {/* Items */}
                <Text style={styles.sectionTitle}>Items</Text>
                {selectedOrder.items.map((ci, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemQty}>{ci.quantity}x</Text>
                    <Text style={styles.itemName}>{ci.menuItem.name}</Text>
                    <Text style={styles.itemPrice}>${(ci.menuItem.price * ci.quantity).toFixed(2)}</Text>
                  </View>
                ))}

                {/* Address */}
                {selectedOrder.deliveryMethod !== 'pickup' && (
                  <>
                    <Text style={styles.sectionTitle}>Delivery Address</Text>
                    <Text style={styles.addressText}>
                      {selectedOrder.deliveryAddress.street}, {selectedOrder.deliveryAddress.city}{'\n'}
                      {selectedOrder.deliveryAddress.state} {selectedOrder.deliveryAddress.zip}
                    </Text>
                  </>
                )}

                {/* Driver assignment */}
                {selectedOrder.driverId ? (
                  <View style={styles.driverAssignedRow}>
                    <Text style={styles.driverAssignedIcon}>{'\uD83D\uDE97'}</Text>
                    <Text style={styles.driverAssignedText}>Driver: {selectedOrder.driverName}</Text>
                  </View>
                ) : selectedOrder.status === 'READY' && drivers.length > 0 ? (
                  <>
                    <Text style={styles.sectionTitle}>Assign Driver</Text>
                    {drivers.map(d => (
                      <Pressable
                        key={d.id}
                        style={styles.assignDriverBtn}
                        onPress={() => handleAssignDriver(selectedOrder, d.id, d.name)}
                        disabled={mutating}
                      >
                        <Text style={styles.assignDriverAvatar}>{d.name.charAt(0)}</Text>
                        <Text style={styles.assignDriverName}>{d.name}</Text>
                        <Text style={styles.assignDriverArrow}>{'\u2192'}</Text>
                      </Pressable>
                    ))}
                  </>
                ) : null}

                {/* Status advance */}
                {NEXT_STATUS[selectedOrder.status] && (
                  <Pressable
                    style={[styles.advanceBtn, mutating && { opacity: 0.6 }]}
                    onPress={() => handleAdvance(selectedOrder)}
                    disabled={mutating}
                  >
                    {mutating
                      ? <ActivityIndicator color="#FFF" />
                      : <Text style={styles.advanceBtnText}>{'\u2705'} {ADVANCE_LABEL[selectedOrder.status]}</Text>
                    }
                  </Pressable>
                )}

                {/* Cancel */}
                {!['DELIVERED', 'CANCELED'].includes(selectedOrder.status) && (
                  <Pressable
                    style={[styles.cancelBtn, mutating && { opacity: 0.6 }]}
                    onPress={() => handleCancel(selectedOrder)}
                    disabled={mutating}
                  >
                    <Text style={styles.cancelBtnText}>Cancel Order</Text>
                  </Pressable>
                )}

                <Pressable style={styles.closeBtn} onPress={() => setSelectedOrder(null)}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </Pressable>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  filterRow: { maxHeight: 48, marginBottom: spacing.md },
  filterContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.button, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardBackground },
  filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  filterTextActive: { color: '#FFFFFF' },

  orderCard: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.md },
  orderHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  orderId: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  orderCustomer: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  orderRight: { alignItems: 'flex-end', gap: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  orderTotal: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  orderMeta: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm },
  driverText: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  advanceHint: { fontSize: 12, fontWeight: '700', color: colors.accent, marginTop: 6 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '88%' },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  modalMeta: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  metaItem: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', backgroundColor: '#F5F5FA', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F0F0F5' },
  itemQty: { fontSize: 14, fontWeight: '700', color: colors.accent, width: 28 },
  itemName: { flex: 1, fontSize: 14, color: colors.textPrimary },
  itemPrice: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  addressText: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  driverAssignedRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', padding: 12, borderRadius: 12, marginTop: 12 },
  driverAssignedIcon: { fontSize: 20, marginRight: 10 },
  driverAssignedText: { fontSize: 14, fontWeight: '700', color: '#065F46' },
  assignDriverBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5FA', padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#EDEDF0' },
  assignDriverAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#20C997', textAlign: 'center', lineHeight: 32, fontSize: 14, fontWeight: '800', color: '#FFF', marginRight: 12, overflow: 'hidden' },
  assignDriverName: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  assignDriverArrow: { fontSize: 18, color: colors.textSecondary },
  advanceBtn: { backgroundColor: '#10B981', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 20, shadowColor: '#10B981', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  advanceBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  cancelBtn: { backgroundColor: '#FEF2F2', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#FECACA' },
  cancelBtnText: { color: '#DC2626', fontSize: 15, fontWeight: '700' },
  closeBtn: { backgroundColor: '#F5F5FA', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 10, marginBottom: 4 },
  closeBtnText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
});
