import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useScheduleOrderStore } from '../../state/ScheduleOrderStore';
import { useCartStore } from '../../state/CartStore';
import { colors, spacing, radii } from '../../theme/theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIMES = ['11:30', '12:00', '12:15', '12:30', '13:00', '17:30', '18:00', '18:30', '19:00', '19:30'];

export const ScheduleOrderScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { schedules, isLoaded, load, addSchedule, removeSchedule, toggleSchedule } = useScheduleOrderStore();
  const { items: cartItems } = useCartStore();
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState('');
  const [selectedTime, setSelectedTime] = useState('12:00');
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [recurrence, setRecurrence] = useState<'once' | 'weekly'>('weekly');

  useEffect(() => { if (!isLoaded) load(); }, [isLoaded, load]);

  const handleCreate = () => {
    if (!label.trim()) { Alert.alert('Please enter a name for this schedule'); return; }
    const itemIds = cartItems.map(ci => ci.menuItem.id);
    if (itemIds.length === 0) {
      Alert.alert(
        'No Items',
        'Add items to your cart first — the scheduled order will use your current cart.',
        [{ text: 'OK' }],
      );
      return;
    }
    addSchedule({
      label: label.trim(),
      itemIds,
      deliveryTime: selectedTime,
      recurrence,
      dayOfWeek: selectedDay,
    });
    setShowCreate(false);
    setLabel('');
    Alert.alert(
      'Scheduled!',
      `"${label.trim()}" will run every ${DAYS[selectedDay]} at ${selectedTime} (${itemIds.length} item${itemIds.length !== 1 ? 's' : ''} from your current cart).`,
    );
  };

  return (
    <ScrollView style={[s.container, { paddingTop: insets.top }]} contentContainerStyle={s.content}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.title}>{'\uD83D\uDCC5'} Scheduled Orders</Text>
          <Text style={s.subtitle}>Set it and forget it</Text>
        </View>
        <Pressable style={s.addBtn} onPress={() => setShowCreate(!showCreate)}>
          <Text style={s.addBtnText}>{showCreate ? '\u2715' : '+'}</Text>
        </Pressable>
      </View>

      {showCreate && (
        <View style={s.createCard}>
          <TextInput
            style={s.nameInput}
            value={label}
            onChangeText={setLabel}
            placeholder="Schedule name (e.g. Tuesday Lunch)"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={s.sectionLabel}>Delivery Time</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.timeScroll}>
            {TIMES.map(t => (
              <Pressable key={t} style={[s.timeChip, selectedTime === t && s.timeChipActive]} onPress={() => setSelectedTime(t)}>
                <Text style={[s.timeText, selectedTime === t && s.timeTextActive]}>{t}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={s.sectionLabel}>Day</Text>
          <View style={s.daysRow}>
            {DAYS.map((d, i) => (
              <Pressable key={d} style={[s.dayChip, selectedDay === i && s.dayChipActive]} onPress={() => setSelectedDay(i)}>
                <Text style={[s.dayText, selectedDay === i && s.dayTextActive]}>{d}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={s.sectionLabel}>Recurrence</Text>
          <View style={s.recurrenceRow}>
            {(['once', 'weekly'] as const).map(r => (
              <Pressable key={r} style={[s.recChip, recurrence === r && s.recChipActive]} onPress={() => setRecurrence(r)}>
                <Text style={[s.recText, recurrence === r && s.recTextActive]}>
                  {r === 'once' ? 'One time' : 'Every week'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={s.createBtn} onPress={handleCreate}>
            <Text style={s.createBtnText}>Create Schedule</Text>
          </Pressable>
        </View>
      )}

      {schedules.length === 0 && !showCreate ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>{'\u23F0'}</Text>
          <Text style={s.emptyTitle}>No scheduled orders</Text>
          <Text style={s.emptyDesc}>Set up recurring orders so your food is ready exactly when you need it.</Text>
        </View>
      ) : (
        schedules.map(sched => (
          <View key={sched.id} style={s.schedCard}>
            <View style={s.schedHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.schedName}>{sched.label}</Text>
                <Text style={s.schedDetail}>
                  {sched.recurrence === 'weekly' ? `Every ${DAYS[sched.dayOfWeek ?? 0]}` : 'One time'} at {sched.deliveryTime}
                </Text>
              </View>
              <Switch
                value={sched.isActive}
                onValueChange={() => toggleSchedule(sched.id)}
                trackColor={{ true: colors.accent, false: colors.border }}
              />
            </View>
            <Pressable style={s.removeBtn} onPress={() => {
              Alert.alert('Remove?', 'Delete this scheduled order?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => removeSchedule(sched.id) },
              ]);
            }}>
              <Text style={s.removeBtnText}>Remove</Text>
            </Pressable>
          </View>
        ))
      )}

      <View style={s.infoCard}>
        <Text style={s.infoIcon}>{'\uD83D\uDCA1'}</Text>
        <Text style={s.infoText}>
          We calculate the optimal time to send your order to the kitchen so it's ready exactly when you want it, based on current prep times and driver availability.
        </Text>
      </View>
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md, gap: spacing.sm },
  headerCenter: { flex: 1 },
  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: '#FFF', fontSize: 22, fontWeight: '600' },
  createCard: { backgroundColor: colors.cardBackground, borderRadius: radii.large, padding: spacing.md, marginBottom: spacing.md },
  nameInput: { backgroundColor: colors.background, borderRadius: radii.medium, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.textPrimary, marginBottom: spacing.md },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm, marginTop: spacing.sm },
  timeScroll: { marginBottom: spacing.sm },
  timeChip: { backgroundColor: colors.background, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 8, marginRight: spacing.sm },
  timeChipActive: { backgroundColor: colors.accent },
  timeText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  timeTextActive: { color: '#FFF' },
  daysRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  dayChip: { flex: 1, backgroundColor: colors.background, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  dayChipActive: { backgroundColor: colors.accent },
  dayText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  dayTextActive: { color: '#FFF' },
  recurrenceRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  recChip: { flex: 1, backgroundColor: colors.background, borderRadius: radii.medium, paddingVertical: 12, alignItems: 'center' },
  recChipActive: { backgroundColor: colors.accent },
  recText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  recTextActive: { color: '#FFF' },
  createBtn: { backgroundColor: colors.accent, borderRadius: radii.button, paddingVertical: 14, alignItems: 'center' },
  createBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  schedCard: { backgroundColor: colors.cardBackground, borderRadius: radii.medium, padding: spacing.md, marginBottom: spacing.sm },
  schedHeader: { flexDirection: 'row', alignItems: 'center' },
  schedName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  schedDetail: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  removeBtn: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  removeBtnText: { fontSize: 13, color: colors.danger, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: spacing.xl },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  emptyDesc: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  infoCard: { flexDirection: 'row', backgroundColor: '#FFF8E1', borderRadius: radii.medium, padding: spacing.md, marginTop: spacing.lg, alignItems: 'flex-start' },
  infoIcon: { fontSize: 18, marginRight: spacing.sm },
  infoText: { fontSize: 13, color: '#F57F17', flex: 1, lineHeight: 19 },
});
