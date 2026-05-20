import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../state/AuthStore';
import { useDataStore } from '../../state/DataStore';
import { useOrdersQuery } from '../../hooks/useOrdersQuery';
import { useDriversQuery } from '../../hooks/useDriversQuery';
import { colors, spacing, radii } from '../../theme/theme';
import { Card } from '../../theme/components/Card';
import { Button } from '../../theme/components/Button';
import { SectionHeader } from '../../theme/components/SectionHeader';
import type { Order } from '../../models/Order';

export const AdminDispatchScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { data: orders = [] } = useOrdersQuery(user?.id, 'admin');
  const { data: drivers = [] } = useDriversQuery(true);
  const { assignDriverLocalOrRemote } = useDataStore();

  const unassigned = orders.filter(
    o => (o.status === 'READY' || o.status === 'ACCEPTED' || o.status === 'PREPARING') && !o.driverId,
  );
  const inTransit = orders.filter(o => o.status === 'OUT_FOR_DELIVERY');

  const renderUnassigned = ({ item: order }: { item: Order }) => (
    <Card style={styles.orderCard}>
      <Text style={styles.orderId}>#{order.id.slice(0, 8)}</Text>
      <Text style={styles.orderMeta}>{order.customerName} · {order.items.length} item(s) · ${order.total.toFixed(2)}</Text>
      <Text style={styles.addressText}>
        {order.deliveryAddress.street}, {order.deliveryAddress.city}
      </Text>
      {drivers.length > 0 ? (
        <View style={styles.driverActions}>
          {drivers.slice(0, 3).map(driver => (
            <Button
              key={driver.id}
              title={`Assign ${driver.name}`}
              onPress={() => assignDriverLocalOrRemote(order.id, driver.id, driver.name, user?.id)}
              fullWidth={false}
              style={styles.assignButton}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.noDrivers}>No drivers online</Text>
      )}
    </Card>
  );

  const renderInTransit = ({ item: order }: { item: Order }) => (
    <Card style={styles.orderCard}>
      <View style={styles.transitRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderId}>#{order.id.slice(0, 8)}</Text>
          <Text style={styles.orderMeta}>{order.customerName}</Text>
        </View>
        <View style={styles.transitBadge}>
          <Text style={styles.transitText}>{order.driverName ?? 'Unknown'}</Text>
        </View>
      </View>
      <Text style={styles.addressText}>
        {order.deliveryAddress.street}, {order.deliveryAddress.city}
      </Text>
    </Card>
  );

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Dispatch</Text>

      {/* Drivers online */}
      <Card style={styles.statsCard}>
        <Text style={styles.statsLabel}>Drivers Online</Text>
        <Text style={styles.statsValue}>{drivers.length}</Text>
      </Card>

      {/* Unassigned orders */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        <SectionHeader title={`Needs Driver (${unassigned.length})`} />
      </View>
      {unassigned.length === 0 ? (
        <Text style={styles.emptyText}>All orders have drivers assigned</Text>
      ) : (
        unassigned.map(order => (
          <View key={order.id}>{renderUnassigned({ item: order })}</View>
        ))
      )}

      {/* In transit */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        <SectionHeader title={`In Transit (${inTransit.length})`} />
      </View>
      {inTransit.length === 0 ? (
        <Text style={styles.emptyText}>No orders in transit</Text>
      ) : (
        inTransit.map(order => (
          <View key={order.id}>{renderInTransit({ item: order })}</View>
        ))
      )}

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  statsCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsLabel: { fontSize: 14, color: colors.textSecondary },
  statsValue: { fontSize: 24, fontWeight: '800', color: colors.accent },
  orderCard: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.md },
  orderId: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  orderMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  addressText: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  driverActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  assignButton: { paddingHorizontal: spacing.md },
  noDrivers: { fontSize: 13, color: colors.danger, marginTop: spacing.sm },
  transitRow: { flexDirection: 'row', alignItems: 'center' },
  transitBadge: { backgroundColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.small },
  transitText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.lg },
});
