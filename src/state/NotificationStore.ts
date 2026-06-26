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
    id: 'n-welcome',
    title: 'Welcome to SmartFood! 🎉',
    body: 'Your account is all set. Explore the menu, place your first order, or try a voice order!',
    type: 'system',
    isRead: false,
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
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
