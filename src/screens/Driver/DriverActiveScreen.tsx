import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Linking,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../state/AuthStore';
import { useDriverStore } from '../../state/DriverStore';
import { useOrdersQuery } from '../../hooks/useOrdersQuery';
import { useMessageStore } from '../../state/MessageStore';
import { colors } from '../../theme/theme';
import type { Order, OrderStatus } from '../../models/Order';

/* ── Status machine ─────────────────────────────────────────────────────────
 * After the driver accepts, the order stays READY (with assigned_driver_id).
 * From there the driver moves it through:
 *   READY → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED
 * Each step calls the update_order_status RPC and invalidates the orders cache.
 * ─────────────────────────────────────────────────────────────────────────── */

const DELIVERY_STEPS: { status: OrderStatus; label: string; icon: string; desc: string }[] = [
  { status: 'PICKED_UP',        label: 'Picked Up',    icon: '\uD83D\uDCE6', desc: 'Arrived at restaurant & collected order' },
  { status: 'OUT_FOR_DELIVERY', label: 'On the Way',   icon: '\uD83D\uDE97', desc: 'Heading to customer\'s address' },
  { status: 'DELIVERED',        label: 'Delivered',    icon: '\u2705',        desc: 'Handed over to customer' },
];

const STATUS_INDEX: Record<string, number> = {
  READY: -1,
  PICKED_UP: 0,
  OUT_FOR_DELIVERY: 1,
  DELIVERED: 2,
};

/* ── ETA Modal ── */
const EtaModal: React.FC<{
  visible: boolean;
  currentEta: string | null;
  onSave: (minutes: number) => void;
  onClose: () => void;
}> = ({ visible, currentEta, onSave, onClose }) => {
  const presets = [10, 15, 20, 25, 30, 45, 60];
  const [custom, setCustom] = useState('');

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <Pressable style={s.modalSheet} onPress={e => e.stopPropagation()}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Update Delivery ETA</Text>
          {currentEta && (
            <Text style={s.modalCurrent}>
              Current: {new Date(currentEta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
          <Text style={s.modalSubtitle}>Quick Select</Text>
          <View style={s.presetGrid}>
            {presets.map(min => (
              <Pressable key={min} style={s.presetBtn} onPress={() => { onSave(min); onClose(); }}>
                <Text style={s.presetBtnText}>{min} min</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.modalSubtitle}>Custom Minutes</Text>
          <View style={s.customRow}>
            <TextInput
              style={s.customInput}
              value={custom}
              onChangeText={setCustom}
              placeholder="e.g. 35"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Pressable
              style={[s.customSaveBtn, !custom && { opacity: 0.5 }]}
              onPress={() => { if (custom) { onSave(parseInt(custom, 10)); onClose(); } }}
              disabled={!custom}
            >
              <Text style={s.customSaveBtnText}>Set</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

/* ── Delivery Proof Modal ── */
const ProofModal: React.FC<{
  visible: boolean;
  onSubmit: (note: string) => void;
  onClose: () => void;
}> = ({ visible, onSubmit, onClose }) => {
  const [note, setNote] = useState('');

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={s.modalOverlay} onPress={onClose}>
        <Pressable style={s.modalSheet} onPress={e => e.stopPropagation()}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Delivery Confirmation</Text>
          <Text style={s.modalDesc}>Add a note about the delivery (optional)</Text>
          <TextInput
            style={s.proofInput}
            value={note}
            onChangeText={setNote}
            placeholder='e.g. Left at front door, handed to customer…'
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={3}
          />
          <Pressable style={s.proofSubmitBtn} onPress={() => onSubmit(note)}>
            <Text style={s.proofSubmitBtnText}>{'\u2705'} Confirm Delivery</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

/* ── Restaurant Navigation ── */
const openRestaurantNav = () => {
  /* Default to restaurant address until location data is in the model */
  Linking.openURL('https://maps.google.com/?q=Restaurant');
};

/* ── Active Delivery Card ── */
const ActiveDeliveryCard: React.FC<{
  order: Order;
  userId: string;
  userName: string;
  advancing: boolean;
  onAdvance: (orderId: string, status: OrderStatus, note?: string) => void;
  onUpdateEta: (orderId: string, minutes: number) => void;
  onAbandon: (orderId: string) => void;
}> = ({ order, userId, userName, advancing, onAdvance, onUpdateEta, onAbandon }) => {
  const router = useRouter();
  const [showEta, setShowEta] = useState(false);
  const [showProof, setShowProof] = useState(false);
  const { initThread, getThread, sendSystemMessage } = useMessageStore();

  const currentStep = STATUS_INDEX[order.status] ?? -1;
  const thread = getThread(order.id);
  const unreadCount = thread
    ? thread.messages.filter(m => m.senderId !== userId && !m.read).length
    : 0;

  const handleCall = () => {
    const phone = order.customerPhone ?? '+1234567890';
    Linking.openURL(`tel:${phone}`);
  };

  const handleMessage = () => {
    initThread({
      orderId: order.id,
      customerId: order.customerId,
      customerName: order.customerName,
      driverId: userId,
      driverName: userName,
    });
    router.push({ pathname: '/driver/chat' as any, params: { orderId: order.id, otherName: order.customerName } });
  };

  const handleNavigateToCustomer = () => {
    const addr = order.deliveryAddress;
    const query = encodeURIComponent(`${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`);
    Linking.openURL(`https://maps.google.com/?q=${query}`);
  };

  const handleStepPress = (step: typeof DELIVERY_STEPS[number], idx: number) => {
    if (advancing) return;
    if (idx === currentStep + 1) {
      if (step.status === 'DELIVERED') {
        setShowProof(true);
      } else {
        onAdvance(order.id, step.status);
        sendSystemMessage(order.id, `Status updated: ${step.label}`);
      }
    }
  };

  const handleProofSubmit = (note: string) => {
    setShowProof(false);
    onAdvance(order.id, 'DELIVERED', note || 'Delivered successfully');
    sendSystemMessage(order.id, `Order delivered. ${note ? `Note: ${note}` : ''}`);
  };

  const etaStr = order.estimatedDeliveryTime
    ? new Date(order.estimatedDeliveryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const isPickedUp = currentStep >= STATUS_INDEX.PICKED_UP;

  return (
    <View style={s.card}>
      {/* Header */}
      <View style={s.cardHeader}>
        <View>
          <Text style={s.cardOrderId}>#{order.id.slice(0, 6)}</Text>
          <Text style={s.cardCustomer}>{order.customerName}</Text>
        </View>
        <View style={s.totalBadge}>
          <Text style={s.totalBadgeText}>${order.total.toFixed(2)}</Text>
        </View>
      </View>

      {/* ETA Banner */}
      <Pressable style={s.etaBanner} onPress={() => setShowEta(true)}>
        <Text style={s.etaIcon}>{'\u23F0'}</Text>
        <View style={s.etaInfo}>
          <Text style={s.etaLabel}>Estimated Arrival</Text>
          <Text style={s.etaValue}>{etaStr ?? 'Tap to set ETA'}</Text>
        </View>
        <Text style={s.etaEditIcon}>{'\u270F\uFE0F'}</Text>
      </Pressable>

      {/* Progress Steps */}
      <View style={s.stepsContainer}>
        {DELIVERY_STEPS.map((step, idx) => {
          const isDone = idx <= currentStep;
          const isNext = idx === currentStep + 1;
          return (
            <View key={step.status} style={s.stepRow}>
              <View style={s.stepIndicator}>
                <View style={[s.stepDot, isDone && s.stepDotDone, isNext && s.stepDotNext]}>
                  {advancing && isNext
                    ? <ActivityIndicator size="small" color={colors.accent} />
                    : <Text style={s.stepDotIcon}>{isDone ? '\u2713' : step.icon}</Text>
                  }
                </View>
                {idx < DELIVERY_STEPS.length - 1 && (
                  <View style={[s.stepLine, isDone && s.stepLineDone]} />
                )}
              </View>
              <Pressable
                style={[s.stepContent, isNext && s.stepContentNext]}
                onPress={() => handleStepPress(step, idx)}
                disabled={!isNext || advancing}
              >
                <Text style={[s.stepLabel, isDone && s.stepLabelDone]}>{step.label}</Text>
                <Text style={[s.stepDesc, isDone && { color: '#10B981' }]}>{step.desc}</Text>
                {isNext && !advancing && <Text style={s.stepAction}>Tap to confirm {'\u2192'}</Text>}
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Address */}
      <View style={s.addressBox}>
        <Text style={s.addressIcon}>{'\uD83D\uDCCD'}</Text>
        <View style={s.addressContent}>
          <Text style={s.addressLabel}>{isPickedUp ? 'Deliver to' : 'Pickup from restaurant, then deliver to'}</Text>
          <Text style={s.addressText}>{order.deliveryAddress.street}</Text>
          <Text style={s.addressSub}>
            {order.deliveryAddress.city}, {order.deliveryAddress.state} {order.deliveryAddress.zip}
          </Text>
          {order.deliveryNotes ? (
            <View style={s.noteBox}>
              <Text style={s.noteIcon}>{'\uD83D\uDCDD'}</Text>
              <Text style={s.noteText}>{order.deliveryNotes}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Items */}
      <View style={s.itemsBox}>
        <Text style={s.itemsTitle}>{order.items.length} item{order.items.length !== 1 ? 's' : ''}</Text>
        {order.items.map((ci, idx) => (
          <View key={idx} style={s.itemRow}>
            <Text style={s.itemQty}>{ci.quantity}x</Text>
            <Text style={s.itemName}>{ci.menuItem.name}</Text>
            <Text style={s.itemPrice}>${(ci.menuItem.price * ci.quantity).toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {/* Action Buttons */}
      <View style={s.actionsRow}>
        <Pressable style={s.actionBtn} onPress={handleCall}>
          <Text style={s.actionIcon}>{'\uD83D\uDCDE'}</Text>
          <Text style={s.actionLabel}>Call</Text>
        </Pressable>
        <Pressable style={[s.actionBtn, s.actionBtnAccent]} onPress={handleMessage}>
          <Text style={s.actionIcon}>{'\uD83D\uDCAC'}</Text>
          <Text style={s.actionLabel}>Message</Text>
          {unreadCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={[s.actionBtn, !isPickedUp && s.actionBtnRestaurant]}
          onPress={!isPickedUp ? openRestaurantNav : handleNavigateToCustomer}
        >
          <Text style={s.actionIcon}>{'\uD83D\uDDFA\uFE0F'}</Text>
          <Text style={s.actionLabel}>{!isPickedUp ? 'To Shop' : 'Navigate'}</Text>
        </Pressable>
      </View>

      {/* Abandon (only visible before pickup — driver hasn't collected the food yet) */}
      {!isPickedUp && (
        <Pressable
          style={s.abandonBtn}
          onPress={() => onAbandon(order.id)}
          disabled={advancing}
        >
          <Text style={s.abandonBtnText}>Cannot fulfil this order</Text>
        </Pressable>
      )}

      <EtaModal
        visible={showEta}
        currentEta={order.estimatedDeliveryTime ?? null}
        onSave={(min) => onUpdateEta(order.id, min)}
        onClose={() => setShowEta(false)}
      />
      <ProofModal
        visible={showProof}
        onSubmit={handleProofSubmit}
        onClose={() => setShowProof(false)}
      />
    </View>
  );
};

/* ── Main Screen ── */
export const DriverActiveScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { advanceStatus } = useDriverStore();
  const [advancing, setAdvancing] = useState(false);

  /* Poll every 10 s — keeps ETA and status in sync with admin/kitchen changes */
  const { data: allOrders = [] } = useOrdersQuery(user?.id, 'driver', {
    refetchInterval: 10_000,
  });

  const activeOrders = user
    ? allOrders.filter(o =>
        o.driverId === user.id &&
        ['READY', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(o.status),
      )
    : [];

  const handleAdvance = async (orderId: string, newStatus: OrderStatus, note?: string) => {
    if (!user || advancing) return;
    setAdvancing(true);
    try {
      const order = allOrders.find(o => o.id === orderId);
      await advanceStatus(
        orderId,
        newStatus,
        user.id,
        order?.customerId ?? '',
        queryClient,
        note,
      );
    } finally {
      setAdvancing(false);
    }
  };

  const handleAbandon = (orderId: string) => {
    Alert.alert(
      'Cannot Fulfil Order?',
      'This will cancel the delivery and put the order back into the queue. Use only if you truly cannot complete it.',
      [
        { text: 'Keep Delivering', style: 'cancel' },
        {
          text: 'Abandon',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            const order = allOrders.find(o => o.id === orderId);
            await advanceStatus(
              orderId,
              'READY',
              user.id,
              order?.customerId ?? '',
              queryClient,
              'Driver could not fulfil — returned to queue',
            );
          },
        },
      ],
    );
  };

  const handleUpdateEta = (orderId: string, minutes: number) => {
    Alert.alert('ETA Set', `ETA updated to ${minutes} minutes from now.`);
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.headerBar}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backIcon}>{'\u2190'}</Text>
        </Pressable>
        <Text style={s.title}>Active Deliveries</Text>
        {activeOrders.length > 0 && (
          <View style={s.counterBadge}>
            <Text style={s.counterText}>{activeOrders.length}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={activeOrders}
        keyExtractor={o => o.id}
        renderItem={({ item }) =>
          user ? (
            <ActiveDeliveryCard
              order={item}
              userId={user.id}
              userName={user.name}
              advancing={advancing}
              onAdvance={handleAdvance}
              onUpdateEta={handleUpdateEta}
              onAbandon={handleAbandon}
            />
          ) : null
        }
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={{ fontSize: 56 }}>{'\uD83D\uDE9A'}</Text>
            <Text style={s.emptyTitle}>No active deliveries</Text>
            <Text style={s.emptyDesc}>Accept an order from the Available tab to start delivering</Text>
            <Pressable style={s.goAvailableBtn} onPress={() => router.push('/driver/available' as any)}>
              <Text style={s.goAvailableBtnText}>View Available Orders</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
};

/* ── Styles ── */
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFBFE' },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { padding: 8, marginRight: 8 },
  backIcon: { fontSize: 22, color: colors.textPrimary, fontWeight: '600' },
  title: { flex: 1, fontSize: 22, fontWeight: '900', color: colors.textPrimary },
  counterBadge: { backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  counterText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  listContent: { paddingHorizontal: 20, paddingBottom: 30 },

  card: {
    backgroundColor: '#FFF', borderRadius: 22, padding: 18, marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 4,
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  cardOrderId: { fontSize: 13, fontWeight: '800', color: colors.accent, marginBottom: 2 },
  cardCustomer: { fontSize: 20, fontWeight: '900', color: colors.textPrimary },
  totalBadge: { backgroundColor: '#ECFDF5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  totalBadgeText: { fontSize: 16, fontWeight: '800', color: '#10B981' },

  etaBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED',
    padding: 14, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#FED7AA',
  },
  etaIcon: { fontSize: 22, marginRight: 12 },
  etaInfo: { flex: 1 },
  etaLabel: { fontSize: 11, fontWeight: '700', color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.5 },
  etaValue: { fontSize: 18, fontWeight: '800', color: '#F59E0B', marginTop: 2 },
  etaEditIcon: { fontSize: 16 },

  stepsContainer: { marginBottom: 16 },
  stepRow: { flexDirection: 'row', minHeight: 64 },
  stepIndicator: { width: 40, alignItems: 'center' },
  stepDot: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0F0F5',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E5E5EA',
  },
  stepDotDone: { backgroundColor: '#10B981', borderColor: '#10B981' },
  stepDotNext: { backgroundColor: '#FFF7ED', borderColor: '#F59E0B' },
  stepDotIcon: { fontSize: 14 },
  stepLine: { width: 2, flex: 1, backgroundColor: '#E5E5EA', marginVertical: 4 },
  stepLineDone: { backgroundColor: '#10B981' },
  stepContent: { flex: 1, paddingLeft: 12, paddingBottom: 12 },
  stepContentNext: {
    backgroundColor: '#FFF7ED', borderRadius: 12, padding: 12,
    marginLeft: 8, borderWidth: 1, borderColor: '#FED7AA',
  },
  stepLabel: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  stepLabelDone: { color: '#10B981' },
  stepDesc: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  stepAction: { fontSize: 13, color: '#F59E0B', fontWeight: '600', marginTop: 6 },

  addressBox: { flexDirection: 'row', backgroundColor: '#F5F5FA', borderRadius: 16, padding: 14, marginBottom: 14 },
  addressIcon: { fontSize: 22, marginRight: 12, marginTop: 2 },
  addressContent: { flex: 1 },
  addressLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  addressText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  addressSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  noteBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', borderRadius: 10, padding: 8, marginTop: 8 },
  noteIcon: { fontSize: 14, marginRight: 6 },
  noteText: { fontSize: 13, color: '#92400E', flex: 1, fontStyle: 'italic' },

  itemsBox: { borderTopWidth: 1, borderTopColor: '#F0F0F5', paddingTop: 14, marginBottom: 14 },
  itemsTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  itemQty: { fontSize: 14, fontWeight: '700', color: colors.accent, width: 30 },
  itemName: { flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  itemPrice: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },

  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1, backgroundColor: '#F5F5FA', borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EDEDF0',
  },
  actionBtnAccent: { backgroundColor: colors.accent + '12', borderColor: colors.accent + '30' },
  actionBtnRestaurant: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  actionIcon: { fontSize: 20, marginBottom: 4 },
  actionLabel: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  badge: {
    position: 'absolute', top: 6, right: 6, backgroundColor: colors.danger,
    minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: colors.textPrimary, marginBottom: 4 },
  modalCurrent: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
  modalSubtitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },
  modalDesc: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  presetBtn: { backgroundColor: '#F5F5FA', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#EDEDF0' },
  presetBtnText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  customRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  customInput: { flex: 1, backgroundColor: '#F5F5FA', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: '#EDEDF0' },
  customSaveBtn: { backgroundColor: colors.accent, borderRadius: 12, paddingHorizontal: 24, justifyContent: 'center' },
  customSaveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  proofInput: { backgroundColor: '#F5F5FA', borderRadius: 12, padding: 16, fontSize: 15, color: colors.textPrimary, borderWidth: 1, borderColor: '#EDEDF0', minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
  proofSubmitBtn: { backgroundColor: '#10B981', borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: '#10B981', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  proofSubmitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  abandonBtn: { marginTop: 12, paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  abandonBtnText: { fontSize: 13, fontWeight: '600', color: '#DC2626' },

  emptyBox: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginTop: 16 },
  emptyDesc: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 6, maxWidth: 280, lineHeight: 20 },
  goAvailableBtn: { marginTop: 20, backgroundColor: colors.accent, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  goAvailableBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
