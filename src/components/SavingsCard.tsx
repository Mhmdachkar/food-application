import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface SavingsCardProps {
  promoDiscount: number;
  freeDeliverySaved: number;
}

export const SavingsCard: React.FC<SavingsCardProps> = ({ promoDiscount, freeDeliverySaved }) => {
  const totalSavings = promoDiscount + freeDeliverySaved;
  const bounceAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (totalSavings > 0) {
      Animated.spring(bounceAnim, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }
  }, [totalSavings]);

  if (totalSavings <= 0) return null;

  const parts: string[] = [];
  if (promoDiscount > 0) parts.push(`$${promoDiscount.toFixed(2)} promo`);
  if (freeDeliverySaved > 0) parts.push(`$${freeDeliverySaved.toFixed(2)} delivery`);
  const breakdown = parts.join(' + ');

  return (
    <Animated.View
      testID="savings-card"
      style={[s.container, { transform: [{ scale: bounceAnim }] }]}
    >
      <View style={s.iconCircle}>
        <Ionicons name="sparkles-outline" size={18} color="#D4A017" />
      </View>
      <View style={s.textBlock}>
        <Text style={s.title}>You're saving ${totalSavings.toFixed(2)}</Text>
        <Text style={s.subtitle}>{breakdown}</Text>
      </View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE082',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF0B3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: '#B8860B',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#C69C1C',
    marginTop: 2,
  },
});
