import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import { Image } from 'expo-image';
import { PLACEHOLDER_BLURHASH, IMAGE_TRANSITION_MS } from '../constants/images';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, shadows } from '../theme/theme';
import type { Order } from '../models/Order';

export interface QuickReorderCardProps {
  order: Order;
  onReorder: (order: Order) => void;
}

export const QuickReorderCard: React.FC<QuickReorderCardProps> = ({ order, onReorder }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }),
    ]).start();
    onReorder(order);
  };

  const itemNames = order.items.map(i => i.menuItem.name);
  const displayNames = itemNames.slice(0, 3).join(', ') + (itemNames.length > 3 ? '...' : '');
  const thumbnails = order.items.slice(0, 3);
  const dateStr = formatRelativeDate(order.createdAt);

  return (
    <View style={s.wrapper}>
      <View style={s.card}>
        <View style={s.thumbRow}>
          {thumbnails.map((ci, i) => (
            <View key={ci.id} style={[s.thumbCircle, i > 0 && { marginLeft: -10 }]}>
              {ci.menuItem.imageUrl ? (
                <Image source={{ uri: ci.menuItem.imageUrl }} style={s.thumbImg} placeholder={{ blurhash: PLACEHOLDER_BLURHASH }} transition={IMAGE_TRANSITION_MS} contentFit="cover" />
              ) : (
                <View style={[s.thumbImg, s.thumbPlaceholder]}>
                  <Text style={{ fontSize: 16 }}>{'\uD83C\uDF7D\uFE0F'}</Text>
                </View>
              )}
            </View>
          ))}
        </View>
        <Text style={s.names} numberOfLines={1}>{displayNames}</Text>
        <Text style={s.meta}>
          {order.items.length} item{order.items.length !== 1 ? 's' : ''} · ${order.total.toFixed(2)} · {dateStr}
        </Text>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Pressable
            testID="quick-reorder-btn"
            style={({ pressed }) => [s.reorderBtn, pressed && { opacity: 0.9 }]}
            onPress={handlePress}
          >
            <Ionicons name="refresh-outline" size={16} color="#FFF" />
            <Text style={s.reorderText}>Reorder</Text>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
};

const formatRelativeDate = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
};

const s = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    ...shadows.md,
    borderWidth: 1,
    borderColor: '#F0F0F5',
  },
  thumbRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  thumbCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  thumbImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  thumbPlaceholder: {
    backgroundColor: '#FFF5EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  names: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  meta: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderRadius: 24,
    paddingVertical: 13,
    gap: 8,
    shadowColor: colors.accent,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  reorderText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFF',
  },
});
