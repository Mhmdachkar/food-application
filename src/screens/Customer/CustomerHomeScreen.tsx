import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMenuQuery } from '../../hooks/useMenuQuery';
import { useOrdersQuery } from '../../hooks/useOrdersQuery';
import { EmptyState } from '../../theme/components/EmptyState';
import { HomeSkeleton } from '../../components/skeletons/HomeSkeleton';
import { useCartStore } from '../../state/CartStore';
import { useAuthStore } from '../../state/AuthStore';
import { useRecentlyViewed } from '../../providers/RecentlyViewedProvider';
import { colors, spacing, radii, shadows } from '../../theme/theme';
import type { MenuItem } from '../../models/MenuItem';
import { CAT_EMOJI } from '../../constants/categories';
import { FoodCard } from '../../components/FoodCard';
import { FlashDealCard } from '../../components/FlashDealCard';
import { QuickReorderCard } from '../../components/QuickReorderCard';
import { TopPicksCard } from '../../components/TopPicksCard';
import { RecentlyViewedRow } from '../../components/RecentlyViewedRow';
import { SearchBar } from '../../components/SearchBar';
import { buildFlashDeals, popularNowItems } from '../../mocks/deals';

const QUICK_ACTIONS = [
  { icon: 'mic-outline' as const, label: 'Voice Order', route: '/voice/call', color: '#845EF7' },
  { icon: 'heart-outline' as const, label: 'Favorites', route: '/customer/favorites', color: '#FF4757' },
  { icon: 'repeat-outline' as const, label: 'Reorder', route: '/customer/reorder', color: '#20C997' },
  { icon: 'gift-outline' as const, label: 'Rewards', route: '/customer/loyalty', color: '#FF922B' },
];

/* ──── Main Screen ──── */
export const CustomerHomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, role } = useAuthStore();
  const { data: menuItems = [], isLoading: menuLoading, isError: menuError, refetch: refetchMenu } = useMenuQuery();
  const { data: orders = [] } = useOrdersQuery(user?.id, role);
  const { addItem, itemCount, total } = useCartStore();
  const { recentItems } = useRecentlyViewed();

  const headerOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerOp, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const topRated = useMemo(
    () => menuItems.filter(i => i.isAvailable).sort((a, b) => b.rating - a.rating).slice(0, 10),
    [menuItems],
  );

  const categories = useMemo(() => {
    const cats = [...new Set(menuItems.filter(i => i.isAvailable).map(i => i.category))];
    return cats.slice(0, 8);
  }, [menuItems]);

  const activeOrders = useMemo(
    () => orders.filter(o => !['DELIVERED', 'CANCELED'].includes(o.status)),
    [orders],
  );

  const lastDelivered = useMemo(() => orders.find(o => o.status === 'DELIVERED'), [orders]);
  const flashDeals = useMemo(() => buildFlashDeals(menuItems), [menuItems]);

  const topPicks = useMemo(
    () => menuItems.filter(i => i.isAvailable && i.rating >= 4.6).sort((a, b) => b.rating - a.rating).slice(0, 5),
    [menuItems],
  );

  const popularNowMap = useMemo(() => {
    const map = new Map<string, number>();
    popularNowItems.forEach(p => map.set(p.foodId, p.ordersInLastHour));
    return map;
  }, []);

  const count = itemCount();
  const goToItem = (item: MenuItem) => router.push(`/customer/menu-item/${item.id}` as any);

  if (menuLoading && menuItems.length === 0) {
    return <HomeSkeleton />;
  }

  if (menuError && menuItems.length === 0) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <EmptyState
          title="Couldn't load the menu"
          message="Please check your connection and try again."
        />
        <TouchableOpacity style={s.retryBtn} onPress={() => refetchMenu()}>
          <Text style={s.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <FlatList
        data={topRated}
        keyExtractor={item => item.id}
        numColumns={2}
        columnWrapperStyle={s.foodRow}
        renderItem={({ item, index }) => (
          <FoodCard item={item} index={index} onAdd={i => addItem(i, 1)} onPress={goToItem} />
        )}
        contentContainerStyle={[s.listContent, { paddingBottom: count > 0 ? 110 : 40 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Animated.View style={{ opacity: headerOp }}>
            {/* ── Header: Location + Icons ── */}
            <View style={s.headerBar}>
              <Pressable style={s.locationBtn} onPress={() => router.push('/customer/addresses' as any)}>
                <Ionicons name="location" size={18} color={colors.accent} />
                <View style={s.locationText}>
                  <Text style={s.locationLabel}>Deliver to</Text>
                  <Text style={s.locationAddress} numberOfLines={1}>
                    {user?.address?.street ?? user?.address?.city ?? 'Set your address'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
              </Pressable>
              <Pressable style={s.iconBtn} onPress={() => router.push('/customer/notifications' as any)}>
                <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            {/* ── Search ── */}
            <SearchBar menuItems={menuItems} onSelectItem={goToItem} />

            {/* ── Active Order Tracker ── */}
            {activeOrders.length > 0 && (
              <Pressable style={s.liveOrderCard} onPress={() => router.push(`/customer/order/${activeOrders[0].id}` as any)}>
                <View style={s.liveOrderDot} />
                <View style={s.liveOrderContent}>
                  <Text style={s.liveOrderTitle}>Order in progress</Text>
                  <Text style={s.liveOrderSub}>
                    {activeOrders[0].status.replace(/_/g, ' ')} {'\u00B7'} {activeOrders[0].items.length} item{activeOrders[0].items.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.success} />
              </Pressable>
            )}

            {/* ── Categories Grid ── */}
            <View style={s.catGrid}>
              {categories.map(cat => (
                <Pressable key={cat} style={s.catItem} onPress={() => router.push({ pathname: '/customer/categories' as any, params: { category: cat } })}>
                  <View style={s.catIconWrap}>
                    <Text style={s.catEmoji}>{CAT_EMOJI[cat] ?? '\uD83C\uDF7D\uFE0F'}</Text>
                  </View>
                  <Text style={s.catName}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
                </Pressable>
              ))}
            </View>

            {/* ── Quick Actions Row ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickRow}>
              {QUICK_ACTIONS.map(a => (
                <Pressable
                  key={a.label}
                  style={({ pressed }) => [s.quickAction, pressed && s.pressed]}
                  onPress={() => router.push(a.route as any)}
                >
                  <View style={[s.quickIconWrap, { backgroundColor: a.color + '15' }]}>
                    <Ionicons name={a.icon} size={20} color={a.color} />
                  </View>
                  <Text style={s.quickLabel}>{a.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* ── Flash Deals ── */}
            {flashDeals.length > 0 && (
              <>
                <View style={s.sectionRow}>
                  <Text style={s.sectionTitle}>Flash Deals</Text>
                  <View style={s.dealBadge}>
                    <Ionicons name="flash" size={12} color={colors.accent} />
                    <Text style={s.dealBadgeText}>Limited</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScrollRow}>
                  {flashDeals.map(deal => <FlashDealCard key={deal.id} deal={deal} onAdd={d => addItem(d.food, 1)} />)}
                </ScrollView>
              </>
            )}

            {/* ── Quick Reorder ── */}
            {lastDelivered && (
              <>
                <View style={s.sectionRow}><Text style={s.sectionTitle}>Order Again</Text></View>
                <QuickReorderCard
                  order={lastDelivered}
                  onReorder={o => {
                    o.items.forEach(ci => addItem(ci.menuItem, ci.quantity, ci.selectedModifiers, ci.specialInstructions));
                    router.push('/customer/cart' as any);
                  }}
                />
              </>
            )}

            {/* ── Top Picks ── */}
            {topPicks.length > 0 && (
              <>
                <View style={s.sectionRow}><Text style={s.sectionTitle}>Top Picks Today</Text></View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScrollRow}>
                  {topPicks.map(item => (
                    <TopPicksCard key={item.id} item={item} ordersInLastHour={popularNowMap.get(item.id)} onPress={goToItem} />
                  ))}
                </ScrollView>
              </>
            )}

            {/* ── Recently Viewed ── */}
            <RecentlyViewedRow items={recentItems} onPress={goToItem} />

            {/* ── Popular Near You header ── */}
            <View style={s.sectionRow}>
              <Text style={s.sectionTitle}>Popular Near You</Text>
              <Pressable onPress={() => router.push('/customer/categories' as any)}>
                <Text style={s.seeAll}>See all</Text>
              </Pressable>
            </View>
          </Animated.View>
        }
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Ionicons name="fast-food-outline" size={48} color={colors.textSecondary} />
            <Text style={s.emptyText}>No items available right now</Text>
          </View>
        }
      />

      {/* ── Floating Cart Bar ── */}
      {count > 0 && (
        <Pressable
          style={({ pressed }) => [s.cartBar, pressed && s.cartBarPressed, { bottom: insets.bottom + 80 }]}
          onPress={() => router.push('/customer/cart' as any)}
        >
          <View style={s.cartBarLeft}>
            <View style={s.cartBadge}><Text style={s.cartBadgeNum}>{count}</Text></View>
            <Text style={s.cartBarTitle}>View Cart</Text>
          </View>
          <Text style={s.cartBarTotal}>${total().toFixed(2)}</Text>
        </Pressable>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: 100 },
  foodRow: { justifyContent: 'space-between' },
  pressed: { opacity: 0.7 },

  /* Header */
  headerBar: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, paddingVertical: spacing.sm },
  locationBtn: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  locationText: { flex: 1, marginLeft: spacing.sm },
  locationLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
  locationAddress: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  iconBtn: {
    width: 40, height: 40, borderRadius: radii.round,
    backgroundColor: colors.cardBackground, alignItems: 'center', justifyContent: 'center',
    ...shadows.sm,
  },

  /* Live Order */
  liveOrderCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.successLight, borderRadius: radii.small, padding: spacing.sm + 4,
    marginBottom: 14, marginTop: spacing.xs,
  },
  liveOrderDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success, marginRight: 10 },
  liveOrderContent: { flex: 1 },
  liveOrderTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  liveOrderSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  /* Categories Grid */
  catGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: spacing.md, marginTop: spacing.sm,
  },
  catItem: { width: '24%', alignItems: 'center', marginBottom: spacing.sm + 4 },
  catIconWrap: {
    width: 52, height: 52, borderRadius: radii.medium,
    backgroundColor: colors.cardBackground,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.sm,
  },
  catEmoji: { fontSize: 24 },
  catName: { fontSize: 11, fontWeight: '600', color: colors.textPrimary, marginTop: 6, textAlign: 'center' },

  /* Quick Actions */
  quickRow: { gap: spacing.sm + 4, paddingBottom: spacing.md },
  quickAction: { alignItems: 'center', width: 72 },
  quickIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  quickLabel: { fontSize: 10, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },

  /* Sections */
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  seeAll: { fontSize: 13, fontWeight: '600', color: colors.accent },
  hScrollRow: { gap: 10, paddingBottom: 14 },
  dealBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.warningLight, borderRadius: radii.xs, paddingHorizontal: spacing.sm, paddingVertical: 3, gap: 3,
  },
  dealBadgeText: { fontSize: 11, fontWeight: '700', color: colors.accent },

  /* Empty */
  emptyBox: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: colors.textSecondary, marginTop: 10 },

  /* Cart Bar */
  cartBar: {
    position: 'absolute', left: spacing.md, right: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 14,
    borderRadius: radii.medium,
    shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  cartBarPressed: { transform: [{ scale: 0.98 }] },
  cartBarLeft: { flexDirection: 'row', alignItems: 'center' },
  cartBadge: {
    backgroundColor: colors.cardBackground, width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  cartBadgeNum: { fontSize: 12, fontWeight: '900', color: colors.accent },
  cartBarTitle: { fontSize: 15, fontWeight: '700', color: colors.textInverse },
  cartBarTotal: { fontSize: 15, fontWeight: '800', color: colors.textInverse },
  retryBtn: {
    alignSelf: 'center', marginTop: spacing.lg,
    backgroundColor: colors.accent, paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 4, borderRadius: radii.button,
  },
  retryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});

