import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDataStore } from '../../state/DataStore';
import { useMessageStore } from '../../state/MessageStore';
import { colors } from '../../theme/theme';
import type { Order } from '../../models/Order';

type TabKey = 'drivers' | 'customers';

const ROLE_COLORS: Record<string, string> = {
  driver: '#20C997',
  customer: '#4A90D9',
  admin: '#845EF7',
};

/* ── Driver / Customer card data ── */
interface UserSummary {
  id: string;
  name: string;
  role: string;
  totalOrders: number;
  totalRevenue: number;
  activeOrders: number;
  avgRating: number;
  ratingCount: number;
  lastActivity: string | null;
}

/* ── Detail Modal ── */
const UserDetailModal: React.FC<{
  visible: boolean;
  user: UserSummary | null;
  orders: Order[];
  onClose: () => void;
}> = ({ visible, user, orders, onClose }) => {
  if (!user) return null;
  const userOrders = orders
    .filter(o =>
      user.role === 'driver' ? o.driverId === user.id : o.customerId === user.id,
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <Pressable style={s.modalSheet} onPress={e => e.stopPropagation()}>
          <View style={s.modalHandle} />
          {/* Header */}
          <View style={s.detailHeader}>
            <View style={[s.detailAvatar, { backgroundColor: ROLE_COLORS[user.role] ?? colors.accent }]}>
              <Text style={s.detailAvatarText}>{user.name.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.detailName}>{user.name}</Text>
              <View style={s.detailMeta}>
                <View style={[s.rolePill, { backgroundColor: (ROLE_COLORS[user.role] ?? colors.accent) + '18' }]}>
                  <Text style={[s.rolePillText, { color: ROLE_COLORS[user.role] ?? colors.accent }]}>
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </Text>
                </View>
                {user.avgRating > 0 && (
                  <Text style={s.detailRating}>{'\u2B50'} {user.avgRating.toFixed(1)} ({user.ratingCount})</Text>
                )}
              </View>
            </View>
          </View>

          {/* Stats */}
          <View style={s.statsGrid}>
            <View style={s.statBox}>
              <Text style={s.statNum}>{user.totalOrders}</Text>
              <Text style={s.statLabel}>Orders</Text>
            </View>
            <View style={s.statBox}>
              <Text style={s.statNum}>${user.totalRevenue.toFixed(0)}</Text>
              <Text style={s.statLabel}>Revenue</Text>
            </View>
            <View style={s.statBox}>
              <Text style={[s.statNum, { color: user.activeOrders > 0 ? colors.accent : colors.textSecondary }]}>{user.activeOrders}</Text>
              <Text style={s.statLabel}>Active</Text>
            </View>
          </View>

          {/* Recent orders */}
          <Text style={s.detailSection}>Recent Orders</Text>
          {userOrders.length === 0 ? (
            <Text style={s.noData}>No orders found</Text>
          ) : (
            userOrders.map(o => (
              <View key={o.id} style={s.orderRow}>
                <View style={s.orderLeft}>
                  <Text style={s.orderId}>#{o.id.slice(0, 6)}</Text>
                  <Text style={s.orderDate}>
                    {new Date(o.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <Text style={s.orderTotal}>${o.total.toFixed(2)}</Text>
                <View style={[s.orderPill, { backgroundColor: statusColor(o.status) + '18' }]}>
                  <Text style={[s.orderPillText, { color: statusColor(o.status) }]}>
                    {o.status.replace(/_/g, ' ')}
                  </Text>
                </View>
              </View>
            ))
          )}

          <Pressable style={s.closeModalBtn} onPress={onClose}>
            <Text style={s.closeModalText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

function statusColor(status: string): string {
  const map: Record<string, string> = {
    PLACED: '#4A90D9',
    ACCEPTED: '#845EF7',
    PREPARING: '#F59E0B',
    READY: '#20C997',
    PICKED_UP: '#20C997',
    OUT_FOR_DELIVERY: colors.accent,
    DELIVERED: colors.success,
    CANCELED: colors.danger,
  };
  return map[status] ?? colors.accent;
}

/* ──────────────────────────── Main Screen ──────────────────────────── */

export const AdminUsersScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { orders, drivers } = useDataStore();
  const { getAverageRating, getRatingsForDriver } = useMessageStore();

  const [tab, setTab] = useState<TabKey>('drivers');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null);

  /* Build driver summaries */
  const driverSummaries = useMemo<UserSummary[]>(() => {
    const driverIds = new Set<string>();
    orders.forEach(o => { if (o.driverId) driverIds.add(o.driverId); });
    drivers.forEach(d => driverIds.add(d.id));

    return Array.from(driverIds).map(id => {
      const driverOrders = orders.filter(o => o.driverId === id);
      const driver = drivers.find(d => d.id === id);
      const delivered = driverOrders.filter(o => o.status === 'DELIVERED');
      const active = driverOrders.filter(o => !['DELIVERED', 'CANCELED'].includes(o.status));
      const ratings = getRatingsForDriver(id);
      const avg = getAverageRating(id);
      const last = driverOrders.length > 0
        ? driverOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt
        : null;

      return {
        id,
        name: driver?.name ?? driverOrders[0]?.driverName ?? 'Unknown Driver',
        role: 'driver',
        totalOrders: driverOrders.length,
        totalRevenue: delivered.reduce((sum, o) => sum + o.total, 0),
        activeOrders: active.length,
        avgRating: avg,
        ratingCount: ratings.length,
        lastActivity: last,
      };
    });
  }, [orders, drivers, getRatingsForDriver, getAverageRating]);

  /* Build customer summaries */
  const customerSummaries = useMemo<UserSummary[]>(() => {
    const custMap = new Map<string, Order[]>();
    orders.forEach(o => {
      const arr = custMap.get(o.customerId) ?? [];
      arr.push(o);
      custMap.set(o.customerId, arr);
    });

    return Array.from(custMap.entries()).map(([id, custOrders]) => {
      const delivered = custOrders.filter(o => o.status === 'DELIVERED');
      const active = custOrders.filter(o => !['DELIVERED', 'CANCELED'].includes(o.status));
      const last = custOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt ?? null;

      return {
        id,
        name: custOrders[0]?.customerName ?? 'Unknown',
        role: 'customer',
        totalOrders: custOrders.length,
        totalRevenue: delivered.reduce((sum, o) => sum + o.total, 0),
        activeOrders: active.length,
        avgRating: 0,
        ratingCount: 0,
        lastActivity: last,
      };
    });
  }, [orders]);

  const data = tab === 'drivers' ? driverSummaries : customerSummaries;
  const filtered = data.filter(u => u.name.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => b.totalOrders - a.totalOrders);

  const renderUser = ({ item }: { item: UserSummary }) => (
    <Pressable
      style={({ pressed }) => [s.userCard, pressed && { transform: [{ scale: 0.98 }] }]}
      onPress={() => setSelectedUser(item)}
    >
      <View style={[s.avatar, { backgroundColor: ROLE_COLORS[item.role] ?? colors.accent }]}>
        <Text style={s.avatarText}>{item.name.charAt(0)}</Text>
      </View>
      <View style={s.userInfo}>
        <Text style={s.userName}>{item.name}</Text>
        <Text style={s.userMeta}>
          {item.totalOrders} orders {'\u00B7'} ${item.totalRevenue.toFixed(0)} revenue
          {item.activeOrders > 0 ? ` \u00B7 ${item.activeOrders} active` : ''}
        </Text>
      </View>
      <View style={s.userRight}>
        {item.avgRating > 0 && (
          <Text style={s.ratingBadge}>{'\u2B50'} {item.avgRating.toFixed(1)}</Text>
        )}
        <Text style={s.chevron}>{'\u203A'}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Users</Text>
        <Text style={s.subtitle}>
          {driverSummaries.length} drivers {'\u00B7'} {customerSummaries.length} customers
        </Text>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['drivers', 'customers'] as TabKey[]).map(t => (
          <Pressable
            key={t}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'drivers' ? `\uD83D\uDE97 Drivers (${driverSummaries.length})` : `\uD83D\uDC64 Customers (${customerSummaries.length})`}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>{'\uD83D\uDD0D'}</Text>
        <TextInput
          style={s.searchInput}
          placeholder={`Search ${tab}...`}
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Text style={s.clearBtn}>{'\u2715'}</Text>
          </Pressable>
        )}
      </View>

      {/* List */}
      <FlatList
        data={sorted}
        keyExtractor={item => item.id}
        renderItem={renderUser}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={{ fontSize: 36 }}>{tab === 'drivers' ? '\uD83D\uDE97' : '\uD83D\uDC64'}</Text>
            <Text style={s.emptyText}>No {tab} found</Text>
          </View>
        }
      />

      <UserDetailModal
        visible={!!selectedUser}
        user={selectedUser}
        orders={orders}
        onClose={() => setSelectedUser(null)}
      />
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFBFE' },

  /* Header */
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  title: { fontSize: 28, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  /* Tabs */
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginTop: 14, marginBottom: 10 },
  tabBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center',
    backgroundColor: '#F5F5FA', borderWidth: 1, borderColor: '#EDEDF0',
  },
  tabBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  tabTextActive: { color: '#FFF' },

  /* Search */
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 12,
    backgroundColor: '#FFF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: '#F0F0F5',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
  clearBtn: { fontSize: 16, color: colors.textSecondary, padding: 4 },

  /* List */
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  userCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 18, padding: 14,
    marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  userMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  userRight: { alignItems: 'flex-end', gap: 4 },
  ratingBadge: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },
  chevron: { fontSize: 22, color: colors.textTertiary, fontWeight: '300' },

  /* Empty */
  emptyBox: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 15, color: colors.textSecondary, marginTop: 8, fontWeight: '600' },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40, maxHeight: '85%',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },

  /* Detail */
  detailHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  detailAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  detailAvatarText: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  detailName: { fontSize: 22, fontWeight: '900', color: colors.textPrimary },
  detailMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  rolePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  rolePillText: { fontSize: 12, fontWeight: '700' },
  detailRating: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },

  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statBox: {
    flex: 1, backgroundColor: '#F5F5FA', borderRadius: 14, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#EDEDF0',
  },
  statNum: { fontSize: 22, fontWeight: '900', color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontWeight: '600' },

  detailSection: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 },
  noData: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', padding: 20 },

  orderRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5FA', borderRadius: 12,
    padding: 12, marginBottom: 8,
  },
  orderLeft: { flex: 1 },
  orderId: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  orderDate: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  orderTotal: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginRight: 10 },
  orderPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  orderPillText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

  closeModalBtn: {
    backgroundColor: '#F5F5FA', borderRadius: 16, paddingVertical: 14, alignItems: 'center', marginTop: 16,
  },
  closeModalText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },
});
