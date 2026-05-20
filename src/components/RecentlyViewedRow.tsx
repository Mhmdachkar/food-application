import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { PLACEHOLDER_BLURHASH, IMAGE_TRANSITION_MS } from '../constants/images';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows } from '../theme/theme';
import type { MenuItem } from '../models/MenuItem';

export interface RecentlyViewedRowProps {
  items: MenuItem[];
  onPress?: (item: MenuItem) => void;
}

export const RecentlyViewedRow: React.FC<RecentlyViewedRowProps> = ({ items, onPress }) => {
  if (items.length === 0) return null;

  return (
    <View testID="recently-viewed-row" style={s.wrapper}>
      <View style={s.header}>
        <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
        <Text style={s.title}>Recently Viewed</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {items.map(item => (
          <Pressable
            key={item.id}
            testID={`recently-viewed-${item.id}`}
            style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
            onPress={() => onPress?.(item)}
          >
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={s.image} placeholder={{ blurhash: PLACEHOLDER_BLURHASH }} transition={IMAGE_TRANSITION_MS} contentFit="cover" />
            ) : (
              <View style={[s.image, s.imagePlaceholder]}>
                <Text style={{ fontSize: 22 }}>{'\uD83C\uDF7D\uFE0F'}</Text>
              </View>
            )}
            <Text style={s.name} numberOfLines={1}>{item.name}</Text>
            <Text style={s.price}>${item.price.toFixed(2)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  scroll: {
    gap: 10,
  },
  card: {
    width: 100,
    backgroundColor: '#FFF',
    borderRadius: 14,
    overflow: 'hidden',
    ...shadows.sm,
    borderWidth: 1,
    borderColor: '#F0F0F5',
  },
  image: {
    width: 100,
    height: 72,
  },
  imagePlaceholder: {
    backgroundColor: '#FFF5EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.textPrimary,
    paddingHorizontal: 6,
    paddingTop: 6,
  },
  price: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: colors.accent,
    paddingHorizontal: 6,
    paddingBottom: 6,
    paddingTop: 2,
  },
});
