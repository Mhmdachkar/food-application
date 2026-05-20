import { create } from 'zustand';
import type { AppNotification, NotificationType } from '../models/Notification';
import { pushNotificationService } from '../services/PushNotificationService';
import type { PushNotificationPayload, NotificationDeepLink } from '../services/PushNotificationService';
import { logger } from '../utils/logger';

export interface NotificationState {
  notifications: AppNotification[];
  pushToken: string | null;
  unreadCount: () => number;
  addNotification: (title: string, body: string, type: NotificationType, orderId?: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  initPush: (userId: string, onTapped: (deepLink: NotificationDeepLink) => void) => Promise<void>;
  cleanupPush: (userId?: string) => void;
}

const SEED_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    title: 'Welcome to SmartFood!',
    body: 'Your account is all set up. Explore our menu and place your first order!',
    type: 'system',
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'n2',
    title: 'New: Truffle Carbonara',
    body: 'A rich and creamy pasta with truffle oil has been added to our Italian collection. Try it today!',
    type: 'promotion',
    isRead: false,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'n3',
    title: 'Order Delivered',
    body: 'Your order #00000001 has been delivered. Enjoy your meal! Leave feedback to earn loyalty points.',
    type: 'orderUpdate',
    isRead: true,
    createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    orderId: '00000001-0000-0000-0000-000000000000',
  },
  {
    id: 'n4',
    title: 'Loyalty Reward Unlocked',
    body: 'You earned 50 points from your last order! You are 150 points away from Silver tier.',
    type: 'promotion',
    isRead: false,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'n5',
    title: 'Weekend Special',
    body: 'Use code SAVE10 for 10% off your next order this weekend. Valid until Sunday!',
    type: 'promotion',
    isRead: false,
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'n6',
    title: 'New Feature: Group Orders',
    body: 'Order together with friends! Create a group, share the link, and everyone picks their items.',
    type: 'system',
    isRead: false,
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'n7',
    title: 'Order Out for Delivery',
    body: 'Your order #00000004 is on its way! James Wilson is delivering. ETA 10 minutes.',
    type: 'orderUpdate',
    isRead: false,
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    orderId: '00000004-0000-0000-0000-000000000000',
  },
];

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: SEED_NOTIFICATIONS,
  pushToken: null,

  unreadCount: () => get().notifications.filter(n => !n.isRead).length,

  addNotification: (title, body, type, orderId) =>
    set(state => ({
      notifications: [
        {
          id: `n-${Date.now()}`,
          title,
          body,
          type,
          isRead: false,
          createdAt: new Date().toISOString(),
          orderId: orderId ?? null,
        },
        ...state.notifications,
      ],
    })),

  markAsRead: (id) =>
    set(state => ({
      notifications: state.notifications.map(n =>
        n.id === id ? { ...n, isRead: true } : n,
      ),
    })),

  markAllAsRead: () =>
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, isRead: true })),
    })),

  clearAll: () => set({ notifications: [] }),

  initPush: async (userId, onTapped) => {
    try {
      const token = await pushNotificationService.registerForPushNotifications();
      if (token) {
        set({ pushToken: token });
        await pushNotificationService.savePushTokenToSupabase(userId);
      }

      pushNotificationService.startListening(
        (payload: PushNotificationPayload) => {
          const type: NotificationType =
            (payload.data?.type as NotificationType) ?? 'system';
          get().addNotification(
            payload.title,
            payload.body,
            type,
            payload.data?.orderId as string | undefined,
          );
        },
        onTapped,
      );
      logger.log('[NotificationStore] Push initialized, token:', token?.substring(0, 20));
    } catch (err: any) {
      logger.warn('[NotificationStore] Push init failed:', err?.message);
    }
  },

  cleanupPush: (userId) => {
    pushNotificationService.stopListening();
    if (userId) {
      pushNotificationService.clearPushToken(userId).catch(() => {});
    }
    set({ pushToken: null });
  },
}));
