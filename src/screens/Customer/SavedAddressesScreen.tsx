import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../state/AuthStore';
import { colors, spacing, radii } from '../../theme/theme';
import type { DeliveryAddress } from '../../models/AppUser';

const EMPTY_ADDRESS: DeliveryAddress = { street: '', city: '', state: '', zip: '', notes: '' };

export const SavedAddressesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateAddress, loadAddress } = useAuthStore();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DeliveryAddress>(user?.address ?? EMPTY_ADDRESS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAddress();
  }, []);

  useEffect(() => {
    if (user?.address) setDraft(user.address);
  }, [user?.address]);

  const handleSave = async () => {
    if (!draft.street.trim() || !draft.city.trim()) {
      Alert.alert('Missing Fields', 'Street and city are required.');
      return;
    }
    setSaving(true);
    await updateAddress(draft);
    setSaving(false);
    setEditing(false);
    Alert.alert('Saved', 'Your delivery address has been updated.');
  };

  const handleRemove = () => {
    Alert.alert('Remove Address', 'Remove your saved address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          await updateAddress(EMPTY_ADDRESS);
          setDraft(EMPTY_ADDRESS);
        },
      },
    ]);
  };

  const hasAddress = !!(user?.address?.street);

  return (
    <ScrollView style={[s.container, { paddingTop: insets.top }]} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={s.headerTitle}>Saved Addresses</Text>
        <View style={{ width: 24 }} />
      </View>

      {hasAddress && !editing ? (
        /* ── Saved address card ── */
        <View style={s.card}>
          <View style={s.cardTop}>
            <View style={s.cardLeft}>
              <Text style={s.cardIcon}>🏠</Text>
              <View style={s.cardInfo}>
                <View style={s.cardLabelRow}>
                  <Text style={s.cardLabel}>Home</Text>
                  <View style={s.defaultBadge}><Text style={s.defaultBadgeText}>Default</Text></View>
                </View>
                <Text style={s.cardAddress}>{user!.address!.street}</Text>
                <Text style={s.cardCity}>{user!.address!.city}{user!.address!.state ? `, ${user!.address!.state}` : ''} {user!.address!.zip}</Text>
                {user!.address!.notes ? <Text style={s.cardNotes}>{user!.address!.notes}</Text> : null}
              </View>
            </View>
            <View style={s.cardActions}>
              <Pressable onPress={() => setEditing(true)} hitSlop={8} style={s.iconBtn}>
                <Ionicons name="pencil-outline" size={18} color={colors.accent} />
              </Pressable>
              <Pressable onPress={handleRemove} hitSlop={8} style={s.iconBtn}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        /* ── Add / Edit form ── */
        <View style={s.form}>
          <Text style={s.formTitle}>{hasAddress ? 'Edit Address' : 'Add Delivery Address'}</Text>

          <Text style={s.fieldLabel}>Street *</Text>
          <TextInput
            style={s.input}
            value={draft.street}
            onChangeText={v => setDraft(d => ({ ...d, street: v }))}
            placeholder="123 Main Street"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={s.fieldLabel}>City *</Text>
          <TextInput
            style={s.input}
            value={draft.city}
            onChangeText={v => setDraft(d => ({ ...d, city: v }))}
            placeholder="City"
            placeholderTextColor={colors.textTertiary}
          />

          <View style={s.row}>
            <View style={s.halfField}>
              <Text style={s.fieldLabel}>State</Text>
              <TextInput
                style={s.input}
                value={draft.state}
                onChangeText={v => setDraft(d => ({ ...d, state: v }))}
                placeholder="State"
                placeholderTextColor={colors.textTertiary}
                maxLength={3}
              />
            </View>
            <View style={s.halfField}>
              <Text style={s.fieldLabel}>ZIP</Text>
              <TextInput
                style={s.input}
                value={draft.zip}
                onChangeText={v => setDraft(d => ({ ...d, zip: v }))}
                placeholder="ZIP"
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>
          </View>

          <Text style={s.fieldLabel}>Delivery Notes (optional)</Text>
          <TextInput
            style={[s.input, s.inputMulti]}
            value={draft.notes}
            onChangeText={v => setDraft(d => ({ ...d, notes: v }))}
            placeholder='e.g. "Leave at the door"'
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={2}
          />

          <View style={s.formActions}>
            {editing && (
              <Pressable style={s.cancelBtn} onPress={() => { setEditing(false); setDraft(user?.address ?? EMPTY_ADDRESS); }}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </Pressable>
            )}
            <Pressable style={[s.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
              <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save Address'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {!hasAddress && !editing && (
        <Pressable style={s.addBtn} onPress={() => setEditing(true)}>
          <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
          <Text style={s.addBtnText}>Add New Address</Text>
        </Pressable>
      )}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },

  card: { backgroundColor: colors.cardBackground, borderRadius: radii.medium, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1.5, borderColor: colors.accent },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flexDirection: 'row', flex: 1 },
  cardIcon: { fontSize: 28, marginRight: spacing.sm, marginTop: 2 },
  cardInfo: { flex: 1 },
  cardLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  cardLabel: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  defaultBadge: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  defaultBadgeText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  cardAddress: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  cardCity: { fontSize: 13, color: colors.textSecondary },
  cardNotes: { fontSize: 12, color: colors.accent, fontStyle: 'italic', marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: spacing.sm },
  iconBtn: { padding: 6 },

  form: { backgroundColor: colors.cardBackground, borderRadius: radii.medium, padding: spacing.md, marginBottom: spacing.sm },
  formTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.md },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  input: {
    backgroundColor: colors.background, borderRadius: radii.small,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    fontSize: 15, color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  inputMulti: { minHeight: 64, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: spacing.sm },
  halfField: { flex: 1 },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  cancelBtn: { flex: 1, borderRadius: radii.button, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  saveBtn: { flex: 2, borderRadius: radii.button, backgroundColor: colors.accent, alignItems: 'center', paddingVertical: 12 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardBackground, borderRadius: radii.medium, padding: spacing.md, marginTop: spacing.md, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed', gap: spacing.sm },
  addBtnText: { fontSize: 15, fontWeight: '600', color: colors.accent },
});
