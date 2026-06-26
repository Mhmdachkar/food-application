import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../state/AuthStore';
import { useOrdersQuery, ORDERS_QUERY_KEY } from '../../hooks/useOrdersQuery';
import { useDriversQuery } from '../../hooks/useDriversQuery';
import { orderService } from '../../services/OrderService';
import { colors, spacing, radii } from '../../theme/theme';
import { Card } from '../../theme/components/Card';
import { SectionHeader } from '../../theme/components/SectionHeader';
import type { Order } from '../../models/Order';
import type { AppUser } from '../../models/AppUser';

export const AdminDispatchScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  /* Poll every 15 s — admins need near-real-time dispatch */
  const { data: orders = [], isLoading: ordersLoading } = useOrdersQuery(user?.id, 'admin', {
    refetchInterval: 60_000,
  });
  const { data: drivers = [], isLoading: driversLoading } = useDriversQuery(true);
  const [assigning, setAssigning] = useState<string | null>(null);

  /* READY orders without a driver can be push-assigned.
   * Also show ACCEPTED/PREPARING so admin can pre-assign before food is ready. */
  const unassigned = orders.filter(
    o => ['ACCEPTED', 'PREPARING', 'READY'].includes(o.status) && !o.driverId,
  );
  const inTransit = orders.filter(
    o => ['PICKED_UP', 'OUT_FOR_DELIVERY'].includes(o.status),
  );

  const handleAssign = async (order: Order, driver: AppUser) => {
    if (assigning || !user) return;
    setAssigning(`${order.id}-${driver.id}`);
    try {
      const ok = await orderService.assignDriver(order.id, driver.id, user.id);
      if (ok) {
        queryClient.invalidateQueries({ queryKey: [...ORDERS_QUERY_KEY] });
      } else {
        Alert.alert('Assignment failed', 'Could not assign driver. They may already have an active order.');
      }
    } finally {
      setAssigning(null);
    }
  };

  const isLoading = ordersLoading || driversLoading;

  const renderUnassigned = ({ item: order }: { item: Order }) => (
    <Card style={styles.orderCard}>
      <View style={styles.orderTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderId}>#{order.id.slice(0, 8)}</Text>
          <Text style={styles.orderMeta}>
            {order.customerName} · {order.items.length} item(s) · ${order.total.toFixed(2)}
          </Text>
          <Text style={styles.addressText}>
            {order.deliveryAddress.street}, {order.deliveryAddress.city}
          </Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: statusColor(order.status) + '20' }]}>
          <Text style={[styles.statusPillText, { color: statusColor(order.status) }]}>
            {order.status}
          </Text>
        </View>
      </View>

      {drivers.length > 0 ? (
        <View style={styles.driverList}>
          {drivers.map(driver => {
            const key = `${order.id}-${driver.id}`;
            const busy = assigning === key;
            return (
              <Pressable
                key={driver.id}
                style={[styles.assignBtn, busy && { opacity: 0.6 }]}
                onPress={() => handleAssign(order, driver)}
                disabled={!!assigning}
              >
                <View style={styles.assignBtnAvatar}>
                  <Text style={styles.assignBtnAvatarText}>{driver.name.charAt(0)}</Text>
                </View>
                {busy
                  ? <ActivityIndicator size="small" color={colors.accent} style={{ flex: 1 }} />
                  : <Text style={styles.assignBtnName}>{driver.name}</Text>
                }
                <Text style={styles.assignBtnArrow}>{'\u2192'}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.noDriverRow}>
          <Text style={styles.noDriverText}>{'\uD83D\uDE94'} No drivers online right now</Text>
        </View>
      )}
    </Card>
  );

  const renderInTransit = ({ item: order }: { item: Order }) => (
    <Card style={styles.orderCard}>
      <View style={styles.transitRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderId}>#{order.id.slice(0, 8)}</Text>
          <Text style={styles.orderMeta}>{order.customerName}</Text>
          <Text style={styles.addressText}>
            {order.deliveryAddress.street}, {order.deliveryAddress.city}
          </Text>
        </View>
        <View style={styles.driverBadge}>
          <Text style={styles.driverBadgeIcon}>{'\uD83D\uDE97'}</Text>
          <Text style={styles.driverBadgeName}>{order.driverName ?? 'Driver'}</Text>
        </View>
      </View>
      <View style={[styles.statusPill, { backgroundColor: statusColor(order.status) + '20', alignSelf: 'flex-start', marginTop: 8 }]}>
        <Text style={[styles.statusPillText, { color: statusColor(order.status) }]}>
          {order.status.replace(/_/g, ' ')}
        </Text>
      </View>
    </Card>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.titleRow}>
        <Text style={styles.title}>Dispatch</Text>
        {isLoading && <ActivityIndicator color={colors.accent} style={{ marginRight: spacing.lg }} />}
      </View>

      {/* Stats strip */}
      <View style={styles.statsStrip}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{drivers.length}</Text>
          <Text style={styles.statLabel}>Online Drivers</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, unassigned.length > 0 && { color: '#F59E0B' }]}>
            {unassigned.length}
          </Text>
          <Text style={styles.statLabel}>Need Driver</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#10B981' }]}>{inTransit.length}</Text>
          <Text style={styles.statLabel}>In Transit</Text>
        </View>
      </View>

      <FlatList
        data={[...unassigned.map(o => ({ ...o, _section: 'unassigned' })), ...inTransit.map(o => ({ ...o, _section: 'transit' }))]}
        keyExtractor={o => o.id}
        renderItem={({ item }) =>
          (item as any)._section === 'unassigned'
            ? renderUnassigned({ item })
            : renderInTransit({ item })
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {unassigned.length > 0 && (
              <View style={styles.sectionHeaderWrap}>
                <SectionHeader title={`Needs Driver (${unassigned.length})`} />
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={{ fontSize: 48 }}>{'\uD83D\uDCEB'}</Text>
            <Text style={styles.emptyTitle}>All clear</Text>
            <Text style={styles.emptyDesc}>No orders need attention right now</Text>
          </View>
        }
      />
    </View>
  );
};

function statusColor(status: string): string {
  const map: Record<string, string> = {
    ACCEPTED: '#845EF7', PREPARING: '#F59E0B', READY: '#10B981',
    PICKED_UP: '#20C997', OUT_FOR_DELIVERY: colors.accent,
  };
  return map[status] ?? colors.accent;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  statsStrip: { flexDirection: 'row', marginHorizontal: spacing.lg, backgroundColor: '#FFF', borderRadius: 18, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2, borderWidth: 1, borderColor: '#F0F0F5' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '900', color: colors.textPrimary },
  statLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: '#F0F0F5' },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  sectionHeaderWrap: { marginBottom: 4 },
  orderCard: { marginBottom: spacing.sm, padding: spacing.md },
  orderTopRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  orderId: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  orderMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  addressText: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusPillText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  driverList: { gap: 8 },
  assignBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5FA', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#EDEDF0' },
  assignBtnAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#20C997', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  assignBtnAvatarText: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  assignBtnName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  assignBtnArrow: { fontSize: 18, color: colors.textSecondary },
  noDriverRow: { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 12, alignItems: 'center' },
  noDriverText: { fontSize: 13, color: '#92400E', fontWeight: '600' },
  transitRow: { flexDirection: 'row', alignItems: 'flex-start' },
  driverBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, gap: 6 },
  driverBadgeIcon: { fontSize: 14 },
  driverBadgeName: { fontSize: 13, fontWeight: '700', color: '#065F46' },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 12 },
  emptyDesc: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
});
