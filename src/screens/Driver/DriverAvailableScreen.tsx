import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Switch,
  Pressable,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../state/AuthStore';
import { useDataStore } from '../../state/DataStore';
import { useOrdersQuery } from '../../hooks/useOrdersQuery';
import { OrderCardSkeletonList } from '../../components/skeletons/OrderCardSkeleton';
import { driverService } from '../../services/DriverService';
import { colors } from '../../theme/theme';
import type { Order } from '../../models/Order';

const { width: SW } = Dimensions.get('window');

/* ──── Delivery Card ──── */
const DeliveryCard = React.memo<{
  order: Order; index: number; onAccept: (id: string) => void;
}>(({ order, index, onAccept }) => {
  const scale = useRef(new Animated.Value(0.92)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 50, delay: index * 70, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: 400, delay: index * 70, useNativeDriver: true }),
    ]).start();
  }, []);

  const est = `${10 + Math.floor(Math.random() * 15)} min`;

  return (
    <Animated.View style={[s.delivCard, { opacity: op, transform: [{ scale }] }]}>
      {/* Top row */}
      <View style={s.delivTopRow}>
        <View style={s.delivIdBadge}>
          <Text style={s.delivIdText}>#{order.id.slice(0, 6)}</Text>
        </View>
        <View style={s.delivEstBadge}>
          <Text style={s.delivEstIcon}>{'\u23F1\uFE0F'}</Text>
          <Text style={s.delivEstText}>{est}</Text>
        </View>
      </View>

      {/* Customer */}
      <Text style={s.delivCustomer}>{order.customerName}</Text>

      {/* Info Grid */}
      <View style={s.delivInfoGrid}>
        <View style={s.delivInfoItem}>
          <Text style={s.delivInfoIcon}>{'\uD83C\uDF7D\uFE0F'}</Text>
          <View>
            <Text style={s.delivInfoValue}>{order.items.length}</Text>
            <Text style={s.delivInfoLabel}>Items</Text>
          </View>
        </View>
        <View style={s.delivInfoDivider} />
        <View style={s.delivInfoItem}>
          <Text style={s.delivInfoIcon}>{'\uD83D\uDCB5'}</Text>
          <View>
            <Text style={s.delivInfoValue}>${order.total.toFixed(2)}</Text>
            <Text style={s.delivInfoLabel}>Total</Text>
          </View>
        </View>
        <View style={s.delivInfoDivider} />
        <View style={s.delivInfoItem}>
          <Text style={s.delivInfoIcon}>{'\uD83D\uDCCD'}</Text>
          <View>
            <Text style={s.delivInfoValue} numberOfLines={1}>{order.deliveryAddress?.street ?? 'N/A'}</Text>
            <Text style={s.delivInfoLabel}>Address</Text>
          </View>
        </View>
      </View>

      {/* Items preview */}
      <View style={s.delivItemsRow}>
        {order.items.slice(0, 3).map((it, i) => (
          <View key={i} style={s.delivItemChip}>
            <Text style={s.delivItemChipText} numberOfLines={1}>{it.menuItem.name}</Text>
          </View>
        ))}
        {order.items.length > 3 && (
          <View style={s.delivItemChipMore}>
            <Text style={s.delivItemChipMoreText}>+{order.items.length - 3}</Text>
          </View>
        )}
      </View>

      {/* Accept Button */}
      <Pressable
        style={({ pressed }) => [s.acceptBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
        onPress={() => onAccept(order.id)}
      >
        <Text style={s.acceptBtnText}>Accept Delivery</Text>
        <Text style={s.acceptBtnArrow}>{'\u2192'}</Text>
      </Pressable>
    </Animated.View>
  );
});

/* ──── Main Screen ──── */
export const DriverAvailableScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: allOrders = [], isLoading: ordersLoading } = useOrdersQuery(user?.id, 'driver');
  const { driverAcceptOrder } = useDataStore();
  const [isOnline, setIsOnline] = useState(true);

  const availableOrders = allOrders.filter(o => o.status === 'READY' && !o.driverId);

  const headerOp = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOp, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 600, easing: Easing.out(Easing.exp), useNativeDriver: true }),
    ]).start();
  }, []);

  const handleToggle = async (val: boolean) => {
    setIsOnline(val);
    if (user) await driverService.setOnlineStatus(user.id, val);
  };

  const handleAccept = (orderId: string) => {
    if (user) driverAcceptOrder(orderId, user.id);
  };

  const orders = availableOrders;
  const completedToday = allOrders.filter(o => o.status === 'DELIVERED').length;
  const firstName = user?.name?.split(' ')[0] ?? 'Driver';

  if (ordersLoading && allOrders.length === 0) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <OrderCardSkeletonList count={4} />
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <FlatList
        data={isOnline ? orders : []}
        keyExtractor={o => o.id}
        renderItem={({ item, index }) => (
          <DeliveryCard order={item} index={index} onAccept={handleAccept} />
        )}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* ── Header ── */}
            <Animated.View style={[s.headerSection, { opacity: headerOp, transform: [{ translateY: headerSlide }] }]}>
              <View style={s.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.headerGreeting}>Hey, {firstName} {'\uD83D\uDC4B'}</Text>
                  <Text style={s.headerSub}>
                    {isOnline ? `${orders.length} delivery${orders.length !== 1 ? 's' : ''} available` : "You're offline"}
                  </Text>
                </View>
                <Pressable style={s.avatarBtn} onPress={() => router.push('/driver/profile' as any)}>
                  <Text style={s.avatarText}>{firstName.charAt(0)}</Text>
                </Pressable>
              </View>
            </Animated.View>

            {/* ── Status Banner ── */}
            <View style={[s.statusBanner, isOnline ? s.statusOnline : s.statusOffline]}>
              <View style={s.statusLeft}>
                <View style={[s.statusDot, { backgroundColor: isOnline ? '#34D399' : colors.textSecondary }]} />
                <View>
                  <Text style={s.statusTitle}>{isOnline ? 'Accepting Deliveries' : 'Offline Mode'}</Text>
                  <Text style={s.statusDesc}>
                    {isOnline ? 'You will receive new orders' : 'Toggle to start receiving orders'}
                  </Text>
                </View>
              </View>
              <Switch
                onValueChange={handleToggle}
                value={isOnline}
                trackColor={{ false: '#D1D5DB', true: '#6EE7B7' }}
                thumbColor={isOnline ? '#10B981' : '#9CA3AF'}
              />
            </View>

            {/* ── Stats Row ── */}
            <View style={s.statsRow}>
              <View style={s.statCard}>
                <Text style={s.statIcon}>{'\uD83D\uDCE6'}</Text>
                <Text style={s.statValue}>{orders.length}</Text>
                <Text style={s.statLabel}>Available</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statIcon}>{'\u2705'}</Text>
                <Text style={s.statValue}>{completedToday}</Text>
                <Text style={s.statLabel}>Completed</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statIcon}>{'\u26A1'}</Text>
                <Text style={[s.statValue, { color: isOnline ? '#10B981' : colors.textSecondary }]}>
                  {isOnline ? 'Active' : 'Off'}
                </Text>
                <Text style={s.statLabel}>Status</Text>
              </View>
            </View>

            {/* ── Quick Nav ── */}
            <View style={s.quickNavRow}>
              <Pressable style={s.quickNavBtn} onPress={() => router.push('/driver/active' as any)}>
                <Text style={s.quickNavIcon}>{'\uD83D\uDE9A'}</Text>
                <Text style={s.quickNavLabel}>Active</Text>
              </Pressable>
              <Pressable style={s.quickNavBtn} onPress={() => router.push('/driver/earnings' as any)}>
                <Text style={s.quickNavIcon}>{'\uD83D\uDCB0'}</Text>
                <Text style={s.quickNavLabel}>Earnings</Text>
              </Pressable>
              <Pressable style={s.quickNavBtn} onPress={() => router.push('/driver/profile' as any)}>
                <Text style={s.quickNavIcon}>{'\uD83D\uDC64'}</Text>
                <Text style={s.quickNavLabel}>Profile</Text>
              </Pressable>
            </View>

            {/* ── Section Title ── */}
            {isOnline && (
              <Text style={s.sectionLabel}>
                {orders.length > 0 ? 'Available Orders' : ''}
              </Text>
            )}
          </>
        }
        ListEmptyComponent={
          isOnline ? (
            <View style={s.emptyBox}>
              <Text style={{ fontSize: 56 }}>{'\uD83D\uDCE5'}</Text>
              <Text style={s.emptyTitle}>No deliveries right now</Text>
              <Text style={s.emptyDesc}>New orders will appear here when they're ready for pickup</Text>
            </View>
          ) : (
            <View style={s.emptyBox}>
              <Text style={{ fontSize: 56 }}>{'\uD83D\uDE34'}</Text>
              <Text style={s.emptyTitle}>You're offline</Text>
              <Text style={s.emptyDesc}>Toggle the switch above to start receiving delivery requests</Text>
            </View>
          )
        }
      />
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFBFE' },
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30 },

  /* Header */
  headerSection: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerGreeting: { fontSize: 26, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  avatarBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#20C997', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#20C997', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#FFF' },

  /* Status Banner */
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 20, padding: 16, marginBottom: 16,
    borderWidth: 1,
  },
  statusOnline: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  statusOffline: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
  statusLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  statusTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  statusDesc: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },

  /* Stats */
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 18, padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  statIcon: { fontSize: 20, marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '900', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginTop: 2 },

  /* Quick Nav */
  quickNavRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  quickNavBtn: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 16, paddingVertical: 14, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  quickNavIcon: { fontSize: 22, marginBottom: 4 },
  quickNavLabel: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },

  /* Section */
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },

  /* Delivery Card */
  delivCard: {
    backgroundColor: '#FFF', borderRadius: 22, padding: 18, marginBottom: 14,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 4,
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  delivTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  delivIdBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  delivIdText: { fontSize: 12, fontWeight: '800', color: '#4A90D9' },
  delivEstBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF7ED', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  delivEstIcon: { fontSize: 12 },
  delivEstText: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },
  delivCustomer: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 },

  /* Info Grid */
  delivInfoGrid: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  delivInfoItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  delivInfoIcon: { fontSize: 18 },
  delivInfoValue: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  delivInfoLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
  delivInfoDivider: { width: 1, height: 30, backgroundColor: '#F0F0F5', marginHorizontal: 4 },

  /* Items Preview */
  delivItemsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  delivItemChip: { backgroundColor: '#F5F5FA', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  delivItemChipText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, maxWidth: 100 },
  delivItemChipMore: { backgroundColor: colors.accent + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  delivItemChipMoreText: { fontSize: 11, fontWeight: '700', color: colors.accent },

  /* Accept */
  acceptBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 16, gap: 8,
    shadowColor: '#10B981', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  acceptBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  acceptBtnArrow: { color: '#FFF', fontSize: 18, fontWeight: '600' },

  /* Empty */
  emptyBox: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 16 },
  emptyDesc: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 6, maxWidth: 280, lineHeight: 20 },
});

