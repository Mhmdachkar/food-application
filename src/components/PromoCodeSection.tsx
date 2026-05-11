import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing } from '../theme/theme';

type PromoState = 'idle' | 'input' | 'applied';

interface PromoCodeSectionProps {
  promoCode: string | null;
  promoDiscount: number;
  onApply: (code: string) => void;
  onRemove: () => void;
}

export const PromoCodeSection: React.FC<PromoCodeSectionProps> = ({
  promoCode,
  promoDiscount,
  onApply,
  onRemove,
}) => {
  const [state, setState] = useState<PromoState>('idle');
  const [input, setInput] = useState('');

  useEffect(() => {
    if (promoCode && promoDiscount > 0) {
      setState('applied');
    } else {
      setState('idle');
    }
  }, [promoCode, promoDiscount]);

  const handleApply = () => {
    if (input.trim()) {
      onApply(input.trim());
      setInput('');
    }
  };

  if (state === 'applied' && promoCode && promoDiscount > 0) {
    return (
      <View style={s.applied}>
        <Ionicons name="pricetag" size={16} color={colors.success} />
        <Text style={s.appliedText}>{promoCode} applied</Text>
        <Pressable
          onPress={() => { onRemove(); setState('idle'); }}
          hitSlop={8}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    );
  }

  if (state === 'input') {
    return (
      <View style={s.inputRow}>
        <TextInput
          style={s.textInput}
          placeholder="Enter promo code"
          placeholderTextColor={colors.textSecondary}
          value={input}
          onChangeText={setInput}
          autoCapitalize="characters"
          onSubmitEditing={handleApply}
          returnKeyType="done"
        />
        <Pressable
          style={({ pressed }) => [s.applyBtn, pressed && { opacity: 0.85 }]}
          onPress={handleApply}
        >
          <Text style={s.applyText}>Apply</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [s.idleBtn, pressed && { opacity: 0.8 }]}
      onPress={() => setState('input')}
    >
      <Ionicons name="pricetag" size={18} color={colors.accent} />
      <Text style={s.idleBtnText}>Add promo code</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
};

const s = StyleSheet.create({
  idleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    borderRadius: radii.small + 2,
    padding: 14,
    gap: 10,
    marginBottom: spacing.md,
  },
  idleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.md,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.borderLight,
    borderRadius: radii.small + 2,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: 15,
    color: colors.textPrimary,
  },
  applyBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.small + 2,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  applyText: {
    color: colors.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
  applied: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    borderRadius: radii.small + 2,
    padding: 14,
    gap: 10,
    marginBottom: spacing.md,
  },
  appliedText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
    flex: 1,
  },
});
