import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, radii, spacing, shadows, typography } from '../../../src/theme/theme';
import { IconButton } from '../../../src/theme/components/IconButton';
import { Button } from '../../../src/theme/components/Button';
import { Chip } from '../../../src/theme/components/Chip';
import { Badge } from '../../../src/theme/components/Badge';
import { useCartStore } from '../../../src/state/CartStore';
import { useMenuQuery } from '../../../src/hooks/useMenuQuery';
import { useRecentlyViewed } from '../../../src/providers/RecentlyViewedProvider';
import type { MenuItem, ModifierGroup } from '../../../src/models/MenuItem';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.35;

export default function MenuItemDetailScreen() {
  const params = useLocalSearchParams<{ itemId: string }>();
  const { data: menuItems = [], isLoading } = useMenuQuery();
  const { addItem } = useCartStore();
  const { trackView } = useRecentlyViewed();

  const item = menuItems.find(m => m.id === params.itemId);

  useEffect(() => {
    if (params.itemId) {
      trackView(params.itemId);
    }
  }, [params.itemId]);

  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({});
  const [specialInstructions, setSpecialInstructions] = useState('');

  if (isLoading) {
    return (
      <View style={styles.errorContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
        <Text style={styles.errorText}>Item not found</Text>
        <Button title="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

  const handleModifierToggle = (groupId: string, optionId: string, group: ModifierGroup) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setSelectedModifiers(prev => {
      const current = prev[groupId] || [];
      
      if (group.maxSelections === 1) {
        // Single select - replace
        return { ...prev, [groupId]: [optionId] };
      } else {
        // Multi-select
        const isSelected = current.includes(optionId);
        
        if (isSelected) {
          // Deselect
          return { ...prev, [groupId]: current.filter(id => id !== optionId) };
        } else {
          // Select (if under max)
          if (group.maxSelections && current.length >= group.maxSelections) {
            return prev; // Max reached
          }
          return { ...prev, [groupId]: [...current, optionId] };
        }
      }
    });
  };

  const calculateTotalPrice = () => {
    let total = item.price;
    
    item.modifierGroups.forEach(group => {
      const selected = selectedModifiers[group.id] || [];
      selected.forEach(optionId => {
        const option = group.options.find(o => o.id === optionId);
        if (option) {
          total += option.priceAdjustment;
        }
      });
    });
    
    return total * quantity;
  };

  const isModifierGroupValid = (group: ModifierGroup): boolean => {
    if (!group.required) return true;
    const selected = selectedModifiers[group.id] || [];
    return selected.length >= 1 && selected.length <= group.maxSelections;
  };

  const canAddToCart = () => {
    return item.modifierGroups.every(group => isModifierGroupValid(group));
  };

  const handleAddToCart = () => {
    if (!canAddToCart()) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addItem(item, quantity, selectedModifiers, specialInstructions);
    router.back();
  };

  const incrementQuantity = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuantity(q => q + 1);
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setQuantity(q => q - 1);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Hero Image */}
        <View style={styles.imageContainer}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderEmoji}>🍔</Text>
            </View>
          )}
          
          {/* Back Button */}
          <View style={styles.headerOverlay}>
            <IconButton
              icon="arrow-back"
              variant="filled"
              backgroundColor="rgba(255,255,255,0.95)"
              color={colors.textPrimary}
              onPress={() => router.back()}
              accessibilityLabel="Go back"
            />
          </View>

          {/* Badges */}
          {(item.isLimitedTime || item.tags.includes('popular')) && (
            <View style={styles.badgeContainer}>
              {item.isLimitedTime && <Badge text="Limited Time" variant="warning" />}
              {item.tags.includes('popular') && <Badge text="Popular" variant="danger" />}
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.headerSection}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{item.name}</Text>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={14} color={colors.warning} />
                <Text style={styles.ratingText}>{item.rating?.toFixed(1) || '4.5'}</Text>
              </View>
            </View>
            
            {item.description && (
              <Text style={styles.description}>{item.description}</Text>
            )}

            {/* Tags */}
            {item.tags.length > 0 && (
              <View style={styles.tagRow}>
                {item.tags.map(tag => (
                  <Chip key={tag} label={tag} size="small" />
                ))}
              </View>
            )}
          </View>

          {/* Nutrition */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nutrition</Text>
            <View style={styles.nutritionGrid}>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{item.calories}</Text>
                <Text style={styles.nutritionLabel}>Calories</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{item.nutritionInfo.protein}g</Text>
                <Text style={styles.nutritionLabel}>Protein</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{item.nutritionInfo.carbs}g</Text>
                <Text style={styles.nutritionLabel}>Carbs</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{item.nutritionInfo.fat}g</Text>
                <Text style={styles.nutritionLabel}>Fat</Text>
              </View>
            </View>
          </View>

          {/* Allergens */}
          {item.allergens.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Allergens</Text>
              <View style={styles.allergenRow}>
                {item.allergens.map(allergen => (
                  <View key={allergen} style={styles.allergenChip}>
                    <Ionicons name="alert-circle" size={14} color={colors.danger} />
                    <Text style={styles.allergenText}>{allergen}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Modifiers */}
          {item.modifierGroups.map(group => (
            <View key={group.id} style={styles.section}>
              <View style={styles.modifierHeader}>
                <Text style={styles.sectionTitle}>{group.name}</Text>
                {group.required && <Badge text="Required" variant="danger" />}
              </View>
              
              <Text style={styles.modifierSubtitle}>
                {group.maxSelections === 1
                  ? 'Choose 1'
                  : `Choose up to ${group.maxSelections}`}
              </Text>

              <View style={styles.modifierList}>
                {group.options.map(option => {
                  const isSelected = (selectedModifiers[group.id] || []).includes(option.id);
                  
                  return (
                    <Pressable
                      key={option.id}
                      style={[styles.modifierOption, isSelected && styles.modifierOptionSelected]}
                      onPress={() => handleModifierToggle(group.id, option.id, group)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                    >
                      <View style={styles.modifierLeft}>
                        <View style={[styles.radio, isSelected && styles.radioSelected]}>
                          {isSelected && <View style={styles.radioInner} />}
                        </View>
                        <Text style={[styles.modifierName, isSelected && styles.modifierNameSelected]}>
                          {option.name}
                        </Text>
                      </View>
                      
                      {option.priceAdjustment > 0 && (
                        <Text style={styles.modifierPrice}>+${option.priceAdjustment.toFixed(2)}</Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          {/* Special Instructions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Special Instructions</Text>
            <TextInput
              style={styles.instructionsInput}
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
              placeholder='Add a note (e.g., "Extra sauce")'
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>

          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* Fixed Bottom Bar */}
      <View style={styles.bottomBar}>
        {/* Quantity Selector */}
        <View style={styles.quantitySelector}>
          <Pressable
            onPress={decrementQuantity}
            style={[styles.quantityButton, quantity === 1 && styles.quantityButtonDisabled]}
            disabled={quantity === 1}
            accessibilityLabel="Decrease quantity"
          >
            <Ionicons name="remove" size={20} color={quantity === 1 ? colors.textTertiary : colors.textPrimary} />
          </Pressable>
          
          <Text style={styles.quantityText}>{quantity}</Text>
          
          <Pressable
            onPress={incrementQuantity}
            style={styles.quantityButton}
            accessibilityLabel="Increase quantity"
          >
            <Ionicons name="add" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        {/* Add to Cart Button */}
        <View style={styles.addButtonContainer}>
          <Button
            title={`Add to Cart · $${calculateTotalPrice().toFixed(2)}`}
            onPress={handleAddToCart}
            disabled={!canAddToCart()}
            fullWidth
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorText: {
    ...typography.h3,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  imageContainer: {
    height: IMAGE_HEIGHT,
    width: SCREEN_WIDTH,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderEmoji: {
    fontSize: 80,
  },
  headerOverlay: {
    position: 'absolute',
    top: spacing.xl + 8,
    left: spacing.md,
  },
  badgeContainer: {
    position: 'absolute',
    top: spacing.xl + 8,
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  content: {
    backgroundColor: colors.cardBackground,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    marginTop: -spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  headerSection: {
    marginBottom: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.md,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.small,
    gap: spacing.xs / 2,
  },
  ratingText: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '700',
  },
  description: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  nutritionGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  nutritionItem: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radii.medium,
    alignItems: 'center',
  },
  nutritionValue: {
    ...typography.h3,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  nutritionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  allergenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  allergenChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.small,
    gap: spacing.xs,
  },
  allergenText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '600',
  },
  modifierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  modifierSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  modifierList: {
    gap: spacing.sm,
  },
  modifierOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radii.medium,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  modifierOptionSelected: {
    backgroundColor: colors.accentLight + '15',
    borderColor: colors.accent,
  },
  modifierLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radii.round,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioSelected: {
    borderColor: colors.accent,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: radii.round,
    backgroundColor: colors.accent,
  },
  modifierName: {
    ...typography.body,
    color: colors.textPrimary,
  },
  modifierNameSelected: {
    fontWeight: '600',
    color: colors.accent,
  },
  modifierPrice: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  instructionsInput: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radii.medium,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 80,
    ...typography.body,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.cardBackground,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.xl,
    flexDirection: 'row',
    gap: spacing.md,
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radii.medium,
    padding: spacing.xs,
    gap: spacing.sm,
  },
  quantityButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.small,
  },
  quantityButtonDisabled: {
    opacity: 0.4,
  },
  quantityText: {
    ...typography.h4,
    color: colors.textPrimary,
    minWidth: 24,
    textAlign: 'center',
  },
  addButtonContainer: {
    flex: 1,
  },
});
