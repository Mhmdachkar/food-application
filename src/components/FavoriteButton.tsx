import React, { useRef, useEffect } from 'react';
import { Pressable, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFavoritesStore } from '../state/FavoritesStore';

interface Props {
  itemId: string;
  size?: number;
  color?: string;
  style?: any;
}

export const FavoriteButton: React.FC<Props> = ({
  itemId,
  size = 22,
  color = '#FF4757',
  style,
}) => {
  const { isFavorite, toggle, isLoaded, load } = useFavoritesStore();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isLoaded) load();
  }, [isLoaded, load]);

  const filled = isFavorite(itemId);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
    toggle(itemId);
  };

  return (
    <Pressable onPress={handlePress} hitSlop={8} style={[styles.btn, style]}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={filled ? 'heart' : 'heart-outline'}
          size={size}
          color={filled ? color : '#CCCCCC'}
        />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  btn: {
    padding: 4,
  },
});
