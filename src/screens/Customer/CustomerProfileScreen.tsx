import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../state/AuthStore';
import { useNotificationStore } from '../../state/NotificationStore';
import { colors, spacing, radii } from '../../theme/theme';

const DIETARY_LABEL_MAP: Record<string, string> = {
  gluten_free: 'Gluten-Free',
  nut_allergy: 'Nut Allergy',
  dairy_free: 'Dairy-Free',
  vegan: 'Vegan',
  vegetarian: 'Vegetarian',
  halal: 'Halal',
  kosher: 'Kosher',
  shellfish: 'Shellfish',
  soy_free: 'Soy-Free',
  egg_free: 'Egg-Free',
};

interface SettingsRow {
  icon: string;
  label: string;
  route: string;
  badge?: number;
}

export const CustomerProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuthStore();
  const unread = useNotificationStore(s => s.unreadCount);
  const router = useRouter();

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

  const memory = user?.foodMemory;

  const quickLinks = [
    { icon: 'heart-outline' as const, label: 'Favorites', route: '/customer/favorites', color: '#FF4757' },
    { icon: 'people-outline' as const, label: 'Group Order', route: '/customer/group', color: '#339AF0' },
    { icon: 'gift-outline' as const, label: 'Refer & Earn', route: '/customer/referral', color: '#E64980' },
    { icon: 'mic-outline' as const, label: 'AI Assistant', route: '/voice/call', color: '#845EF7' },
  ];

  const settingsRows: SettingsRow[] = [
    { icon: '\uD83D\uDD14', label: 'Notifications', route: '/customer/notifications', badge: unread() },
    { icon: '\uD83D\uDCB3', label: 'Payment Methods', route: '/customer/payments' },
    { icon: '\uD83D\uDCCD', label: 'Saved Addresses', route: '/customer/addresses' },
    { icon: '\uD83D\uDEE1\uFE0F', label: 'Dietary Profile', route: '/customer/dietary' },
    { icon: '\u23F0', label: 'Scheduled Orders', route: '/customer/schedule' },
    { icon: '\u2B50', label: 'Loyalty & Rewards', route: '/customer/loyalty' },
    { icon: '\u2753', label: 'Help & Support', route: '/customer/help' },
  ];

  return (
    <ScrollView style={[st.container, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: 100 }}>
      <Text style={st.title}>Account</Text>

      {/* User Info Card */}
      <View style={st.profileCard}>
        <View style={st.avatarOuter}>
          <View style={st.avatar}>
            <Text style={st.avatarText}>{user?.name?.charAt(0) ?? 'U'}</Text>
          </View>
        </View>
        <Text style={st.profileName}>{user?.name ?? 'User'}</Text>
        <Text style={st.profileEmail}>{user?.email ?? ''}</Text>
        {user?.phone ? (
          <View style={st.phoneBadge}>
            <Text style={st.phoneIcon}>{'\uD83D\uDCDE'}</Text>
            <Text style={st.phoneText}>{user.phone}</Text>
          </View>
        ) : null}
      </View>

      {/* Food Preferences Summary */}
      {memory && (memory.dietaryRestrictions?.length > 0 || memory.dislikedIngredients?.length > 0 || memory.defaultDrink || memory.preferredCuisines?.length > 0) && (
        <Pressable style={st.prefsCard} onPress={() => router.push('/customer/dietary')}>
          <View style={st.prefsHeader}>
            <Text style={st.prefsTitle}>{'\uD83C\uDF7D\uFE0F'} Food Preferences</Text>
            <Text style={st.prefsEdit}>Edit {'\u203A'}</Text>
          </View>

          {memory.dietaryRestrictions?.length > 0 && (
            <View style={st.chipRow}>
              {memory.dietaryRestrictions.map(r => (
                <View key={r} style={st.dietChip}>
                  <Text style={st.dietChipText}>{DIETARY_LABEL_MAP[r] ?? r}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={st.prefsGrid}>
            {memory.spiceLevel && (
              <View style={st.prefItem}>
                <Text style={st.prefIcon}>{'\uD83C\uDF36\uFE0F'}</Text>
                <Text style={st.prefText}>{memory.spiceLevel}</Text>
              </View>
            )}
            {memory.defaultDrink && (
              <View style={st.prefItem}>
                <Text style={st.prefIcon}>{'\uD83E\uDD64'}</Text>
                <Text style={st.prefText}>{memory.defaultDrink}</Text>
              </View>
            )}
            {memory.dislikedIngredients?.length > 0 && (
              <View style={st.prefItem}>
                <Text style={st.prefIcon}>{'\u26A0\uFE0F'}</Text>
                <Text style={st.prefText} numberOfLines={1}>Avoids: {memory.dislikedIngredients.join(', ')}</Text>
              </View>
            )}
          </View>

          {memory.preferredCuisines?.length > 0 && (
            <View style={st.chipRow}>
              {memory.preferredCuisines.map(c => (
                <View key={c} style={st.cuisineChip}>
                  <Text style={st.cuisineChipText}>{c}</Text>
                </View>
              ))}
            </View>
          )}
        </Pressable>
      )}

      {/* Quick Access */}
      <View style={st.quickGrid}>
        {quickLinks.map(q => (
          <Pressable key={q.label} style={({ pressed }) => [st.quickCard, pressed && { opacity: 0.7 }]} onPress={() => router.push(q.route as any)}>
            <View style={[st.quickIconWrap, { backgroundColor: q.color + '15' }]}>
              <Ionicons name={q.icon} size={22} color={q.color} />
            </View>
            <Text style={st.quickLabel}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Settings */}
      <Text style={st.sectionTitle}>Settings</Text>
      <View style={st.settingsCard}>
        {settingsRows.map((row, idx) => (
          <Pressable
            key={row.label}
            style={[st.settingsRow, idx < settingsRows.length - 1 && st.settingsRowBorder]}
            onPress={() => router.push(row.route as any)}
          >
            <View style={st.settingsLeft}>
              <View style={st.settingsIcon}>
                <Text style={{ fontSize: 18 }}>{row.icon}</Text>
              </View>
              <Text style={st.settingsLabel}>{row.label}</Text>
            </View>
            <View style={st.settingsRight}>
              {row.badge && row.badge > 0 ? (
                <View style={st.badge}>
                  <Text style={st.badgeText}>{row.badge}</Text>
                </View>
              ) : null}
              <Text style={st.settingsArrow}>{'\u203A'}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Sign Out */}
      <Pressable style={({ pressed }) => [st.signOutButton, pressed && { opacity: 0.8 }]} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={st.signOutText}>Sign Out</Text>
      </Pressable>

      <Text style={st.version}>SmartFood v1.0.0</Text>
    </ScrollView>
  );
};

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },

  profileCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.lg, backgroundColor: colors.cardBackground, borderRadius: radii.large, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  avatarOuter: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: colors.accent, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 30, fontWeight: '700', color: '#FFFFFF' },
  profileName: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  profileEmail: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  phoneBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, marginTop: 8 },
  phoneIcon: { fontSize: 14, marginRight: 4 },
  phoneText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },

  prefsCard: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.md, backgroundColor: colors.cardBackground, borderRadius: radii.medium, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  prefsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  prefsTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  prefsEdit: { fontSize: 13, fontWeight: '600', color: colors.accent },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  dietChip: { backgroundColor: '#FFEBEE', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  dietChipText: { fontSize: 12, fontWeight: '600', color: '#C62828' },
  prefsGrid: { gap: 6, marginBottom: 4 },
  prefItem: { flexDirection: 'row', alignItems: 'center' },
  prefIcon: { fontSize: 14, marginRight: 6 },
  prefText: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  cuisineChip: { backgroundColor: colors.accent + '15', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  cuisineChipText: { fontSize: 12, fontWeight: '600', color: colors.accent },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginHorizontal: spacing.lg, marginBottom: spacing.md },
  quickCard: { width: '48%', backgroundColor: colors.cardBackground, borderRadius: radii.medium, padding: 14, alignItems: 'center', marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  quickIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickLabel: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: spacing.lg, marginBottom: spacing.sm, marginTop: spacing.sm },
  settingsCard: { marginHorizontal: spacing.lg, backgroundColor: colors.cardBackground, borderRadius: radii.medium, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.md },
  settingsRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  settingsLeft: { flexDirection: 'row', alignItems: 'center' },
  settingsIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  settingsLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  settingsRight: { flexDirection: 'row', alignItems: 'center' },
  badge: { backgroundColor: colors.danger, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginRight: 8 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  settingsArrow: { fontSize: 22, color: colors.textSecondary },

  signOutButton: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md, borderRadius: radii.medium, backgroundColor: colors.cardBackground, borderWidth: 1.5, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center', gap: 8 },
  signOutText: { fontSize: 15, fontWeight: '700', color: colors.danger },
  version: { textAlign: 'center', fontSize: 12, color: colors.textSecondary, marginTop: spacing.md },
});
