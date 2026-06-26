import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCartStore } from '../../state/CartStore';
import { useAuthStore } from '../../state/AuthStore';
import { orderService } from '../../services/OrderService';
import { useQueryClient } from '@tanstack/react-query';
import { ORDERS_QUERY_KEY } from '../../hooks/useOrdersQuery';
import { colors, spacing, radii, shadows } from '../../theme/theme';
import { Card } from '../../theme/components/Card';
import { PriceBreakdown } from '../../theme/components/PriceBreakdown';
import { PromoCodeSection } from '../../components/PromoCodeSection';
import type { DeliveryAddress } from '../../models/AppUser';
import type { TipOption } from '../../state/CartStore';

const TIME_SLOTS = [
  '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
  '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM',
  '6:00 PM', '6:30 PM', '7:00 PM',
];

const DELIVERY_NOTES_TEMPLATES = [
  'Leave at door',
  'Ring the doorbell',
  'Call on arrival',
  'Gate code: 1234',
];

const TIP_LABELS: Record<string, string> = {
  none: '0%', five: '5%', ten: '10%', fifteen: '15%', twenty: '20%', custom: 'Custom',
};

const formatAddress = (a: DeliveryAddress) =>
  `${a.street}, ${a.city}, ${a.state} ${a.zip}`;

/* ── Reusable toggle pill ── */
const TogglePill: React.FC<{
  options: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[];
  selected: string;
  onSelect: (key: string) => void;
}> = ({ options, selected, onSelect }) => (
  <View style={st.toggleSection}>
    <View style={st.toggleRow}>
      {options.map(o => {
        const active = o.key === selected;
        return (
          <Pressable
            key={o.key}
            style={[st.toggleBtn, active && st.toggleBtnActive]}
            onPress={() => onSelect(o.key)}
          >
            <Ionicons name={o.icon} size={18} color={active ? colors.textInverse : colors.textSecondary} />
            <Text style={[st.toggleText, active && st.toggleTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  </View>
);

/* ── Chip selector ── */
const ChipRow: React.FC<{
  items: { key: string; label: string }[];
  selected: string | null;
  onSelect: (key: string) => void;
}> = ({ items, selected, onSelect }) => (
  <View style={st.chipGrid}>
    {items.map(c => {
      const active = c.key === selected;
      return (
        <Pressable
          key={c.key}
          style={[st.chip, active && st.chipActive]}
          onPress={() => onSelect(c.key)}
        >
          <Text style={[st.chipText, active && st.chipTextActive]}>{c.label}</Text>
        </Pressable>
      );
    })}
  </View>
);

/* ──── Main Screen ──── */
export const CheckoutScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    items, subtotal, tax, deliveryFee, tipAmount, total,
    promoCode, promoDiscount, deliveryNotes, selectedTip,
    setSelectedTip, applyPromo, removePromo, clear,
  } = useCartStore();
  const queryClient = useQueryClient();

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isDelivery, setIsDelivery] = useState(true);
  const [addressExpanded, setAddressExpanded] = useState(false);
  const [paymentExpanded, setPaymentExpanded] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState(deliveryNotes);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('card');
  const [customTip, setCustomTip] = useState('');
  const [addressError, setAddressError] = useState(false);
  const [outOfZone, setOutOfZone] = useState(false);

  const addresses: DeliveryAddress[] = user?.address ? [user.address] : [];
  const selectedAddress = addresses[0] ?? null;

  const paymentOptions = [
    { id: 'card' as const, label: 'Credit Card •••• 4242' },
    { id: 'cash' as const, label: 'Cash on Delivery' },
  ];

  const tipOptions: TipOption[] = [
    { type: 'none' }, { type: 'five' }, { type: 'ten' }, { type: 'custom', amount: 0 },
  ];

  const handlePlaceOrder = async () => {
    if (!user) { Alert.alert('Error', 'You must be logged in to place an order'); return; }
    if (items.length === 0) { Alert.alert('Error', 'Your cart is empty'); return; }
    if (isDelivery && !selectedAddress) {
      setAddressError(true);
      Alert.alert('No Address', 'Please add a delivery address in your profile before ordering.', [
        { text: 'Add Address', onPress: () => router.push('/customer/addresses' as any) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    if (outOfZone && isDelivery) { Alert.alert('Out of Zone', 'Delivery is not available to your area'); return; }

    setIsPlacingOrder(true);

    const address: DeliveryAddress = isDelivery && selectedAddress
      ? selectedAddress
      : { street: '', city: '', state: '', zip: '', notes: '' };

    const orderId = await orderService.createOrder({
      userId: user.id,
      customerName: user.name,
      items,
      address,
      notes,
      promoCode: promoCode || null,
      tip: isDelivery ? tipAmount() : 0,
      paymentMethod,
      deliveryMethod: isDelivery ? 'delivery' : 'pickup',
    });
    setIsPlacingOrder(false);

    if (orderId) {
      queryClient.invalidateQueries({ queryKey: [...ORDERS_QUERY_KEY] });
      Alert.alert('Order Placed!', `Your order #${orderId.slice(0, 8)} has been placed successfully.`, [
        { text: 'Track Order', onPress: () => { clear(); router.replace(`/customer/order/${orderId}` as any); } },
        { text: 'View All Orders', onPress: () => { clear(); router.replace('/customer/orders'); } },
      ]);
    } else {
      Alert.alert('Order Failed', 'There was an error placing your order. Please try again.');
    }
  };

  const isDisabled = outOfZone && isDelivery;

  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={st.header}>
        <Pressable style={st.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={st.headerTitle}>Checkout</Text>
        <View style={st.headerSpacer} />
      </View>

      <ScrollView
        style={st.scroll}
        contentContainerStyle={[st.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Delivery / Pickup ── */}
        <TogglePill
          options={[
            { key: 'delivery', label: 'Delivery', icon: 'car-outline' },
            { key: 'pickup', label: 'Pickup', icon: 'storefront-outline' },
          ]}
          selected={isDelivery ? 'delivery' : 'pickup'}
          onSelect={k => setIsDelivery(k === 'delivery')}
        />

        {/* ── Address ── */}
        {isDelivery && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>Delivery Address</Text>
            <Pressable
              style={[st.selectionCard, addressError && st.selectionCardError]}
              onPress={() => setAddressExpanded(!addressExpanded)}
            >
              <View style={[st.iconWrap, addressError && st.iconWrapError]}>
                <Ionicons name="location" size={20} color={colors.accent} />
              </View>
              <View style={st.selectionInfo}>
                <Text style={st.selectionLabel}>Home</Text>
                <Text style={st.selectionSub} numberOfLines={1}>
                  {selectedAddress ? formatAddress(selectedAddress) : 'Add address'}
                </Text>
              </View>
              <Ionicons name={addressExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
            </Pressable>
            {addressExpanded && (
              <View style={st.dropdown}>
                {addresses.map((addr, i) => (
                  <Pressable
                    key={i}
                    style={[st.dropdownOpt, selectedAddress === addr && st.dropdownOptSel]}
                    onPress={() => { setAddressExpanded(false); setAddressError(false); }}
                  >
                    <Ionicons name="location" size={16} color={colors.accent} style={{ marginRight: 10 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={st.dropdownLabel}>Address {i + 1}</Text>
                      <Text style={st.dropdownSub}>{formatAddress(addr)}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
            {outOfZone && (
              <View style={st.outOfZone}>
                <Text style={st.outOfZoneText}>Delivery is not available to this address. Please choose pickup or a different address.</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Payment ── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Payment Method</Text>
          <Pressable style={st.selectionCard} onPress={() => setPaymentExpanded(!paymentExpanded)}>
            <View style={st.iconWrap}>
              <Ionicons name="card-outline" size={20} color={colors.accent} />
            </View>
            <View style={st.selectionInfo}>
              <Text style={st.selectionLabel}>
                {paymentOptions.find(p => p.id === paymentMethod)?.label ?? 'Select payment'}
              </Text>
            </View>
            <Ionicons name={paymentExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
          </Pressable>
          {paymentExpanded && (
            <View style={st.dropdown}>
              {paymentOptions.map(opt => (
                <Pressable
                  key={opt.id}
                  style={[st.dropdownOpt, paymentMethod === opt.id && st.dropdownOptSel]}
                  onPress={() => { setPaymentMethod(opt.id); setPaymentExpanded(false); }}
                >
                  <Text style={st.dropdownLabel}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ── Schedule ── */}
        <View style={st.section}>
          <Text style={st.sectionTitle}>Schedule</Text>
          <TogglePill
            options={[
              { key: 'asap', label: 'ASAP (30-45 min)', icon: 'time-outline' },
              { key: 'schedule', label: 'Schedule', icon: 'time-outline' },
            ]}
            selected={isScheduled ? 'schedule' : 'asap'}
            onSelect={k => { setIsScheduled(k === 'schedule'); if (k === 'asap') setSelectedSlot(null); }}
          />
          {isScheduled && (
            <ChipRow
              items={TIME_SLOTS.map(s => ({ key: s, label: s }))}
              selected={selectedSlot}
              onSelect={setSelectedSlot}
            />
          )}
        </View>

        {/* ── Delivery Notes ── */}
        {isDelivery && (
          <View style={st.section}>
            <Card>
              <TextInput
                style={st.notesInput}
                placeholder="Add delivery instructions..."
                placeholderTextColor={colors.textSecondary}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
              <View style={st.templateChips}>
                {DELIVERY_NOTES_TEMPLATES.map((t, i) => (
                  <Pressable key={i} style={st.templateChip} onPress={() => setNotes(t)}>
                    <Text style={st.templateChipText}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          </View>
        )}

        {/* ── Tip ── */}
        {isDelivery && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>Tip</Text>
            <ChipRow
              items={tipOptions.map(o => ({ key: o.type, label: TIP_LABELS[o.type] ?? o.type }))}
              selected={selectedTip.type}
              onSelect={k => {
                const opt = tipOptions.find(o => o.type === k);
                if (opt) setSelectedTip(opt);
              }}
            />
            {selectedTip.type === 'custom' && (
              <View style={st.customTipRow}>
                <Text style={st.customTipPrefix}>$</Text>
                <TextInput
                  style={st.customTipInput}
                  placeholder="0.00"
                  value={customTip}
                  onChangeText={v => {
                    setCustomTip(v);
                    setSelectedTip({ type: 'custom', amount: parseFloat(v) || 0 });
                  }}
                  keyboardType="decimal-pad"
                />
              </View>
            )}
          </View>
        )}

        {/* ── Promo ── */}
        <View style={st.section}>
          <PromoCodeSection
            promoCode={promoCode}
            promoDiscount={promoDiscount}
            onApply={applyPromo}
            onRemove={removePromo}
          />
        </View>

        {/* ── Order Summary ── */}
        <Card>
          <Text style={st.summaryTitle}>Order Summary</Text>
          {items.map(item => {
            const unitPrice = item.menuItem.price +
              Object.values(item.selectedModifiers).flat().reduce((sum, optId) => {
                const grp = item.menuItem.modifierGroups.find(g => g.options.some(o => o.id === optId));
                return sum + (grp?.options.find(o => o.id === optId)?.priceAdjustment ?? 0);
              }, 0);
            return (
              <View key={item.id} style={st.itemRow}>
                <Text style={st.itemQty}>{item.quantity}</Text>
                <Text style={st.itemName} numberOfLines={1}>{item.menuItem.name}</Text>
                <Text style={st.itemPrice}>${(unitPrice * item.quantity).toFixed(2)}</Text>
              </View>
            );
          })}
          <View style={st.divider} />
          <PriceBreakdown
            subtotal={subtotal()}
            tax={tax()}
            deliveryFee={deliveryFee()}
            tip={isDelivery ? tipAmount() : 0}
            discount={promoDiscount}
            total={total()}
          />
        </Card>
      </ScrollView>

      {/* ── Sticky Footer ── */}
      <View style={[st.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          style={({ pressed }) => [
            st.ctaBtn,
            isDisabled && st.ctaBtnDisabled,
            pressed && !isDisabled && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
          onPress={handlePlaceOrder}
          disabled={isDisabled || isPlacingOrder}
        >
          {isPlacingOrder ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <>
              <Text style={st.ctaText}>Confirm Order</Text>
              <View style={st.ctaBadge}>
                <Text style={st.ctaBadgeText}>${total().toFixed(2)}</Text>
              </View>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  /* Header */
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.cardBackground,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm + 4,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: radii.small + 2,
    backgroundColor: colors.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  headerSpacer: { width: 44, height: 44 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  /* Toggle */
  toggleSection: { backgroundColor: colors.cardBackground, borderRadius: radii.medium, padding: spacing.xs, marginBottom: spacing.lg },
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: 14, borderRadius: radii.small + 1,
  },
  toggleBtnActive: { backgroundColor: colors.accent },
  toggleText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  toggleTextActive: { color: colors.textInverse },

  /* Section */
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 },

  /* Selection card */
  selectionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.cardBackground, borderRadius: radii.small + 2,
    padding: 14, gap: spacing.sm + 4,
  },
  selectionCardError: { borderWidth: 1.5, borderColor: colors.danger },
  iconWrap: {
    width: 40, height: 40, borderRadius: radii.small,
    backgroundColor: colors.warningLight, alignItems: 'center', justifyContent: 'center',
  },
  iconWrapError: { backgroundColor: colors.dangerLight },
  selectionInfo: { flex: 1 },
  selectionLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  selectionSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  /* Dropdown */
  dropdown: { backgroundColor: colors.cardBackground, borderRadius: radii.small + 2, marginTop: spacing.sm, overflow: 'hidden' },
  dropdownOpt: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  dropdownOptSel: { backgroundColor: colors.warningLight },
  dropdownLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  dropdownSub: { fontSize: 13, color: colors.textSecondary },

  outOfZone: { backgroundColor: colors.warningLight, borderRadius: radii.xs + 2, paddingHorizontal: spacing.sm + 4, paddingVertical: 10, marginTop: spacing.sm },
  outOfZoneText: { fontSize: 13, color: colors.warning, fontWeight: '500' },

  /* Chips */
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm + 4 },
  chip: {
    backgroundColor: colors.cardBackground, borderRadius: radii.xs + 2,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipActive: { backgroundColor: colors.warningLight, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },
  chipTextActive: { color: colors.accent, fontWeight: '600' },

  /* Notes */
  notesInput: { fontSize: 14, minHeight: 50, color: colors.textPrimary },
  templateChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  templateChip: { backgroundColor: colors.borderLight, paddingHorizontal: spacing.sm + 4, paddingVertical: spacing.sm, borderRadius: radii.xs + 2 },
  templateChipText: { fontSize: 13, fontWeight: '500', color: colors.textPrimary },

  /* Custom tip */
  customTipRow: {
    flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm + 4,
    backgroundColor: colors.cardBackground, borderRadius: radii.small + 2,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4,
    borderWidth: 1.5, borderColor: colors.accent,
  },
  customTipPrefix: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginRight: spacing.xs },
  customTipInput: { flex: 1, fontSize: 16, color: colors.textPrimary, padding: 0 },

  /* Summary */
  summaryTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 14 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  itemQty: { fontSize: 14, fontWeight: '600', color: colors.accent, width: 30 },
  itemName: { flex: 1, fontSize: 14, color: colors.textPrimary },
  itemPrice: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm + 4 },

  /* Footer */
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.cardBackground, paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    ...shadows.xl,
  },
  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm + 4, backgroundColor: colors.accent,
    borderRadius: radii.button, paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
  },
  ctaBtnDisabled: { backgroundColor: colors.border },
  ctaText: { color: colors.textInverse, fontSize: 16, fontWeight: '700' },
  ctaBadge: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: radii.small, paddingHorizontal: spacing.sm + 4, paddingVertical: spacing.xs },
  ctaBadgeText: { color: colors.textInverse, fontSize: 14, fontWeight: '700' },
});
