import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../state/AuthStore';
import { useDriverStore } from '../../state/DriverStore';
import { useOrdersQuery } from '../../hooks/useOrdersQuery';
import { supabase } from '../../lib/supabase';
import { colors, spacing, radii } from '../../theme/theme';
import { Card } from '../../theme/components/Card';
import { SectionHeader } from '../../theme/components/SectionHeader';

interface DriverRatingRow {
  driver_rating: number | null;
  created_at: string;
}

export const DriverProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuthStore();
  const { isOnline } = useDriverStore();
  const router = useRouter();

  const { data: allOrders = [], isLoading } = useOrdersQuery(user?.id, 'driver');
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [ratingsLoading, setRatingsLoading] = useState(true);

  /* ── Derived stats from real orders ── */
  const delivered = allOrders.filter(o => o.driverId === user?.id && o.status === 'DELIVERED');
  const totalDeliveries = delivered.length;

  /* On-time = delivered where actual <= estimated (both must exist) */
  const withBothTimes = delivered.filter(o => o.estimatedDeliveryTime && o.actualDeliveryTime);
  const onTimeCount = withBothTimes.filter(
    o => new Date(o.actualDeliveryTime!) <= new Date(o.estimatedDeliveryTime!),
  ).length;
  const onTimeRate = withBothTimes.length > 0
    ? Math.round((onTimeCount / withBothTimes.length) * 100)
    : null;

  /* ── Fetch real rating from order_feedback ── */
  useEffect(() => {
    if (!user) return;
    setRatingsLoading(true);
    supabase
      .from('order_feedback')
      .select('driver_rating, created_at')
      .eq('driver_id', user.id)
      .not('driver_rating', 'is', null)
      .returns<DriverRatingRow[]>()
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const sum = data.reduce((acc, r) => acc + (r.driver_rating ?? 0), 0);
          setAvgRating(Math.round((sum / data.length) * 10) / 10);
        }
        setRatingsLoading(false);
      });
  }, [user?.id]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Profile</Text>

      {/* ── Driver Info ── */}
      <Card style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: isOnline ? '#10B981' : colors.accent }]}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0) ?? 'D'}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.name ?? 'Driver'}</Text>
          <Text style={styles.profileEmail}>{user?.email ?? ''}</Text>
          <View style={[styles.onlinePill, isOnline ? styles.onlinePillOn : styles.onlinePillOff]}>
            <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#10B981' : '#9CA3AF' }]} />
            <Text style={[styles.onlinePillText, { color: isOnline ? '#065F46' : '#374151' }]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
      </Card>

      {/* ── Performance Stats ── */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        <SectionHeader title="Performance" />
      </View>
      {isLoading || ratingsLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{totalDeliveries}</Text>
            <Text style={styles.statLabel}>Deliveries</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: avgRating && avgRating >= 4.5 ? '#10B981' : colors.accent }]}>
              {avgRating !== null ? avgRating.toFixed(1) : '—'}
            </Text>
            <Text style={styles.statLabel}>Rating</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>
              {onTimeRate !== null ? `${onTimeRate}%` : '—'}
            </Text>
            <Text style={styles.statLabel}>On Time</Text>
          </Card>
        </View>
      )}

      {/* ── Vehicle Info (static until profile editing is built) ── */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        <SectionHeader title="Vehicle Information" />
      </View>
      <Card style={styles.infoCard}>
        {[
          { label: 'Vehicle', value: 'Honda Civic 2022' },
          { label: 'License Plate', value: 'ABC-1234' },
          { label: 'Insurance', value: 'Active' },
          { label: 'Background Check', value: 'Verified' },
        ].map(item => (
          <View key={item.label} style={styles.infoRow}>
            <Text style={styles.infoLabel}>{item.label}</Text>
            <Text style={styles.infoValue}>{item.value}</Text>
          </View>
        ))}
      </Card>

      {/* ── Support ── */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        <SectionHeader title="Support" />
      </View>
      {['Help Center', 'Contact Support', 'Report an Issue'].map(item => (
        <Card key={item} style={styles.menuItem}>
          <Text style={styles.menuItemText}>{item}</Text>
          <Text style={styles.menuItemArrow}>›</Text>
        </Card>
      ))}

      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  profileCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.lg, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  profileEmail: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  onlinePill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginTop: 8 },
  onlinePillOn: { backgroundColor: '#ECFDF5' },
  onlinePillOff: { backgroundColor: '#F3F4F6' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  onlinePillText: { fontSize: 12, fontWeight: '700' },
  loadingRow: { paddingVertical: 20, alignItems: 'center' },
  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flex: 1, padding: spacing.md, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.accent },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  infoCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  infoValue: { fontSize: 14, color: colors.textSecondary },
  menuItem: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  menuItemText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  menuItemArrow: { fontSize: 20, color: colors.textSecondary },
  signOutButton: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, borderRadius: radii.medium, backgroundColor: colors.danger, alignItems: 'center' },
  signOutText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
