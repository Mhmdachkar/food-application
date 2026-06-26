import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
  Pressable,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../state/AuthStore';
import { useMenuQuery } from '../../hooks/useMenuQuery';
import { useOrdersQuery } from '../../hooks/useOrdersQuery';
import { useDriversQuery } from '../../hooks/useDriversQuery';
import { DashboardSkeleton } from '../../components/skeletons/DashboardSkeleton';
import { colors } from '../../theme/theme';
import type { Order } from '../../models/Order';

const { width: SW } = Dimensions.get('window');

const STATUS_COLOR: Record<string, string> = {
  PLACED: '#4A90D9',
  ACCEPTED: colors.accent,
  PREPARING: '#F59E0B',
  READY: '#845EF7',
  OUT_FOR_DELIVERY: '#20C997',
  DELIVERED: colors.success,
  CANCELED: colors.danger,
};

/* ──── Animated Metric Card ──── */
const MetricCard: React.FC<{
  icon: string; label: string; value: string | number; accent: string; idx: number;
}> = ({ icon, label, value, accent, idx }) => {
  const scale = useRef(new Animated.Value(0.85)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 50, delay: idx * 80, useNativeDriver: true }),
      Animated.timing(op, { toValue: 1, duration: 500, delay: idx * 80, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[s.metricCard, { opacity: op, transform: [{ scale }] }]}>
      <View style={[s.metricIconWrap, { backgroundColor: accent + '15' }]}>
        <Text style={s.metricIcon}>{icon}</Text>
      </View>
      <Text style={[s.metricValue, { color: accent }]}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </Animated.View>
  );
};

/* ──── Order Activity Row ──── */
const ActivityRow: React.FC<{ order: Order; isLast: boolean }> = ({ order, isLast }) => {
  const sc = STATUS_COLOR[order.status] ?? colors.accent;
  return (
    <View style={[s.actRow, !isLast && s.actRowBorder]}>
      <View style={[s.actDot, { backgroundColor: sc }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.actName}>{order.customerName}</Text>
        <Text style={s.actMeta}>
          {order.items.length} item{order.items.length !== 1 ? 's' : ''} {'\u00B7'} ${order.total.toFixed(2)}
          {order.driverName ? ` \u00B7 ${order.driverName}` : ''}
        </Text>
      </View>
      <View style={[s.actPill, { backgroundColor: sc + '14' }]}>
        <Text style={[s.actPillText, { color: sc }]}>{order.status.replace(/_/g, ' ')}</Text>
      </View>
    </View>
  );
};

/* ──── Main Screen ──── */
export const AdminDashboardScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: menuItems = [], isLoading: menuLoading } = useMenuQuery();
  const { data: orders = [], isLoading: ordersLoading } = useOrdersQuery(user?.id, 'admin', {
    refetchInterval: 60_000,
  });
  const { data: drivers = [] } = useDriversQuery(true);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 600, easing: Easing.out(Easing.exp), useNativeDriver: true }),
    ]).start();
  }, []);

  const stats = useMemo(() => {
    const total = orders.length;
    const active = orders.filter(o => !['DELIVERED', 'CANCELED'].includes(o.status)).length;
    const delivered = orders.filter(o => o.status === 'DELIVERED').length;
    const revenue = orders.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + o.total, 0);
    const canceled = orders.filter(o => o.status === 'CANCELED').length;
    return { total, active, delivered, revenue, canceled };
  }, [orders]);

  const recentOrders = useMemo(() => [...orders].reverse().slice(0, 8), [orders]);

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [orders]);

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if ((menuLoading || ordersLoading) && orders.length === 0 && menuItems.length === 0) {
    return <DashboardSkeleton />;
  }

  return (
    <ScrollView style={[s.container, { paddingTop: insets.top }]} contentContainerStyle={s.content}>
      {/* ── Header ── */}
      <Animated.View style={[s.header, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
        <View>
          <Text style={s.headerTitle}>Command Center</Text>
          <Text style={s.headerDate}>{dateStr}</Text>
        </View>
        <Pressable style={s.headerAvatar} onPress={() => router.push('/admin/settings' as any)}>
          <Text style={s.headerAvatarText}>{user?.name?.charAt(0) ?? 'A'}</Text>
        </Pressable>
      </Animated.View>

      {/* ── Revenue Hero ── */}
      <Animated.View style={[s.revenueHero, { opacity: fadeIn }]}>
        <Text style={s.revenueLabel}>Total Revenue</Text>
        <Text style={s.revenueValue}>${stats.revenue.toFixed(2)}</Text>
        <View style={s.revenueRow}>
          <View style={s.revenueStat}>
            <Text style={s.revenueStatNum}>{stats.delivered}</Text>
            <Text style={s.revenueStatLabel}>Delivered</Text>
          </View>
          <View style={s.revenueDivider} />
          <View style={s.revenueStat}>
            <Text style={s.revenueStatNum}>{stats.active}</Text>
            <Text style={s.revenueStatLabel}>Active</Text>
          </View>
          <View style={s.revenueDivider} />
          <View style={s.revenueStat}>
            <Text style={s.revenueStatNum}>{stats.canceled}</Text>
            <Text style={s.revenueStatLabel}>Canceled</Text>
          </View>
        </View>
      </Animated.View>

      {/* ── Metric Cards ── */}
      <View style={s.metricGrid}>
        <MetricCard icon={'\uD83D\uDCE6'} label="Orders" value={stats.total} accent="#4A90D9" idx={0} />
        <MetricCard icon={'\u26A1'} label="Active" value={stats.active} accent={colors.accent} idx={1} />
        <MetricCard icon={'\uD83D\uDE97'} label="Drivers" value={drivers.length} accent="#20C997" idx={2} />
        <MetricCard icon={'\uD83C\uDF54'} label="Menu" value={menuItems.filter(m => m.isAvailable).length} accent="#845EF7" idx={3} />
      </View>

      {/* ── Status Breakdown ── */}
      {statusBreakdown.length > 0 && (
        <>
          <Text style={s.sectionLabel}>Order Pipeline</Text>
          <View style={s.pipelineCard}>
            {statusBreakdown.map(([status, count], i) => {
              const color = STATUS_COLOR[status] ?? colors.accent;
              const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
              return (
                <View key={status} style={s.pipeRow}>
                  <View style={[s.pipeDot, { backgroundColor: color }]} />
                  <Text style={s.pipeName}>{status.replace(/_/g, ' ')}</Text>
                  <View style={s.pipeBarBg}>
                    <View style={[s.pipeBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                  </View>
                  <Text style={s.pipeCount}>{count}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* ── Quick Actions ── */}
      <Text style={s.sectionLabel}>Quick Actions</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickActRow}>
        {[
          { icon: '\uD83D\uDCCB', label: 'Orders', route: '/admin/orders' },
          { icon: '\uD83C\uDF7D\uFE0F', label: 'Menu', route: '/admin/menu' },
          { icon: '\uD83D\uDE9A', label: 'Dispatch', route: '/admin/dispatch' },
          { icon: '\uD83D\uDC65', label: 'Users', route: '/admin/users' },
          { icon: '\uD83D\uDCAC', label: 'Messages', route: '/admin/messages' },
          { icon: '\u2699\uFE0F', label: 'Settings', route: '/admin/settings' },
        ].map(a => (
          <Pressable
            key={a.label}
            style={({ pressed }) => [s.quickActCard, pressed && { transform: [{ scale: 0.95 }] }]}
            onPress={() => router.push(a.route as any)}
          >
            <Text style={s.quickActIcon}>{a.icon}</Text>
            <Text style={s.quickActLabel}>{a.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Recent Activity ── */}
      <View style={s.sectionRow}>
        <Text style={s.sectionTitle}>Recent Activity</Text>
        <Pressable onPress={() => router.push('/admin/orders' as any)}>
          <Text style={s.seeAll}>View all</Text>
        </Pressable>
      </View>
      <View style={s.actCard}>
        {recentOrders.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={{ fontSize: 32 }}>{'\uD83D\uDCE5'}</Text>
            <Text style={s.emptyText}>No orders yet</Text>
          </View>
        ) : (
          recentOrders.map((o, i) => (
            <ActivityRow key={o.id} order={o} isLast={i === recentOrders.length - 1} />
          ))
        )}
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFBFE' },
  content: { paddingHorizontal: 20, paddingBottom: 20 },

  /* Header */
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 8 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  headerDate: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  headerAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#845EF7', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#845EF7', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  headerAvatarText: { fontSize: 18, fontWeight: '800', color: '#FFF' },

  /* Revenue Hero */
  revenueHero: {
    backgroundColor: colors.textPrimary, borderRadius: 24, padding: 22, marginBottom: 18,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  revenueLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  revenueValue: { fontSize: 36, fontWeight: '900', color: '#FFF', marginTop: 4, letterSpacing: -1 },
  revenueRow: { flexDirection: 'row', marginTop: 16, justifyContent: 'space-around' },
  revenueStat: { alignItems: 'center' },
  revenueStatNum: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  revenueStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2, fontWeight: '600' },
  revenueDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', height: '100%' as any },

  /* Metric Grid */
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  metricCard: {
    width: (SW - 50) / 2, backgroundColor: '#FFF', borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  metricIconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  metricIcon: { fontSize: 20 },
  metricValue: { fontSize: 26, fontWeight: '900' },
  metricLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2, fontWeight: '600' },

  /* Pipeline */
  pipelineCard: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  pipeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  pipeDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  pipeName: { fontSize: 12, fontWeight: '700', color: colors.textPrimary, width: 100, textTransform: 'capitalize' },
  pipeBarBg: { flex: 1, height: 6, backgroundColor: '#F0F0F5', borderRadius: 3, marginHorizontal: 8, overflow: 'hidden' },
  pipeBarFill: { height: 6, borderRadius: 3 },
  pipeCount: { fontSize: 13, fontWeight: '800', color: colors.textPrimary, width: 28, textAlign: 'right' },

  /* Sections */
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  seeAll: { fontSize: 14, fontWeight: '600', color: colors.accent },

  /* Quick Actions */
  quickActRow: { gap: 10, paddingBottom: 20 },
  quickActCard: {
    backgroundColor: '#FFF', borderRadius: 18, paddingVertical: 16, paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  quickActIcon: { fontSize: 24, marginBottom: 6 },
  quickActLabel: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },

  /* Activity */
  actCard: {
    backgroundColor: '#FFF', borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  actRow: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  actRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F5F5FA' },
  actDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  actName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  actMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  actPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  actPillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },

  /* Empty */
  emptyBox: { padding: 30, alignItems: 'center' },
  emptyText: { fontSize: 14, color: colors.textSecondary, marginTop: 8 },
});

