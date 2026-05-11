import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../state/AuthStore';
import { useDataStore } from '../../state/DataStore';
import { useMessageStore } from '../../state/MessageStore';
import { colors } from '../../theme/theme';
import type { Order } from '../../models/Order';

const { width: SW } = Dimensions.get('window');

type PeriodKey = 'today' | 'week' | 'month' | 'all';

/* ── Delivery Detail Modal ── */
const DeliveryDetailModal: React.FC<{
  visible: boolean;
  order: Order | null;
  onClose: () => void;
}> = ({ visible, order, onClose }) => {
  if (!order) return null;
  const earning = order.tip + order.deliveryFee;
  const timeline = [...order.timeline].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <Pressable style={s.modalSheet} onPress={e => e.stopPropagation()}>
          <View style={s.modalHandle} />
          <View style={s.detailHeader}>
            <Text style={s.detailTitle}>Delivery #{order.id.slice(0, 6)}</Text>
            <View style={s.detailEarningPill}>
              <Text style={s.detailEarningText}>+${earning.toFixed(2)}</Text>
            </View>
          </View>
          <Text style={s.detailDate}>
            {new Date(order.createdAt).toLocaleDateString([], {
              weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </Text>

          {/* Earnings breakdown */}
          <View style={s.breakdownCard}>
            <View style={s.breakdownRow}>
              <Text style={s.breakdownLabel}>Delivery Fee</Text>
              <Text style={s.breakdownVal}>${order.deliveryFee.toFixed(2)}</Text>
            </View>
            <View style={s.breakdownRow}>
              <Text style={s.breakdownLabel}>Tip</Text>
              <Text style={[s.breakdownVal, order.tip > 0 && { color: colors.success }]}>
                ${order.tip.toFixed(2)}
              </Text>
            </View>
            <View style={s.breakdownDivider} />
            <View style={s.breakdownRow}>
              <Text style={s.breakdownTotal}>Total Earned</Text>
              <Text style={s.breakdownTotalVal}>${earning.toFixed(2)}</Text>
            </View>
          </View>

          {/* Customer info */}
          <View style={s.infoRow}>
            <Text style={s.infoIcon}>{'\uD83D\uDC64'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>Customer</Text>
              <Text style={s.infoValue}>{order.customerName}</Text>
            </View>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoIcon}>{'\uD83D\uDCCD'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>Delivered to</Text>
              <Text style={s.infoValue}>
                {order.deliveryAddress.street}, {order.deliveryAddress.city}
              </Text>
            </View>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoIcon}>{'\uD83D\uDCE6'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.infoLabel}>Items</Text>
              <Text style={s.infoValue}>
                {order.items.map(ci => `${ci.quantity}x ${ci.menuItem.name}`).join(', ')}
              </Text>
            </View>
          </View>

          {/* Timeline */}
          <Text style={s.detailSection}>Delivery Timeline</Text>
          {timeline.map((ev, idx) => {
            const isLast = idx === timeline.length - 1;
            const time = new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <View key={ev.id} style={s.tlRow}>
                <View style={s.tlLeft}>
                  <View style={[s.tlDot, isLast && { backgroundColor: colors.success }]} />
                  {!isLast && <View style={s.tlLine} />}
                </View>
                <View style={s.tlContent}>
                  <Text style={s.tlStatus}>{ev.status.replace(/_/g, ' ')}</Text>
                  <Text style={s.tlTime}>{time}</Text>
                </View>
              </View>
            );
          })}

          <Pressable style={s.closeModalBtn} onPress={onClose}>
            <Text style={s.closeModalText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

/* ──────────────────────────── Main Screen ──────────────────────────── */

export const DriverEarningsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { ordersForDriver, refreshOrders } = useDataStore();
  const { getAverageRating, getRatingsForDriver } = useMessageStore();

  const [period, setPeriod] = useState<PeriodKey>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (user) refreshOrders(user.id, 'driver');
  }, [user, refreshOrders]);

  const driverOrders = user ? ordersForDriver(user.id) : [];
  const deliveredOrders = driverOrders.filter(o => o.status === 'DELIVERED');

  /* Period filtering */
  const filteredDeliveries = useMemo(() => {
    const now = new Date();
    return deliveredOrders.filter(o => {
      const d = new Date(o.createdAt);
      switch (period) {
        case 'today':
          return d.toDateString() === now.toDateString();
        case 'week': {
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return d >= weekAgo;
        }
        case 'month': {
          const monthAgo = new Date(now);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return d >= monthAgo;
        }
        default:
          return true;
      }
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [deliveredOrders, period]);

  const totalEarnings = filteredDeliveries.reduce((sum, o) => sum + o.tip + o.deliveryFee, 0);
  const totalTips = filteredDeliveries.reduce((sum, o) => sum + o.tip, 0);
  const totalFees = filteredDeliveries.reduce((sum, o) => sum + o.deliveryFee, 0);
  const avgPerDelivery = filteredDeliveries.length > 0 ? totalEarnings / filteredDeliveries.length : 0;

  /* Rating data */
  const ratings = user ? getRatingsForDriver(user.id) : [];
  const avgRating = user ? getAverageRating(user.id) : 0;
  const ratingCounts = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: ratings.filter(r => r.rating === star).length,
  }));

  /* Weekly chart data (last 7 days) */
  const weeklyData = useMemo(() => {
    const days: { label: string; amount: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toDateString();
      const dayLabel = d.toLocaleDateString([], { weekday: 'short' });
      const dayTotal = deliveredOrders
        .filter(o => new Date(o.createdAt).toDateString() === dayStr)
        .reduce((sum, o) => sum + o.tip + o.deliveryFee, 0);
      days.push({ label: dayLabel, amount: dayTotal });
    }
    return days;
  }, [deliveredOrders]);

  const maxWeekly = Math.max(...weeklyData.map(d => d.amount), 1);

  const renderDelivery = ({ item: order }: { item: Order }) => {
    const earning = order.tip + order.deliveryFee;
    const dateStr = new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
    const timeStr = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <Pressable
        style={({ pressed }) => [s.deliveryCard, pressed && { transform: [{ scale: 0.98 }] }]}
        onPress={() => setSelectedOrder(order)}
      >
        <View style={s.deliveryLeft}>
          <View style={s.deliveryIconWrap}>
            <Text style={s.deliveryIcon}>{'\uD83D\uDCE6'}</Text>
          </View>
        </View>
        <View style={s.deliveryCenter}>
          <Text style={s.deliveryCustomer}>{order.customerName}</Text>
          <Text style={s.deliveryMeta}>
            #{order.id.slice(0, 6)} {'\u00B7'} {order.items.length} item{order.items.length !== 1 ? 's' : ''}
          </Text>
          <Text style={s.deliveryDate}>{dateStr} at {timeStr}</Text>
        </View>
        <View style={s.deliveryRight}>
          <Text style={s.deliveryEarning}>+${earning.toFixed(2)}</Text>
          {order.tip > 0 && (
            <Text style={s.deliveryTip}>Tip: ${order.tip.toFixed(2)}</Text>
          )}
        </View>
      </Pressable>
    );
  };

  const ListHeader = () => (
    <>
      {/* Earnings Hero */}
      <View style={s.heroCard}>
        <Text style={s.heroLabel}>
          {period === 'today' ? "Today's" : period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'Total'} Earnings
        </Text>
        <Text style={s.heroValue}>${totalEarnings.toFixed(2)}</Text>
        <View style={s.heroStatsRow}>
          <View style={s.heroStat}>
            <Text style={s.heroStatNum}>{filteredDeliveries.length}</Text>
            <Text style={s.heroStatLabel}>Deliveries</Text>
          </View>
          <View style={s.heroDivider} />
          <View style={s.heroStat}>
            <Text style={s.heroStatNum}>${avgPerDelivery.toFixed(2)}</Text>
            <Text style={s.heroStatLabel}>Avg/Delivery</Text>
          </View>
          <View style={s.heroDivider} />
          <View style={s.heroStat}>
            <Text style={s.heroStatNum}>${totalTips.toFixed(2)}</Text>
            <Text style={s.heroStatLabel}>Tips</Text>
          </View>
        </View>
      </View>

      {/* Period Filter */}
      <View style={s.periodRow}>
        {([
          { key: 'today' as PeriodKey, label: 'Today' },
          { key: 'week' as PeriodKey, label: 'Week' },
          { key: 'month' as PeriodKey, label: 'Month' },
          { key: 'all' as PeriodKey, label: 'All Time' },
        ]).map(p => (
          <Pressable
            key={p.key}
            style={[s.periodBtn, period === p.key && s.periodBtnActive]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[s.periodText, period === p.key && s.periodTextActive]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Earnings Breakdown */}
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>Earnings Breakdown</Text>
        <View style={s.breakdownGrid}>
          <View style={[s.breakdownItem, { backgroundColor: colors.accent + '10' }]}>
            <Text style={s.breakdownItemIcon}>{'\uD83D\uDCB5'}</Text>
            <Text style={[s.breakdownItemNum, { color: colors.accent }]}>${totalFees.toFixed(2)}</Text>
            <Text style={s.breakdownItemLabel}>Delivery Fees</Text>
          </View>
          <View style={[s.breakdownItem, { backgroundColor: colors.success + '10' }]}>
            <Text style={s.breakdownItemIcon}>{'\uD83D\uDCAA'}</Text>
            <Text style={[s.breakdownItemNum, { color: colors.success }]}>${totalTips.toFixed(2)}</Text>
            <Text style={s.breakdownItemLabel}>Tips</Text>
          </View>
        </View>
      </View>

      {/* Weekly Chart */}
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>Last 7 Days</Text>
        <View style={s.chartRow}>
          {weeklyData.map((d, idx) => {
            const h = (d.amount / maxWeekly) * 100;
            const isToday = idx === weeklyData.length - 1;
            return (
              <View key={idx} style={s.chartCol}>
                <Text style={s.chartAmt}>
                  {d.amount > 0 ? `$${d.amount.toFixed(0)}` : ''}
                </Text>
                <View style={s.chartBarBg}>
                  <View
                    style={[
                      s.chartBarFill,
                      { height: `${Math.max(h, 4)}%` },
                      isToday && { backgroundColor: colors.accent },
                    ]}
                  />
                </View>
                <Text style={[s.chartLabel, isToday && { color: colors.accent, fontWeight: '800' }]}>
                  {d.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Rating Section */}
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>Your Rating</Text>
        {ratings.length > 0 ? (
          <>
            <View style={s.ratingHero}>
              <Text style={s.ratingBigNum}>{avgRating.toFixed(1)}</Text>
              <View style={s.ratingStars}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Text key={i} style={[s.ratingStar, i <= Math.round(avgRating) && s.ratingStarFilled]}>
                    {'\u2B50'}
                  </Text>
                ))}
              </View>
              <Text style={s.ratingSubtext}>{ratings.length} rating{ratings.length !== 1 ? 's' : ''}</Text>
            </View>
            <View style={s.ratingBars}>
              {ratingCounts.map(({ star, count }) => {
                const pct = ratings.length > 0 ? (count / ratings.length) * 100 : 0;
                return (
                  <View key={star} style={s.ratingBarRow}>
                    <Text style={s.ratingBarLabel}>{star}</Text>
                    <View style={s.ratingBarBg}>
                      <View style={[s.ratingBarFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={s.ratingBarCount}>{count}</Text>
                  </View>
                );
              })}
            </View>

            {/* Recent reviews */}
            {ratings.slice(0, 3).map(r => (
              <View key={r.id} style={s.reviewCard}>
                <View style={s.reviewHeader}>
                  <Text style={s.reviewStars}>
                    {Array(r.rating).fill('\u2B50').join('')}
                  </Text>
                  <Text style={s.reviewDate}>
                    {new Date(r.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                {r.comment ? <Text style={s.reviewComment}>{r.comment}</Text> : null}
              </View>
            ))}
          </>
        ) : (
          <View style={s.noRatingsBox}>
            <Text style={{ fontSize: 32 }}>{'\u2B50'}</Text>
            <Text style={s.noRatingsText}>No ratings yet</Text>
            <Text style={s.noRatingsDesc}>Complete deliveries to receive ratings from customers</Text>
          </View>
        )}
      </View>

      {/* Delivery History Header */}
      <Text style={s.historyTitle}>
        Delivery History ({filteredDeliveries.length})
      </Text>
    </>
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Title */}
      <View style={s.header}>
        <Text style={s.title}>Earnings</Text>
        <Text style={s.subtitle}>Track your performance</Text>
      </View>

      <FlatList
        data={filteredDeliveries}
        keyExtractor={o => o.id}
        renderItem={renderDelivery}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={{ fontSize: 36 }}>{'\uD83D\uDCE6'}</Text>
            <Text style={s.emptyTitle}>No deliveries yet</Text>
            <Text style={s.emptyDesc}>
              {period !== 'all' ? 'Try a different time period' : 'Complete deliveries to see your earnings'}
            </Text>
          </View>
        }
      />

      <DeliveryDetailModal
        visible={!!selectedOrder}
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFBFE' },
  listContent: { paddingBottom: 30 },

  /* Header */
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  title: { fontSize: 28, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  /* Hero */
  heroCard: {
    marginHorizontal: 20, marginTop: 14, marginBottom: 14, backgroundColor: colors.textPrimary,
    borderRadius: 24, padding: 22,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  heroLabel: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  heroValue: { fontSize: 40, fontWeight: '900', color: '#FFF', marginTop: 4, letterSpacing: -1 },
  heroStatsRow: { flexDirection: 'row', marginTop: 18, justifyContent: 'space-around' },
  heroStat: { alignItems: 'center' },
  heroStatNum: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  heroStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2, fontWeight: '600' },
  heroDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', height: '100%' as any },

  /* Period filter */
  periodRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 14 },
  periodBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
    backgroundColor: '#F5F5FA', borderWidth: 1, borderColor: '#EDEDF0',
  },
  periodBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  periodText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  periodTextActive: { color: '#FFF' },

  /* Section Card */
  sectionCard: {
    marginHorizontal: 20, marginBottom: 14, backgroundColor: '#FFF', borderRadius: 20, padding: 18,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 14 },

  /* Breakdown */
  breakdownGrid: { flexDirection: 'row', gap: 10 },
  breakdownItem: {
    flex: 1, borderRadius: 14, padding: 14, alignItems: 'center',
  },
  breakdownItemIcon: { fontSize: 24, marginBottom: 6 },
  breakdownItemNum: { fontSize: 20, fontWeight: '900' },
  breakdownItemLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginTop: 2 },

  /* Weekly chart */
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 140 },
  chartCol: { flex: 1, alignItems: 'center' },
  chartAmt: { fontSize: 9, color: colors.textSecondary, fontWeight: '700', marginBottom: 4, height: 12 },
  chartBarBg: { width: '70%', height: 100, backgroundColor: '#F0F0F5', borderRadius: 6, overflow: 'hidden', justifyContent: 'flex-end' },
  chartBarFill: { width: '100%', backgroundColor: '#20C997', borderRadius: 6 },
  chartLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '600', marginTop: 4 },

  /* Rating */
  ratingHero: { alignItems: 'center', marginBottom: 16 },
  ratingBigNum: { fontSize: 44, fontWeight: '900', color: colors.textPrimary },
  ratingStars: { flexDirection: 'row', gap: 4, marginTop: 4 },
  ratingStar: { fontSize: 20, opacity: 0.2 },
  ratingStarFilled: { opacity: 1 },
  ratingSubtext: { fontSize: 13, color: colors.textSecondary, marginTop: 4, fontWeight: '600' },
  ratingBars: { marginBottom: 14 },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  ratingBarLabel: { width: 16, fontSize: 13, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },
  ratingBarBg: { flex: 1, height: 8, backgroundColor: '#F0F0F5', borderRadius: 4, marginHorizontal: 8, overflow: 'hidden' },
  ratingBarFill: { height: 8, borderRadius: 4, backgroundColor: '#F59E0B' },
  ratingBarCount: { width: 20, fontSize: 12, fontWeight: '700', color: colors.textPrimary, textAlign: 'right' },

  reviewCard: {
    backgroundColor: '#F5F5FA', borderRadius: 12, padding: 12, marginBottom: 8,
  },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  reviewStars: { fontSize: 14 },
  reviewDate: { fontSize: 11, color: colors.textSecondary },
  reviewComment: { fontSize: 13, color: colors.textPrimary, lineHeight: 18 },

  noRatingsBox: { alignItems: 'center', paddingVertical: 20 },
  noRatingsText: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginTop: 8 },
  noRatingsDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },

  /* History */
  historyTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, paddingHorizontal: 20, marginBottom: 10, marginTop: 4 },

  /* Delivery Card */
  deliveryCard: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 10,
    backgroundColor: '#FFF', borderRadius: 18, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  deliveryLeft: { marginRight: 12 },
  deliveryIconWrap: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: colors.success + '12',
    alignItems: 'center', justifyContent: 'center',
  },
  deliveryIcon: { fontSize: 20 },
  deliveryCenter: { flex: 1 },
  deliveryCustomer: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  deliveryMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  deliveryDate: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  deliveryRight: { alignItems: 'flex-end' },
  deliveryEarning: { fontSize: 16, fontWeight: '800', color: colors.success },
  deliveryTip: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  /* Empty */
  emptyBox: { padding: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginTop: 10 },
  emptyDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40, maxHeight: '85%',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },

  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  detailTitle: { fontSize: 22, fontWeight: '900', color: colors.textPrimary },
  detailEarningPill: { backgroundColor: colors.success + '15', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
  detailEarningText: { fontSize: 16, fontWeight: '800', color: colors.success },
  detailDate: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },

  breakdownCard: {
    backgroundColor: '#F5F5FA', borderRadius: 16, padding: 14, marginBottom: 16,
  },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  breakdownLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  breakdownVal: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  breakdownDivider: { height: 1, backgroundColor: '#E5E5EA', marginVertical: 6 },
  breakdownTotal: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  breakdownTotalVal: { fontSize: 15, fontWeight: '800', color: colors.success },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  infoIcon: { fontSize: 18, marginRight: 10, marginTop: 2 },
  infoLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginTop: 1 },

  detailSection: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginTop: 8, marginBottom: 10 },

  tlRow: { flexDirection: 'row', marginBottom: 4 },
  tlLeft: { width: 20, alignItems: 'center', marginRight: 8 },
  tlDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5E5EA' },
  tlLine: { width: 2, flex: 1, backgroundColor: '#E5E5EA', marginTop: 2 },
  tlContent: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 8 },
  tlStatus: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, textTransform: 'capitalize' },
  tlTime: { fontSize: 12, color: colors.textSecondary },

  closeModalBtn: {
    backgroundColor: '#F5F5FA', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 16,
  },
  closeModalText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
});
