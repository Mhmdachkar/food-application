import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows } from '../theme/theme';

export interface DeliveryBannerProps {
  address?: string;
  etaRange?: string;
  onPress?: () => void;
}

export const DeliveryBanner: React.FC<DeliveryBannerProps> = ({
  address = '123 Main Street, Apt 4B',
  etaRange = '30-45 min',
  onPress,
}) => {
  return (
    <Pressable
      testID="delivery-banner"
      style={({ pressed }) => [s.container, pressed && { opacity: 0.85 }]}
      onPress={onPress}
    >
      <View style={s.iconCircle}>
        <Ionicons name="location-outline" size={18} color={colors.accent} />
      </View>
      <View style={s.textBlock}>
        <Text style={s.label}>Delivering to</Text>
        <Text style={s.address} numberOfLines={1}>{address}</Text>
      </View>
      <View style={s.etaBadge}>
        <Text style={s.etaText}>{etaRange}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
};

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    ...shadows.md,
    borderWidth: 1,
    borderColor: '#F0F0F5',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF3E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textBlock: {
    flex: 1,
    marginRight: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  address: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    marginTop: 2,
  },
  etaBadge: {
    backgroundColor: '#E8F8EC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginRight: 8,
  },
  etaText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#2ECC71',
  },
});
