import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/theme';

const FREE_DELIVERY_THRESHOLD = 30;

export interface FreeDeliveryProgressProps {
  subtotal: number;
}

export const FreeDeliveryProgress: React.FC<FreeDeliveryProgressProps> = ({ subtotal }) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const reached = subtotal >= FREE_DELIVERY_THRESHOLD;
  const remaining = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const percent = Math.min(subtotal / FREE_DELIVERY_THRESHOLD, 1);

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: percent,
      friction: 8,
      tension: 40,
      useNativeDriver: false,
    }).start();
  }, [percent]);

  const widthInterpolated = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (reached) {
    return (
      <View testID="free-delivery-reached" style={[s.container, s.containerReached]}>
        <View style={s.iconCircleGreen}>
          <Ionicons name="bicycle-outline" size={18} color="#FFF" />
          <View style={s.checkOverlay}>
            <Ionicons name="checkmark" size={10} color="#FFF" />
          </View>
        </View>
        <Text style={s.reachedText}>You got free delivery!</Text>
      </View>
    );
  }

  return (
    <View testID="free-delivery-progress" style={[s.container, s.containerPending]}>
      <View style={s.topRow}>
        <View style={s.iconCircleOrange}>
          <Ionicons name="bicycle-outline" size={18} color={colors.accent} />
        </View>
        <Text style={s.pendingText}>
          Add <Text style={s.amountText}>${remaining.toFixed(2)}</Text> more for free delivery
        </Text>
      </View>
      <View style={s.progressBg}>
        <Animated.View style={[s.progressFill, { width: widthInterpolated }]} />
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  containerPending: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: colors.accent,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 10px rgba(255,140,26,0.1)' }
      : {
          shadowColor: colors.accent,
          shadowOpacity: 0.1,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        }),
  },
  containerReached: {
    backgroundColor: '#E8F8EC',
    borderWidth: 1.5,
    borderColor: '#2ECC71',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  iconCircleOrange: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF3E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleGreen: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2ECC71',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  checkOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#27AE60',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E8F8EC',
  },
  pendingText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.textPrimary,
    flex: 1,
  },
  amountText: {
    fontWeight: '800' as const,
    color: colors.accent,
  },
  reachedText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#2ECC71',
  },
  progressBg: {
    height: 6,
    backgroundColor: '#F0F0F5',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
});
