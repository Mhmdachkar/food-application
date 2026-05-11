import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../state/AuthStore';
import { useDataStore } from '../../state/DataStore';
import { colors, spacing, radii } from '../../theme/theme';
import { Card } from '../../theme/components/Card';
import { Button } from '../../theme/components/Button';
import { EmptyState } from '../../theme/components/EmptyState';
import type { Order, OrderStatus } from '../../models/Order';

const STATUS_FILTERS: OrderStatus[] = [
  'PLACED',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELED',
];

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

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PLACED: 'ACCEPTED',
  ACCEPTED: 'PREPARING',
  PREPARING: 'READY',
  READY: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
};

export const AdminOrdersScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { orders, refreshOrders, updateOrderStatusLocalOrRemote, drivers, assignDriverLocalOrRemote } = useDataStore();
  const [selectedFilter, setSelectedFilter] = useState<OrderStatus | 'ALL'>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (user) refreshOrders(user.id, 'admin');
  }, [user, refreshOrders]);

  const filtered = selectedFilter === 'ALL'
    ? orders
    : orders.filter(o => o.status === selectedFilter);

  const renderOrder = ({ item: order }: { item: Order }) => (
    <Card style={styles.orderCard}>
      <Pressable onPress={() => setSelectedOrder(order)}>
        <View style={styles.orderHeader}>
          <View>
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
        </Text>
        {order.driverName && <Text style={styles.driverText}>Driver: {order.driverName}</Text>}
      </Pressable>
    </Card>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Orders</Text>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        <Pressable
          style={[styles.filterChip, selectedFilter === 'ALL' && styles.filterChipActive]}
          onPress={() => setSelectedFilter('ALL')}
        >
          <Text style={[styles.filterText, selectedFilter === 'ALL' && styles.filterTextActive]}>All</Text>
        </Pressable>
        {STATUS_FILTERS.map(s => (
          <Pressable
            key={s}
            style={[styles.filterChip, selectedFilter === s && styles.filterChipActive]}
            onPress={() => setSelectedFilter(s)}
          >
            <Text style={[styles.filterText, selectedFilter === s && styles.filterTextActive]}>{STATUS_LABELS[s]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={o => o.id}
        renderItem={renderOrder}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListEmptyComponent={<EmptyState title="No orders" message="No orders match the selected filter" />}
      />

      {/* Order detail modal */}
      <Modal visible={!!selectedOrder} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedOrder && (
              <ScrollView>
                <Text style={styles.modalTitle}>Order #{selectedOrder.id.slice(0, 8)}</Text>
                <Text style={styles.modalMeta}>Customer: {selectedOrder.customerName}</Text>
                <Text style={styles.modalMeta}>Status: {STATUS_LABELS[selectedOrder.status]}</Text>
                <Text style={styles.modalMeta}>Total: ${selectedOrder.total.toFixed(2)}</Text>

                <Text style={styles.sectionTitle}>Items</Text>
                {selectedOrder.items.map((ci, idx) => (
                  <Text key={idx} style={styles.itemText}>{ci.quantity}x {ci.menuItem.name} — ${(ci.menuItem.price * ci.quantity).toFixed(2)}</Text>
                ))}

                <Text style={styles.sectionTitle}>Address</Text>
                <Text style={styles.itemText}>{selectedOrder.deliveryAddress.street}, {selectedOrder.deliveryAddress.city}</Text>

                {/* Status advance button */}
                {NEXT_STATUS[selectedOrder.status] && (
                  <Button
                    title={`Advance to ${STATUS_LABELS[NEXT_STATUS[selectedOrder.status]!]}`}
                    onPress={() => {
                      updateOrderStatusLocalOrRemote(selectedOrder.id, NEXT_STATUS[selectedOrder.status]!, user?.id);
                      setSelectedOrder(null);
                    }}
                    style={{ marginTop: spacing.md }}
                  />
                )}

                {/* Assign driver button */}
                {!selectedOrder.driverId && drivers.length > 0 && (
                  <Button
                    title={`Assign ${drivers[0].name}`}
                    onPress={() => {
                      assignDriverLocalOrRemote(selectedOrder.id, drivers[0].id, drivers[0].name, user?.id);
                      setSelectedOrder(null);
                    }}
                    style={{ marginTop: spacing.sm }}
                  />
                )}

                <Button
                  title="Close"
                  onPress={() => setSelectedOrder(null)}
                  style={{ marginTop: spacing.md, backgroundColor: colors.textSecondary }}
                />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  filterRow: { maxHeight: 48, marginBottom: spacing.md },
  filterContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.button, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardBackground },
  filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  filterTextActive: { color: '#FFFFFF' },
  orderCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderId: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  orderCustomer: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  orderRight: { alignItems: 'flex-end' },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.small },
  statusText: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },
  orderTotal: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  orderMeta: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm },
  driverText: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.cardBackground, borderTopLeftRadius: radii.large, borderTopRightRadius: radii.large, padding: spacing.lg, maxHeight: '80%' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  modalMeta: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.sm },
  itemText: { fontSize: 14, color: colors.textPrimary, marginBottom: 4 },
});
