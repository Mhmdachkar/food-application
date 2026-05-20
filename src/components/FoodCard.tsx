import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { PLACEHOLDER_BLURHASH, IMAGE_TRANSITION_MS } from '../constants/images';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadows } from '../theme/theme';
import { CAT_EMOJI } from '../constants/categories';
import { FavoriteButton } from './FavoriteButton';
import type { MenuItem } from '../models/MenuItem';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 16 * 2 - 10) / 2;

interface FoodCardProps {
  item: MenuItem;
  index: number;
  onAdd: (item: MenuItem) => void;
  onPress: (item: MenuItem) => void;
}

export const FoodCard = React.memo<FoodCardProps>(({ item, index, onAdd, onPress }) => {
  const scale = useRef(new Animated.Value(0.95)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 40,
        delay: index * 50,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        delay: index * 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const emoji = CAT_EMOJI[item.category] ?? '\uD83C\uDF7D\uFE0F';

  return (
    <Pressable onPress={() => onPress(item)}>
      <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.image} placeholder={{ blurhash: PLACEHOLDER_BLURHASH }} transition={IMAGE_TRANSITION_MS} contentFit="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderEmoji}>{emoji}</Text>
          </View>
        )}

        <FavoriteButton
          itemId={item.id}
          size={18}
          style={styles.favButton}
        />

        {item.prepTimeMinutes <= 15 && (
          <View style={styles.timeBadge}>
            <Ionicons name="time-outline" size={10} color="#FFF" />
            <Text style={styles.timeBadgeText}>{item.prepTimeMinutes} min</Text>
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.desc} numberOfLines={1}>{item.description}</Text>
          <View style={styles.bottom}>
            <Text style={styles.price}>${item.price.toFixed(2)}</Text>
            <Text style={styles.rating}>{'\u2B50'} {item.rating.toFixed(1)}</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
          onPress={e => { e.stopPropagation(); onAdd(item); }}
        >
          <Ionicons name="add" size={20} color="#FFF" />
        </Pressable>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    backgroundColor: colors.cardBackground,
    borderRadius: radii.medium,
    marginBottom: 12,
    overflow: 'hidden',
    position: 'relative',
    ...shadows.md,
  },
  image: {
    width: '100%',
    height: CARD_W * 0.7,
    borderTopLeftRadius: radii.medium,
    borderTopRightRadius: radii.medium,
  },
  imagePlaceholder: {
    width: '100%',
    height: CARD_W * 0.7,
    backgroundColor: colors.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 36,
  },
  favButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    padding: 5,
    ...shadows.sm,
  },
  timeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  timeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  info: {
    padding: 10,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  desc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  price: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.accent,
  },
  rating: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  addBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  addBtnPressed: {
    transform: [{ scale: 0.9 }],
    opacity: 0.9,
  },
});
