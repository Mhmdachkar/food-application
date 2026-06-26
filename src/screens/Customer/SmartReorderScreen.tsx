import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Animated, Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSmartReorderStore, type ReorderSuggestion } from '../../state/SmartReorderStore';
import { useMenuQuery } from '../../hooks/useMenuQuery';
import { useOrdersQuery } from '../../hooks/useOrdersQuery';
import { useCartStore } from '../../state/CartStore';
import { useAuthStore } from '../../state/AuthStore';
import { colors, spacing, radii } from '../../theme/theme';

const SuggestionCard: React.FC<{
  suggestion: ReorderSuggestion;
  onAdd: (s: ReorderSuggestion) => void;
  index: number;
}> = ({ suggestion, onAdd, index }) => {
  const slideIn = useRef(new Animated.Value(40)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideIn, { toValue: 0, duration: 400, delay: index * 100, easing: Easing.out(Easing.exp), useNativeDriver: true }),
      Animated.timing(fadeIn, { toValue: 1, duration: 400, delay: index * 100, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[s.card, { opacity: fadeIn, transform: [{ translateY: slideIn }] }]}>
      <View style={s.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardName}>{suggestion.item.name}</Text>
          <Text style={s.cardReason}>{suggestion.reason}</Text>
          <Text style={s.cardPrice}>${suggestion.item.price.toFixed(2)} × {suggestion.adjustedQuantity}</Text>
        </View>
        <View style={s.cardRight}>
          <View style={s.qtyBadge}>
            <Text style={s.qtyText}>{suggestion.adjustedQuantity}</Text>
          </View>
        </View>
      </View>

      {suggestion.suggestedSides.length > 0 && (
        <View style={s.sidesRow}>
          <Text style={s.sidesLabel}>{'\uD83D\uDCA1'} Usually paired with:</Text>
          {suggestion.suggestedSides.map(side => (
            <View key={side.id} style={s.sideChip}>
              <Text style={s.sideChipText}>{side.name}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
        style={({ pressed }) => [s.addBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
        onPress={() => onAdd(suggestion)}
      >
        <Text style={s.addBtnText}>Quick Add to Cart</Text>
        <Text style={s.addBtnArrow}>{'\u2192'}</Text>
      </Pressable>
    </Animated.View>
  );
};

export const SmartReorderScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { data: menuItems = [] } = useMenuQuery();
  const { data: orders = [] } = useOrdersQuery(user?.id, 'customer');
  const { analyzeOrders, getSuggestions, isLoaded, load } = useSmartReorderStore();
  const { addItem } = useCartStore();

  useEffect(() => { if (!isLoaded) load(); }, [isLoaded, load]);
  useEffect(() => { if (orders.length > 0) analyzeOrders(orders); }, [orders]);

  const suggestions = getSuggestions(menuItems);

  const handleAdd = (s: ReorderSuggestion) => {
    addItem(s.item, s.adjustedQuantity);
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Text style={s.title}>{'\uD83E\uDDE0'} Smart Reorder</Text>
        <Text style={s.subtitle}>Based on your ordering patterns</Text>
      </View>

      {suggestions.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>{'\uD83D\uDCCA'}</Text>
          <Text style={s.emptyTitle}>Learning your preferences</Text>
          <Text style={s.emptyDesc}>
            Order a few more times and we'll start suggesting your favorites with smart adjustments.
          </Text>
        </View>
      ) : (
        <FlatList
          data={suggestions}
          keyExtractor={(item) => item.item.id}
          renderItem={({ item, index }) => (
            <SuggestionCard suggestion={item} onAdd={handleAdd} index={index} />
          )}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  card: {
    backgroundColor: colors.cardBackground, borderRadius: radii.large, padding: spacing.md,
    marginBottom: spacing.sm, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardTop: { flexDirection: 'row', marginBottom: spacing.sm },
  cardName: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  cardReason: { fontSize: 13, color: colors.accent, fontWeight: '600', marginTop: 4 },
  cardPrice: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  cardRight: { alignItems: 'center', justifyContent: 'center', marginLeft: spacing.md },
  qtyBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent + '15', alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 18, fontWeight: '800', color: colors.accent },
  sidesRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.xs },
  sidesLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginRight: spacing.xs },
  sideChip: { backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  sideChipText: { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row', backgroundColor: colors.accent, borderRadius: radii.button,
    paddingVertical: 12, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  addBtnArrow: { color: '#FFF', fontSize: 18, marginLeft: spacing.sm },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: spacing.xl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  emptyDesc: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
