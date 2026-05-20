import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { PLACEHOLDER_BLURHASH, IMAGE_TRANSITION_MS } from '../constants/images';
import { colors, shadows } from '../theme/theme';
import type { MenuItem } from '../models/MenuItem';

export interface TopPicksCardProps {
  item: MenuItem;
  ordersInLastHour?: number;
  onPress?: (item: MenuItem) => void;
}

export const TopPicksCard: React.FC<TopPicksCardProps> = ({ item, ordersInLastHour, onPress }) => {
  return (
    <Pressable
      testID={`top-pick-${item.id}`}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.9 }]}
      onPress={() => onPress?.(item)}
    >
      <View style={s.imageWrap}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={s.image} placeholder={{ blurhash: PLACEHOLDER_BLURHASH }} transition={IMAGE_TRANSITION_MS} contentFit="cover" />
        ) : (
          <View style={[s.image, s.imagePlaceholder]}>
            <Text style={{ fontSize: 28 }}>{'\uD83C\uDF7D\uFE0F'}</Text>
          </View>
        )}
        {ordersInLastHour != null && ordersInLastHour > 0 && (
          <View style={s.trendBadge}>
            <Text style={s.trendText}>{ordersInLastHour}+ orders</Text>
          </View>
        )}
      </View>
      <Text style={s.name} numberOfLines={1}>{item.name}</Text>
      <View style={s.bottomRow}>
        <Text style={s.price}>${item.price.toFixed(2)}</Text>
        <Text style={s.rating}>{'\u2B50'} {item.rating.toFixed(1)}</Text>
      </View>
    </Pressable>
  );
};

const s = StyleSheet.create({
  card: {
    width: 140,
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...shadows.md,
    borderWidth: 1,
    borderColor: '#F0F0F5',
  },
  imageWrap: {
    width: 140,
    height: 100,
    position: 'relative',
  },
  image: {
    width: 140,
    height: 100,
  },
  imagePlaceholder: {
    backgroundColor: '#FFF5EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  trendText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  name: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: colors.accent,
  },
  rating: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
});
