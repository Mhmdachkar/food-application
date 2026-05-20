import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Image } from 'expo-image';
import { PLACEHOLDER_BLURHASH, IMAGE_TRANSITION_MS } from '../constants/images';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing } from '../theme/theme';
import type { MenuItem } from '../models/MenuItem';

interface UpsellSuggestion {
  item: MenuItem;
  reason: string;
}

interface UpsellRowProps {
  suggestions: UpsellSuggestion[];
  onAdd: (item: MenuItem) => void;
  onDismiss: (itemId: string) => void;
}

export const UpsellRow: React.FC<UpsellRowProps> = ({
  suggestions,
  onAdd,
  onDismiss,
}) => {
  if (suggestions.length === 0) return null;

  return (
    <View style={s.section}>
      <Text style={s.title}>Add something extra?</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {suggestions.map(sg => (
          <View key={sg.item.id} style={s.card}>
            {sg.item.imageUrl ? (
              <Image
                source={{ uri: sg.item.imageUrl }}
                style={s.image}
                contentFit="cover"
                placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
                transition={IMAGE_TRANSITION_MS}
              />
            ) : (
              <View style={[s.image, s.imagePlaceholder]}>
                <Ionicons
                  name="restaurant-outline"
                  size={24}
                  color={colors.textSecondary}
                />
              </View>
            )}
            <Text style={s.name} numberOfLines={1}>
              {sg.item.name}
            </Text>
            <View style={s.bottom}>
              <Text style={s.price}>${sg.item.price.toFixed(2)}</Text>
              <Pressable
                style={({ pressed }) => [s.addBtn, pressed && { transform: [{ scale: 0.9 }] }]}
                onPress={() => {
                  onAdd(sg.item);
                  onDismiss(sg.item.id);
                }}
              >
                <Text style={s.addText}>+</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  section: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm + 4,
  },
  scroll: {
    flexDirection: 'row',
    gap: spacing.sm + 4,
  },
  card: {
    width: 130,
    backgroundColor: colors.cardBackground,
    borderRadius: radii.small + 2,
    overflow: 'hidden',
    ...shadows.sm,
  },
  image: {
    width: 130,
    height: 80,
  },
  imagePlaceholder: {
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    color: colors.textPrimary,
  },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  addBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    color: colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },
});
