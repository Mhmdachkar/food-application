import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../state/CartStore';
import { useUpsellStore } from '../../state/UpsellStore';
import { useMenuQuery } from '../../hooks/useMenuQuery';
import { colors, spacing, radii, shadows } from '../../theme/theme';
import { Card } from '../../theme/components/Card';
import { CartItemCard } from '../../components/CartItemCard';
import { PromoCodeSection } from '../../components/PromoCodeSection';
import { UpsellRow } from '../../components/UpsellRow';
import { FreeDeliveryProgress } from '../../components/FreeDeliveryProgress';
import { SavingsCard } from '../../components/SavingsCard';
import { PriceBreakdown } from '../../theme/components/PriceBreakdown';

export const CartScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    items,
    subtotal,
    tax,
    deliveryFee,
    total,
    promoCode,
    promoDiscount,
    isEmpty,
    removeItem,
    updateQuantity,
    clear,
    addItem,
    applyPromo,
    removePromo,
  } = useCartStore();
  const { data: menuItems = [] } = useMenuQuery();
  const { suggestions, generateSuggestions, dismiss } = useUpsellStore();

  useEffect(() => {
    if (items.length > 0 && menuItems.length > 0) {
      generateSuggestions(items, menuItems);
    }
  }, [items.length, menuItems.length]);

  // ── Empty state ──
  if (isEmpty()) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <Text style={s.headerTitle}>My Cart</Text>
        </View>
        <View style={s.emptyState}>
          <View style={s.emptyIcon}>
            <Ionicons name="bag-outline" size={48} color={colors.textSecondary} />
          </View>
          <Text style={s.emptyTitle}>Your cart is empty</Text>
          <Text style={s.emptyMsg}>Add some delicious food to get started</Text>
          <Pressable
            style={({ pressed }) => [s.browseBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/customer/home')}
          >
            <Text style={s.browseBtnText}>Browse Menu</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.headerTitle}>My Cart</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>{items.length}</Text>
          </View>
        </View>
        <Pressable onPress={clear} hitSlop={8}>
          <Text style={s.clearText}>Clear all</Text>
        </Pressable>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <FreeDeliveryProgress subtotal={subtotal()} />

        {/* ── Cart Items ── */}
        {items.map(item => (
          <CartItemCard
            key={item.id}
            item={item}
            onUpdateQty={updateQuantity}
            onRemove={removeItem}
          />
        ))}

        {/* ── Upsell ── */}
        <UpsellRow
          suggestions={suggestions}
          onAdd={item => addItem(item, 1)}
          onDismiss={dismiss}
        />

        {/* ── Promo Code ── */}
        <PromoCodeSection
          promoCode={promoCode}
          promoDiscount={promoDiscount}
          onApply={applyPromo}
          onRemove={removePromo}
        />

        {/* ── Savings ── */}
        <SavingsCard
          promoDiscount={promoDiscount}
          freeDeliverySaved={subtotal() >= 35 ? 3.99 : 0}
        />

        {/* ── Delivery Estimate ── */}
        <View style={s.deliveryRow}>
          <Ionicons name="time-outline" size={18} color={colors.accent} />
          <View style={s.deliveryText}>
            <Text style={s.deliveryLabel}>Estimated delivery</Text>
            <Text style={s.deliveryTime}>30-45 min</Text>
          </View>
          <Ionicons name="bicycle-outline" size={20} color={colors.textSecondary} />
        </View>

        {/* ── Order Summary ── */}
        <Card style={s.summaryCard}>
          <Text style={s.summaryTitle}>Order Summary</Text>
          <PriceBreakdown
            subtotal={subtotal()}
            tax={tax()}
            deliveryFee={deliveryFee()}
            tip={0}
            discount={promoDiscount}
            total={total()}
          />
        </Card>
      </ScrollView>

      {/* ── Sticky Footer ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [s.ctaBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          onPress={() => router.push('/customer/checkout')}
        >
          <Text style={s.ctaText}>Proceed to Checkout</Text>
          <View style={s.ctaBadge}>
            <Text style={s.ctaBadgeText}>${total().toFixed(2)}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 12, fontWeight: '800', color: colors.textInverse },
  clearText: { fontSize: 14, fontWeight: '600', color: colors.danger },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },

  /* Empty */
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },
  emptyIcon: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.borderLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs },
  emptyMsg: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
  browseBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.button,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
  },
  browseBtnText: { color: colors.textInverse, fontSize: 15, fontWeight: '700' },

  /* Delivery Estimate */
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: radii.small + 2,
    padding: 14,
    marginBottom: spacing.sm + 4,
  },
  deliveryText: { flex: 1, marginLeft: 10 },
  deliveryLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  deliveryTime: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 1 },

  /* Summary */
  summaryCard: { marginBottom: spacing.md },
  summaryTitle: {
    fontSize: 16, fontWeight: '700',
    color: colors.textPrimary, marginBottom: spacing.sm + 4,
  },

  /* Footer */
  footer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.cardBackground,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    ...shadows.xl,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm + 4,
    backgroundColor: colors.accent,
    borderRadius: radii.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  ctaText: { color: colors.textInverse, fontSize: 16, fontWeight: '700' },
  ctaBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: radii.small,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
  },
  ctaBadgeText: { color: colors.textInverse, fontSize: 14, fontWeight: '700' },
});
