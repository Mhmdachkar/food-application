import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, radii } from '../../theme/theme';
import { Card } from '../../theme/components/Card';
import { Button } from '../../theme/components/Button';
import { KitchenQueueView } from './KitchenQueueScreen';
import { useMessageStore } from '../../state/MessageStore';
import { useAuthStore } from '../../state/AuthStore';
import { orderService } from '../../services/OrderService';
import { useQueryClient } from '@tanstack/react-query';
import { ORDERS_QUERY_KEY } from '../../hooks/useOrdersQuery';
import type { Order, OrderStatus } from '../../models/Order';

const STATUS_LABELS: Record<OrderStatus, string> = {
  PLACED: 'Order Placed',
  ACCEPTED: 'Accepted',
  PREPARING: 'Being Prepared',
  READY: 'Ready for Pickup',
  PICKED_UP: 'Picked Up',
  OUT_FOR_DELIVERY: 'On the Way',
  DELIVERED: 'Delivered',
  CANCELED: 'Canceled',
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  PLACED: '#4A90D9',
  ACCEPTED: '#845EF7',
  PREPARING: '#F59E0B',
  READY: '#20C997',
  PICKED_UP: '#20C997',
  OUT_FOR_DELIVERY: colors.accent,
  DELIVERED: colors.success,
  CANCELED: colors.danger,
};

const STATUS_ICONS: Record<OrderStatus, string> = {
  PLACED: '\uD83D\uDCCB',
  ACCEPTED: '\u2705',
  PREPARING: '\uD83D\uDC68\u200D\uD83C\uDF73',
  READY: '\uD83D\uDCE6',
  PICKED_UP: '\uD83D\uDE97',
  OUT_FOR_DELIVERY: '\uD83D\uDE9A',
  DELIVERED: '\uD83C\uDF89',
  CANCELED: '\u274C',
};

const PROGRESS_STEPS: OrderStatus[] = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'];

interface Props {
  order: Order;
  onClose: () => void;
  onReorder?: () => void;
}

/* ── Cancel Order Modal ── */
const CancelModal: React.FC<{
  visible: boolean;
  onCancel: (reason: string) => void;
  onClose: () => void;
}> = ({ visible, onCancel, onClose }) => {
  const [reason, setReason] = useState('');
  const reasons = ['Changed my mind', 'Taking too long', 'Ordered wrong items', 'Found better option'];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={st.modalOverlay} onPress={onClose}>
        <Pressable style={st.modalSheet} onPress={e => e.stopPropagation()}>
          <View style={st.modalHandle} />
          <Text style={st.modalTitle}>Cancel Order</Text>
          <Text style={st.modalDesc}>Please tell us why you want to cancel</Text>
          {reasons.map(r => (
            <Pressable
              key={r}
              style={[st.reasonBtn, reason === r && st.reasonBtnActive]}
              onPress={() => setReason(r)}
            >
              <Text style={[st.reasonText, reason === r && st.reasonTextActive]}>{r}</Text>
            </Pressable>
          ))}
          <TextInput
            style={st.reasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder="Or type your reason..."
            placeholderTextColor={colors.textTertiary}
          />
          <Pressable
            style={[st.cancelConfirmBtn, !reason && { opacity: 0.5 }]}
            onPress={() => { if (reason) onCancel(reason); }}
            disabled={!reason}
          >
            <Text style={st.cancelConfirmText}>Confirm Cancellation</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export const OrderTrackingScreen: React.FC<Props> = ({ order, onClose, onReorder }) => {
  const router = useRouter();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { initThread, getThread, sendStatusUpdate } = useMessageStore();
  const [showCancel, setShowCancel] = useState(false);

  const sortedTimeline = [...order.timeline].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const isActive = order.status !== 'DELIVERED' && order.status !== 'CANCELED';
  const canCancel = ['PLACED', 'ACCEPTED'].includes(order.status);
  const hasDriver = !!order.driverName;
  const currentStepIdx = PROGRESS_STEPS.indexOf(order.status);
  const thread = getThread(order.id);
  const unreadCount = thread && user
    ? thread.messages.filter(m => m.senderId !== user.id && !m.read).length
    : 0;

  const etaStr = order.estimatedDeliveryTime
    ? new Date(order.estimatedDeliveryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const handleCallDriver = () => {
    const phone = order.driverPhone ?? '+1234567890';
    Linking.openURL(`tel:${phone}`);
  };

  const handleMessageDriver = () => {
    if (!user || !order.driverId) return;
    initThread({
      orderId: order.id,
      customerId: user.id,
      customerName: user.name,
      driverId: order.driverId,
      driverName: order.driverName ?? 'Driver',
    });
    router.push({
      pathname: '/customer/chat' as any,
      params: { orderId: order.id, otherName: order.driverName ?? 'Driver' },
    });
  };

  const handleCancelOrder = async (reason: string) => {
    setShowCancel(false);
    if (user) {
      await orderService.updateStatus(order.id, 'CANCELED', user.id, reason);
      queryClient.invalidateQueries({ queryKey: [...ORDERS_QUERY_KEY] });
    }
    sendStatusUpdate(order.id, 'CANCELED', order.status);
    onClose();
  };

  return (
    <ScrollView style={st.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={st.header}>
        <Pressable onPress={onClose} style={st.closeBtn}>
          <Text style={st.closeIcon}>{'\u2190'}</Text>
        </Pressable>
        <View style={st.headerCenter}>
          <Text style={st.title}>Order #{order.id.slice(0, 6)}</Text>
          <Text style={st.headerDate}>
            {new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={[st.statusPill, { backgroundColor: STATUS_COLORS[order.status] }]}>
          <Text style={st.statusPillText}>{STATUS_LABELS[order.status]}</Text>
        </View>
      </View>

      {/* Progress Stepper (for active orders) */}
      {isActive && (
        <View style={st.progressCard}>
          <View style={st.progressHeader}>
            <Text style={st.progressIcon}>{STATUS_ICONS[order.status]}</Text>
            <View style={st.progressInfo}>
              <Text style={st.progressTitle}>{STATUS_LABELS[order.status]}</Text>
              {etaStr && (
                <Text style={st.progressEta}>ETA: {etaStr}</Text>
              )}
            </View>
          </View>
          <View style={st.stepsRow}>
            {PROGRESS_STEPS.slice(0, -1).map((step, idx) => {
              const isDone = idx < currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              return (
                <View key={step} style={st.stepDot}>
                  <View style={[
                    st.dot,
                    isDone && st.dotDone,
                    isCurrent && st.dotCurrent,
                  ]} />
                  {idx < PROGRESS_STEPS.length - 2 && (
                    <View style={[st.stepConnector, isDone && st.connectorDone]} />
                  )}
                </View>
              );
            })}
          </View>
          <View style={st.stepsLabels}>
            <Text style={st.stepLabelFirst}>Placed</Text>
            <Text style={st.stepLabelMid}>Preparing</Text>
            <Text style={st.stepLabelMid}>On Way</Text>
            <Text style={st.stepLabelLast}>Delivered</Text>
          </View>
        </View>
      )}

      {/* Delivered celebration */}
      {order.status === 'DELIVERED' && (
        <View style={st.deliveredCard}>
          <Text style={st.deliveredEmoji}>{'\uD83C\uDF89'}</Text>
          <Text style={st.deliveredTitle}>Order Delivered!</Text>
          <Text style={st.deliveredDesc}>
            {order.actualDeliveryTime
              ? `Delivered at ${new Date(order.actualDeliveryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Enjoy your meal!'
            }
          </Text>
        </View>
      )}

      {/* Canceled notice */}
      {order.status === 'CANCELED' && (
        <View style={st.canceledCard}>
          <Text style={st.canceledEmoji}>{'\u274C'}</Text>
          <Text style={st.canceledTitle}>Order Canceled</Text>
          {order.cancelReason && (
            <Text style={st.canceledReason}>Reason: {order.cancelReason}</Text>
          )}
        </View>
      )}

      {/* Kitchen Queue (for active orders) */}
      {isActive && ['PREPARING', 'ACCEPTED'].includes(order.status) && (
        <View style={{ paddingHorizontal: 20 }}>
          <KitchenQueueView orderId={order.id} />
        </View>
      )}

      {/* Driver Info Card */}
      {hasDriver && (
        <View style={st.driverCard}>
          <View style={st.driverTop}>
            <View style={st.driverAvatar}>
              <Text style={st.driverAvatarText}>{order.driverName!.charAt(0)}</Text>
            </View>
            <View style={st.driverDetails}>
              <Text style={st.driverName}>{order.driverName}</Text>
              <View style={st.driverMeta}>
                <Text style={st.driverRole}>Your Driver</Text>
                {order.driverRating != null && order.driverRating > 0 && (
                  <Text style={st.driverRating}>
                    {'\u2B50'} {order.driverRating.toFixed(1)}
                  </Text>
                )}
              </View>
            </View>
          </View>
          {isActive && (
            <View style={st.driverActions}>
              <Pressable style={st.driverActionBtn} onPress={handleCallDriver}>
                <Text style={st.driverActionIcon}>{'\uD83D\uDCDE'}</Text>
                <Text style={st.driverActionLabel}>Call</Text>
              </Pressable>
              <Pressable style={[st.driverActionBtn, st.driverActionBtnAccent]} onPress={handleMessageDriver}>
                <Text style={st.driverActionIcon}>{'\uD83D\uDCAC'}</Text>
                <Text style={st.driverActionLabel}>Message</Text>
                {unreadCount > 0 && (
                  <View style={st.unreadBadge}>
                    <Text style={st.unreadBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Order Items */}
      <View style={st.sectionCard}>
        <Text style={st.sectionTitle}>Order Summary</Text>
        {order.items.map((ci, idx) => (
          <View key={idx} style={st.itemRow}>
            <View style={st.itemQtyBadge}>
              <Text style={st.itemQtyText}>{ci.quantity}</Text>
            </View>
            <Text style={st.itemName}>{ci.menuItem.name}</Text>
            <Text style={st.itemPrice}>${(ci.menuItem.price * ci.quantity).toFixed(2)}</Text>
          </View>
        ))}
        <View style={st.divider} />
        <View style={st.summaryRow}>
          <Text style={st.summaryLabel}>Subtotal</Text>
          <Text style={st.summaryValue}>${order.subtotal.toFixed(2)}</Text>
        </View>
        <View style={st.summaryRow}>
          <Text style={st.summaryLabel}>Delivery Fee</Text>
          <Text style={st.summaryValue}>${order.deliveryFee.toFixed(2)}</Text>
        </View>
        <View style={st.summaryRow}>
          <Text style={st.summaryLabel}>Tax</Text>
          <Text style={st.summaryValue}>${order.tax.toFixed(2)}</Text>
        </View>
        {order.tip > 0 && (
          <View style={st.summaryRow}>
            <Text style={st.summaryLabel}>Tip</Text>
            <Text style={st.summaryValue}>${order.tip.toFixed(2)}</Text>
          </View>
        )}
        {order.promoDiscount > 0 && (
          <View style={st.summaryRow}>
            <Text style={st.summaryLabel}>Discount</Text>
            <Text style={[st.summaryValue, { color: colors.success }]}>-${order.promoDiscount.toFixed(2)}</Text>
          </View>
        )}
        <View style={st.divider} />
        <View style={st.summaryRow}>
          <Text style={st.totalLabel}>Total</Text>
          <Text style={st.totalValue}>${order.total.toFixed(2)}</Text>
        </View>
      </View>

      {/* Delivery Address */}
      <View style={st.sectionCard}>
        <Text style={st.sectionTitle}>Delivery Address</Text>
        <View style={st.addressRow}>
          <Text style={st.addressIcon}>{'\uD83D\uDCCD'}</Text>
          <View style={st.addressContent}>
            <Text style={st.addressText}>{order.deliveryAddress.street}</Text>
            <Text style={st.addressSub}>
              {order.deliveryAddress.city}, {order.deliveryAddress.state} {order.deliveryAddress.zip}
            </Text>
          </View>
        </View>
        {order.deliveryNotes ? (
          <View style={st.noteBox}>
            <Text style={st.noteIcon}>{'\uD83D\uDCDD'}</Text>
            <Text style={st.noteText}>{order.deliveryNotes}</Text>
          </View>
        ) : null}
      </View>

      {/* Timeline */}
      <View style={st.sectionCard}>
        <Text style={st.sectionTitle}>Timeline</Text>
        {sortedTimeline.map((event, index) => {
          const isLast = index === sortedTimeline.length - 1;
          const date = new Date(event.timestamp);
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <View key={event.id} style={st.timelineEvent}>
              <View style={st.timelineLeft}>
                <View style={[st.timelineDot, { backgroundColor: STATUS_COLORS[event.status] }]} />
                {!isLast && <View style={st.timelineLine} />}
              </View>
              <View style={st.timelineContent}>
                <Text style={st.timelineStatus}>{STATUS_LABELS[event.status]}</Text>
                <Text style={st.timelineTime}>{timeStr}</Text>
                {event.note && <Text style={st.timelineNote}>{event.note}</Text>}
              </View>
            </View>
          );
        })}
      </View>

      {/* Action Buttons */}
      <View style={st.actionsContainer}>
        {order.status === 'DELIVERED' && onReorder && (
          <Pressable style={st.reorderBtn} onPress={onReorder}>
            <Text style={st.reorderBtnText}>{'\uD83D\uDD04'} Reorder</Text>
          </Pressable>
        )}

        {canCancel && (
          <Pressable style={st.cancelBtn} onPress={() => setShowCancel(true)}>
            <Text style={st.cancelBtnText}>Cancel Order</Text>
          </Pressable>
        )}

        <Pressable style={st.closeButton} onPress={onClose}>
          <Text style={st.closeButtonText}>Close</Text>
        </Pressable>
      </View>

      <View style={{ height: 30 }} />

      <CancelModal
        visible={showCancel}
        onCancel={handleCancelOrder}
        onClose={() => setShowCancel(false)}
      />
    </ScrollView>
  );
};

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFBFE' },

  /* Header */
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  closeBtn: { padding: 8, marginRight: 8 },
  closeIcon: { fontSize: 22, fontWeight: '600', color: colors.textPrimary },
  headerCenter: { flex: 1 },
  title: { fontSize: 20, fontWeight: '900', color: colors.textPrimary },
  headerDate: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusPillText: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  /* Progress */
  progressCard: {
    marginHorizontal: 20, marginBottom: 16, backgroundColor: '#FFF', borderRadius: 20, padding: 18,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  progressIcon: { fontSize: 32, marginRight: 12 },
  progressInfo: { flex: 1 },
  progressTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  progressEta: { fontSize: 14, color: colors.accent, fontWeight: '700', marginTop: 2 },
  stepsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  stepDot: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#E5E5EA' },
  dotDone: { backgroundColor: colors.success },
  dotCurrent: { backgroundColor: colors.accent, width: 16, height: 16, borderRadius: 8 },
  stepConnector: { flex: 1, height: 3, backgroundColor: '#E5E5EA', marginHorizontal: 2 },
  connectorDone: { backgroundColor: colors.success },
  stepsLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  stepLabelFirst: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
  stepLabelMid: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
  stepLabelLast: { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },

  /* Delivered */
  deliveredCard: {
    marginHorizontal: 20, marginBottom: 16, backgroundColor: '#ECFDF5', borderRadius: 20, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#A7F3D0',
  },
  deliveredEmoji: { fontSize: 48, marginBottom: 8 },
  deliveredTitle: { fontSize: 22, fontWeight: '900', color: '#065F46' },
  deliveredDesc: { fontSize: 14, color: '#047857', marginTop: 4, fontWeight: '500' },

  /* Canceled */
  canceledCard: {
    marginHorizontal: 20, marginBottom: 16, backgroundColor: '#FEF2F2', borderRadius: 20, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#FECACA',
  },
  canceledEmoji: { fontSize: 48, marginBottom: 8 },
  canceledTitle: { fontSize: 22, fontWeight: '900', color: '#991B1B' },
  canceledReason: { fontSize: 14, color: '#B91C1C', marginTop: 4, fontWeight: '500' },

  /* Driver Card */
  driverCard: {
    marginHorizontal: 20, marginBottom: 16, backgroundColor: '#FFF', borderRadius: 20, padding: 18,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  driverTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  driverAvatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  driverAvatarText: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  driverDetails: { flex: 1 },
  driverName: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  driverMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  driverRole: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  driverRating: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },
  driverActions: { flexDirection: 'row', gap: 10 },
  driverActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F5F5FA', borderRadius: 14, paddingVertical: 12, gap: 6,
    borderWidth: 1, borderColor: '#EDEDF0',
  },
  driverActionBtnAccent: { backgroundColor: colors.accent + '12', borderColor: colors.accent + '30' },
  driverActionIcon: { fontSize: 18 },
  driverActionLabel: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  unreadBadge: {
    backgroundColor: colors.danger, minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', marginLeft: 4,
  },
  unreadBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },

  /* Section Card */
  sectionCard: {
    marginHorizontal: 20, marginBottom: 16, backgroundColor: '#FFF', borderRadius: 20, padding: 18,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    borderWidth: 1, borderColor: '#F0F0F5',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 14 },

  /* Items */
  itemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  itemQtyBadge: {
    width: 26, height: 26, borderRadius: 8, backgroundColor: colors.accent + '15',
    alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  itemQtyText: { fontSize: 13, fontWeight: '800', color: colors.accent },
  itemName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  itemPrice: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  divider: { height: 1, backgroundColor: '#F0F0F5', marginVertical: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  totalLabel: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  totalValue: { fontSize: 16, fontWeight: '800', color: colors.accent },

  /* Address */
  addressRow: { flexDirection: 'row', alignItems: 'flex-start' },
  addressIcon: { fontSize: 20, marginRight: 10, marginTop: 2 },
  addressContent: { flex: 1 },
  addressText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  addressSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  noteBox: { flexDirection: 'row', backgroundColor: '#FFF7ED', borderRadius: 10, padding: 10, marginTop: 10 },
  noteIcon: { fontSize: 14, marginRight: 6 },
  noteText: { fontSize: 13, color: '#92400E', flex: 1, fontStyle: 'italic' },

  /* Timeline */
  timelineEvent: { flexDirection: 'row', marginBottom: spacing.sm },
  timelineLeft: { width: 20, alignItems: 'center', marginRight: 10 },
  timelineDot: { width: 12, height: 12, borderRadius: 6 },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#E5E5EA', marginTop: 4 },
  timelineContent: { flex: 1, paddingBottom: 4 },
  timelineStatus: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  timelineTime: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  timelineNote: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 },

  /* Actions */
  actionsContainer: { paddingHorizontal: 20, gap: 10 },
  reorderBtn: {
    backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center',
    shadowColor: colors.accent, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  reorderBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  cancelBtn: {
    backgroundColor: '#FEF2F2', borderRadius: 16, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#FECACA',
  },
  cancelBtnText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
  closeButton: { backgroundColor: '#F5F5FA', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  closeButtonText: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: colors.textPrimary, marginBottom: 4 },
  modalDesc: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
  reasonBtn: {
    backgroundColor: '#F5F5FA', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#EDEDF0',
  },
  reasonBtnActive: { backgroundColor: colors.danger + '12', borderColor: colors.danger },
  reasonText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  reasonTextActive: { color: colors.danger },
  reasonInput: {
    backgroundColor: '#F5F5FA', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, color: colors.textPrimary, borderWidth: 1, borderColor: '#EDEDF0', marginTop: 4, marginBottom: 16,
  },
  cancelConfirmBtn: { backgroundColor: colors.danger, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  cancelConfirmText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
