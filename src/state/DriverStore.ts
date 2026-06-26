import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { orderService } from '../services/OrderService';
import { driverService } from '../services/DriverService';
import { useNotificationStore } from './NotificationStore';
import type { OrderStatus } from '../models/Order';
import type { QueryClient } from '@tanstack/react-query';
import { ORDERS_QUERY_KEY } from '../hooks/useOrdersQuery';

const STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  PICKED_UP: 'Driver picked up your order',
  OUT_FOR_DELIVERY: 'Your order is on the way!',
  DELIVERED: 'Your order has been delivered',
};

interface DriverStoreState {
  isOnline: boolean;
  currentOrderId: string | null;
  isInitialized: boolean;
  isAccepting: boolean;
  lastError: string | null;
}

interface DriverStoreActions {
  initialize: (driverId: string) => Promise<void>;
  setOnline: (driverId: string, value: boolean) => Promise<void>;
  acceptOrder: (orderId: string, driverId: string, queryClient: QueryClient) => Promise<boolean>;
  advanceStatus: (
    orderId: string,
    newStatus: OrderStatus,
    driverId: string,
    customerId: string,
    queryClient: QueryClient,
    proofNote?: string,
  ) => Promise<boolean>;
  declineOrder: (orderId: string, driverId: string, queryClient: QueryClient) => Promise<void>;
  clearError: () => void;
}

export const useDriverStore = create<DriverStoreState & DriverStoreActions>((set, get) => ({
  isOnline: false,
  currentOrderId: null,
  isInitialized: false,
  isAccepting: false,
  lastError: null,

  initialize: async (driverId) => {
    try {
      const { data } = await supabase
        .from('driver_status')
        .select('is_online, current_order_id')
        .eq('driver_id', driverId)
        .single();

      set({
        isOnline: data?.is_online ?? false,
        currentOrderId: data?.current_order_id ?? null,
        isInitialized: true,
      });
    } catch {
      set({ isOnline: false, currentOrderId: null, isInitialized: true });
    }
  },

  setOnline: async (driverId, value) => {
    set({ isOnline: value });
    await driverService.setOnlineStatus(driverId, value);
  },

  acceptOrder: async (orderId, driverId, queryClient) => {
    if (get().isAccepting) return false;
    set({ isAccepting: true, lastError: null });
    try {
      const success = await orderService.driverAcceptOrder(orderId, driverId);
      if (success) {
        set({ currentOrderId: orderId });
        queryClient.invalidateQueries({ queryKey: [...ORDERS_QUERY_KEY] });
        return true;
      } else {
        set({ lastError: 'Order was already claimed by another driver. Refreshing…' });
        queryClient.invalidateQueries({ queryKey: [...ORDERS_QUERY_KEY] });
        return false;
      }
    } catch (e: any) {
      set({ lastError: e?.message ?? 'Failed to accept order' });
      return false;
    } finally {
      set({ isAccepting: false });
    }
  },

  advanceStatus: async (orderId, newStatus, driverId, customerId, queryClient, proofNote) => {
    try {
      const success = await orderService.updateStatus(orderId, newStatus, driverId, proofNote);
      if (success) {
        queryClient.invalidateQueries({ queryKey: [...ORDERS_QUERY_KEY] });

        if (newStatus === 'DELIVERED' || newStatus === 'CANCELED') {
          set({ currentOrderId: null });
        }

        /* notify the customer in-app */
        const label = STATUS_LABELS[newStatus];
        if (label) {
          useNotificationStore.getState().addNotification(
            label,
            `Order #${orderId.slice(0, 6)}`,
            'orderUpdate',
            orderId,
          );
        }
      }
      return success;
    } catch (e: any) {
      set({ lastError: e?.message ?? 'Failed to update status' });
      return false;
    }
  },

  declineOrder: async (_orderId, _driverId, queryClient) => {
    /* 
     * Declining is a soft action — the driver just doesn't accept,
     * but we mark it locally so the card hides for this session.
     * In a full system you'd push the order back into the queue or 
     * record a declined event; for now we just refresh the list.
     */
    queryClient.invalidateQueries({ queryKey: [...ORDERS_QUERY_KEY] });
  },

  clearError: () => set({ lastError: null }),
}));
