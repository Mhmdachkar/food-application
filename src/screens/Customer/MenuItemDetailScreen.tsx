import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { PLACEHOLDER_BLURHASH, IMAGE_TRANSITION_MS } from '../../constants/images';
import { useCartStore } from '../../state/CartStore';
import { colors, spacing, radii } from '../../theme/theme';
import { Button } from '../../theme/components/Button';
import { Chip } from '../../theme/components/Chip';
import type { MenuItem } from '../../models/MenuItem';

interface Props {
  item: MenuItem;
  onClose: () => void;
}

export const MenuItemDetailScreen: React.FC<Props> = ({ item, onClose }) => {
  const { addItem } = useCartStore();
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [instructions, setInstructions] = useState('');

  const toggleModifier = (groupId: string, optionId: string, maxSelections: number) => {
    setSelectedModifiers(prev => {
      const current = prev[groupId] ?? [];
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter(id => id !== optionId) };
      }
      if (current.length >= maxSelections) {
        return { ...prev, [groupId]: [...current.slice(1), optionId] };
      }
      return { ...prev, [groupId]: [...current, optionId] };
    });
  };

  const modifierTotal = Object.entries(selectedModifiers).reduce((sum, [groupId, optionIds]) => {
    const group = item.modifierGroups.find(g => g.id === groupId);
    if (!group) return sum;
    return sum + optionIds.reduce((s, oid) => {
      const opt = group.options.find(o => o.id === oid);
      return s + (opt?.priceAdjustment ?? 0);
    }, 0);
  }, 0);

  const totalPrice = (item.price + modifierTotal) * quantity;

  const handleAdd = () => {
    addItem(item, quantity, selectedModifiers, instructions);
    onClose();
  };

  return (
    <ScrollView style={styles.container}>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.heroImage} placeholder={{ blurhash: PLACEHOLDER_BLURHASH }} transition={IMAGE_TRANSITION_MS} contentFit="cover" />
      ) : (
        <View style={styles.heroPlaceholder} />
      )}

      <View style={styles.content}>
        {/* Category & Tags */}
        <View style={styles.tagRow}>
          <Chip label={item.category} />
          {item.isLimitedTime && <Chip label="Limited Time" />}
        </View>

        <Text style={styles.name}>{item.name}</Text>

        {/* Rating & Info */}
        <View style={styles.infoRow}>
          <Text style={styles.rating}>⭐ {item.rating.toFixed(1)} ({item.reviewCount})</Text>
          <Text style={styles.infoText}>~{item.prepTimeMinutes} min</Text>
          <Text style={styles.infoText}>{item.calories} cal</Text>
        </View>

        <Text style={styles.price}>${item.price.toFixed(2)}</Text>
        <Text style={styles.description}>{item.description}</Text>

        {/* Modifier Groups */}
        {item.modifierGroups.map(group => (
          <View key={group.id} style={styles.modGroup}>
            <Text style={styles.modGroupTitle}>
              {group.name} {group.required ? '(Required)' : '(Optional)'}
            </Text>
            <Text style={styles.modGroupSub}>Select up to {group.maxSelections}</Text>
            {group.options.map(option => {
              const isSelected = (selectedModifiers[group.id] ?? []).includes(option.id);
              return (
                <Pressable
                  key={option.id}
                  style={[styles.modOption, isSelected && styles.modOptionSelected]}
                  onPress={() => toggleModifier(group.id, option.id, group.maxSelections)}
                >
                  <Text style={[styles.modOptionText, isSelected && styles.modOptionTextSelected]}>
                    {option.name}
                  </Text>
                  {option.priceAdjustment > 0 && (
                    <Text style={[styles.modOptionPrice, isSelected && styles.modOptionTextSelected]}>
                      +${option.priceAdjustment.toFixed(2)}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}

        {/* Allergens */}
        {item.allergens.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Allergens</Text>
            <View style={styles.tagRow}>
              {item.allergens.map((a, i) => <Chip key={i} label={a} />)}
            </View>
          </View>
        )}

        {/* Nutrition */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nutrition</Text>
          <View style={styles.nutritionGrid}>
            {[
              { label: 'Calories', value: `${item.nutritionInfo.calories}` },
              { label: 'Protein', value: `${item.nutritionInfo.protein}g` },
              { label: 'Carbs', value: `${item.nutritionInfo.carbs}g` },
              { label: 'Fat', value: `${item.nutritionInfo.fat}g` },
              { label: 'Fiber', value: `${item.nutritionInfo.fiber}g` },
              { label: 'Sugar', value: `${item.nutritionInfo.sugar}g` },
            ].map(n => (
              <View key={n.label} style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{n.value}</Text>
                <Text style={styles.nutritionLabel}>{n.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quantity Selector */}
        <View style={styles.quantityRow}>
          <Pressable style={styles.qtyButton} onPress={() => setQuantity(Math.max(1, quantity - 1))}>
            <Text style={styles.qtyButtonText}>−</Text>
          </Pressable>
          <Text style={styles.qtyText}>{quantity}</Text>
          <Pressable style={styles.qtyButton} onPress={() => setQuantity(quantity + 1)}>
            <Text style={styles.qtyButtonText}>+</Text>
          </Pressable>
        </View>

        <Button
          title={`Add to Cart — $${totalPrice.toFixed(2)}`}
          onPress={handleAdd}
          style={{ marginBottom: spacing.lg }}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heroImage: { width: '100%', height: 220 },
  heroPlaceholder: { width: '100%', height: 220, backgroundColor: colors.border },
  content: { padding: spacing.lg },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  name: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.sm },
  infoRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  rating: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  infoText: { fontSize: 14, color: colors.textSecondary },
  price: { fontSize: 22, fontWeight: '800', color: colors.accent, marginBottom: spacing.sm },
  description: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.lg },
  modGroup: { marginBottom: spacing.lg },
  modGroupTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  modGroupSub: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm },
  modOption: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md, borderRadius: radii.small, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xs, backgroundColor: colors.cardBackground },
  modOptionSelected: { borderColor: colors.accent, backgroundColor: '#FFF3E6' },
  modOptionText: { fontSize: 14, color: colors.textPrimary },
  modOptionTextSelected: { color: colors.accent, fontWeight: '600' },
  modOptionPrice: { fontSize: 14, color: colors.textSecondary },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  nutritionItem: { width: '30%', backgroundColor: colors.cardBackground, borderRadius: radii.small, padding: spacing.sm, alignItems: 'center' },
  nutritionValue: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  nutritionLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  qtyButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  qtyButtonText: { color: '#FFFFFF', fontSize: 22, fontWeight: '600' },
  qtyText: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginHorizontal: spacing.lg, minWidth: 40, textAlign: 'center' },
});
