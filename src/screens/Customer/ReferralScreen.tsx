import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useReferralStore } from '../../state/ReferralStore';
import { useAuthStore } from '../../state/AuthStore';
import { colors, spacing, radii } from '../../theme/theme';

const REWARDS_TIERS = [
  { count: 1, reward: '$5 credit', icon: '\uD83C\uDF81' },
  { count: 3, reward: 'Free delivery (1 week)', icon: '\uD83D\uDE9A' },
  { count: 5, reward: '$15 credit', icon: '\uD83D\uDCB0' },
  { count: 10, reward: 'Gold status + $30 credit', icon: '\uD83C\uDFC6' },
];

export const ReferralScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthStore();
  const { data, isLoaded, load, getShareMessage } = useReferralStore();

  useEffect(() => {
    if (user && !isLoaded) load(user.id);
  }, [user, isLoaded, load]);

  const handleShare = async () => {
    try {
      await Share.share({ message: getShareMessage() });
    } catch {}
  };

  const handleCopyCode = () => {
    // On web, use clipboard API
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(data.referralCode);
    }
  };

  return (
    <ScrollView style={[s.container, { paddingTop: insets.top }]} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={s.back}>{'\u2190'}</Text>
        </Pressable>
        <Text style={s.title}>{'\uD83C\uDF81'} Refer & Earn</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Hero Card */}
      <View style={s.heroCard}>
        <Text style={s.heroIcon}>{'\uD83E\uDD1D'}</Text>
        <Text style={s.heroTitle}>Give $5, Get $5</Text>
        <Text style={s.heroDesc}>
          Share your code with friends. When they order, you both get $5 credit!
        </Text>

        {/* Code Box */}
        <View style={s.codeBox}>
          <Text style={s.codeLabel}>Your referral code</Text>
          <Pressable style={s.codeRow} onPress={handleCopyCode}>
            <Text style={s.codeText}>{data.referralCode || '...'}</Text>
            <Text style={s.copyBtn}>{'\uD83D\uDCCB'} Copy</Text>
          </Pressable>
        </View>

        {/* Share Button */}
        <Pressable style={s.shareBtn} onPress={handleShare}>
          <Text style={s.shareBtnText}>{'\uD83D\uDCE4'} Share with Friends</Text>
        </Pressable>
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statValue}>{data.referralsCount}</Text>
          <Text style={s.statLabel}>Friends Referred</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statValue}>${data.creditsEarned.toFixed(0)}</Text>
          <Text style={s.statLabel}>Credits Earned</Text>
        </View>
      </View>

      {/* Rewards Tiers */}
      <Text style={s.sectionTitle}>Milestone Rewards</Text>
      {REWARDS_TIERS.map((tier, i) => {
        const reached = data.referralsCount >= tier.count;
        return (
          <View key={i} style={[s.tierCard, reached && s.tierCardReached]}>
            <Text style={s.tierIcon}>{tier.icon}</Text>
            <View style={s.tierInfo}>
              <Text style={[s.tierCount, reached && s.tierCountReached]}>
                {tier.count} referral{tier.count > 1 ? 's' : ''}
              </Text>
              <Text style={s.tierReward}>{tier.reward}</Text>
            </View>
            {reached && <Text style={s.tierCheck}>{'\u2705'}</Text>}
          </View>
        );
      })}

      {/* Referred Friends */}
      {data.referredUsers.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Your Referrals</Text>
          {data.referredUsers.map((name, i) => (
            <View key={i} style={s.friendRow}>
              <View style={s.friendAvatar}>
                <Text style={s.friendAvatarText}>{name.charAt(0)}</Text>
              </View>
              <Text style={s.friendName}>{name}</Text>
              <Text style={s.friendCredit}>+$5</Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  back: { fontSize: 24, color: colors.textPrimary },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  heroCard: {
    marginHorizontal: 16, backgroundColor: '#FFF', borderRadius: 20,
    padding: 24, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  heroIcon: { fontSize: 48, marginBottom: 12 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#111', marginBottom: 8 },
  heroDesc: { fontSize: 14, color: '#777', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  codeBox: {
    width: '100%', backgroundColor: '#FFF8F0', borderRadius: 14,
    padding: 16, borderWidth: 1.5, borderColor: '#FF8C1A', borderStyle: 'dashed',
  },
  codeLabel: { fontSize: 12, color: '#999', marginBottom: 8, textAlign: 'center' },
  codeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  codeText: { fontSize: 22, fontWeight: '800', color: '#FF8C1A', letterSpacing: 2 },
  copyBtn: { fontSize: 14, color: '#FF8C1A', fontWeight: '600' },
  shareBtn: {
    marginTop: 20, backgroundColor: '#FF8C1A', paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 24, width: '100%', alignItems: 'center',
  },
  shareBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row', gap: 12, marginHorizontal: 16, marginTop: 16,
  },
  statCard: {
    flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 20, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  statValue: { fontSize: 28, fontWeight: '800', color: '#111' },
  statLabel: { fontSize: 12, color: '#999', marginTop: 4 },
  sectionTitle: {
    fontSize: 18, fontWeight: '700', color: '#111',
    marginHorizontal: 16, marginTop: 24, marginBottom: 12,
  },
  tierCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', marginHorizontal: 16, marginBottom: 8,
    borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1,
  },
  tierCardReached: { backgroundColor: '#F0FFF4', borderWidth: 1, borderColor: '#C6F6D5' },
  tierIcon: { fontSize: 28, marginRight: 14 },
  tierInfo: { flex: 1 },
  tierCount: { fontSize: 14, fontWeight: '600', color: '#555' },
  tierCountReached: { color: '#22C55E' },
  tierReward: { fontSize: 13, color: '#999', marginTop: 2 },
  tierCheck: { fontSize: 20 },
  friendRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8, backgroundColor: '#FFF',
    borderRadius: 12, padding: 14,
  },
  friendAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF8C1A20',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  friendAvatarText: { fontSize: 16, fontWeight: '700', color: '#FF8C1A' },
  friendName: { flex: 1, fontSize: 15, fontWeight: '500', color: '#333' },
  friendCredit: { fontSize: 14, fontWeight: '700', color: '#22C55E' },
});
