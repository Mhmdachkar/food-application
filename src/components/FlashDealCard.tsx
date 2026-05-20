import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { Image } from 'expo-image';
import { PLACEHOLDER_BLURHASH, IMAGE_TRANSITION_MS } from '../constants/images';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows } from '../theme/theme';
import type { FlashDeal } from '../mocks/deals';

export interface FlashDealCardProps {
  deal: FlashDeal;
  onAdd?: (deal: FlashDeal) => void;
}

const formatTimeLeft = (endsAt: string): string => {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m left`;
};

export const FlashDealCard: React.FC<FlashDealCardProps> = ({ deal, onAdd }) => {
  const [timeLeft, setTimeLeft] = useState(() => formatTimeLeft(deal.endsAt));
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const soldPercent = Math.round((deal.soldCount / deal.totalAvailable) * 100);
  const isAlmostGone = soldPercent > 80;

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(formatTimeLeft(deal.endsAt));
    }, 60000);
    return () => clearInterval(interval);
  }, [deal.endsAt]);

  useEffect(() => {
    if (!isAlmostGone) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isAlmostGone]);

  return (
    <Animated.View style={[s.card, { transform: [{ scale: pulseAnim }] }]}>
      <View style={s.imageWrap}>
        {deal.food.imageUrl ? (
          <Image source={{ uri: deal.food.imageUrl }} style={s.image} placeholder={{ blurhash: PLACEHOLDER_BLURHASH }} transition={IMAGE_TRANSITION_MS} contentFit="cover" />
        ) : (
          <View style={[s.image, s.imagePlaceholder]}>
            <Text style={{ fontSize: 32 }}>{'\uD83C\uDF54'}</Text>
          </View>
        )}
        <View style={s.discountBadge}>
          <Ionicons name="flash-outline" size={10} color="#FFF" />
          <Text style={s.discountText}>-{deal.discountPercent}%</Text>
        </View>
        <Pressable
          testID={`flash-deal-add-${deal.id}`}
          style={({ pressed }) => [s.addBtn, pressed && { opacity: 0.8 }]}
          onPress={() => onAdd?.(deal)}
        >
          <Text style={s.addBtnText}>+</Text>
        </Pressable>
      </View>
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{deal.food.name}</Text>
        <View style={s.priceRow}>
          <Text style={s.dealPrice}>${deal.dealPrice.toFixed(2)}</Text>
          <Text style={s.originalPrice}>${deal.originalPrice.toFixed(2)}</Text>
        </View>
        <View style={s.progressBg}>
          <View style={[s.progressFill, { width: `${Math.min(soldPercent, 100)}%` }]} />
        </View>
        <Text style={s.timer}>{timeLeft}</Text>
      </View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  card: {
    width: 170,
    backgroundColor: '#FFF',
    borderRadius: 16,
    overflow: 'hidden',
    ...shadows.md,
    borderWidth: 1,
    borderColor: '#F0F0F5',
  },
  imageWrap: {
    width: 170,
    height: 120,
    position: 'relative',
  },
  image: {
    width: 170,
    height: 120,
  },
  imagePlaceholder: {
    backgroundColor: '#FFF5EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E74C3C',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 3,
  },
  discountText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: '#FFF',
  },
  addBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  addBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700' as const,
  },
  info: {
    padding: 10,
  },
  name: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  dealPrice: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: colors.accent,
  },
  originalPrice: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  progressBg: {
    height: 5,
    backgroundColor: '#F0F0F5',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: 5,
    backgroundColor: '#E74C3C',
    borderRadius: 3,
  },
  timer: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.textSecondary,
  },
});
