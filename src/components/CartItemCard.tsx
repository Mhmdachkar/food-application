import React from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing } from '../theme/theme';
import type { CartItem } from '../models/Cart';

interface CartItemCardProps {
  item: CartItem;
  onUpdateQty: (item: CartItem, qty: number) => void;
  onRemove: (item: CartItem) => void;
}

export const CartItemCard: React.FC<CartItemCardProps> = ({
  item,
  onUpdateQty,
  onRemove,
}) => {
  const unitPrice =
    item.menuItem.price +
    Object.values(item.selectedModifiers)
      .flat()
      .reduce((sum, optionId) => {
        const group = item.menuItem.modifierGroups.find(g =>
          g.options.some(o => o.id === optionId),
        );
        const option = group?.options.find(o => o.id === optionId);
        return sum + (option?.priceAdjustment ?? 0);
      }, 0);

  return (
    <View style={s.card}>
      {item.menuItem.imageUrl ? (
        <Image
          source={{ uri: item.menuItem.imageUrl }}
          style={s.image}
          resizeMode="cover"
        />
      ) : (
        <View style={[s.image, s.imagePlaceholder]} />
      )}

      <View style={s.center}>
        <Text style={s.name} numberOfLines={1}>
          {item.menuItem.name}
        </Text>
        <Text style={s.price}>${unitPrice.toFixed(2)}</Text>
        <View style={s.qtyRow}>
          <Pressable
            style={({ pressed }) => [s.qtyBtn, pressed && s.qtyBtnPressed]}
            onPress={() => onUpdateQty(item, item.quantity - 1)}
          >
            <Text style={s.qtyBtnText}>{'\u2212'}</Text>
          </Pressable>
          <Text style={s.qtyText}>{item.quantity}</Text>
          <Pressable
            style={({ pressed }) => [s.qtyBtn, pressed && s.qtyBtnPressed]}
            onPress={() => onUpdateQty(item, item.quantity + 1)}
          >
            <Text style={s.qtyBtnText}>+</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [s.deleteBtn, pressed && { opacity: 0.5 }]}
        onPress={() => onRemove(item)}
        hitSlop={8}
      >
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
      </Pressable>
    </View>
  );
};

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.cardBackground,
    borderRadius: radii.medium,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm + 4,
    ...shadows.md,
    ...(Platform.OS === 'web' && {
      boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    }),
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: radii.small + 2,
  },
  imagePlaceholder: {
    backgroundColor: colors.borderLight,
  },
  center: {
    flex: 1,
    marginLeft: 14,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  price: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.92 }],
  },
  qtyBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.accent,
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginHorizontal: 14,
    minWidth: 20,
    textAlign: 'center',
  },
  deleteBtn: {
    paddingLeft: spacing.sm + 4,
    justifyContent: 'center',
  },
});
