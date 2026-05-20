import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

export type NotificationDeepLink =
  | { screen: 'orders'; orderId?: string }
  | { screen: 'promotions' }
  | { screen: 'home' }
  | { screen: 'notifications' };

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: {
    type?: string;
    orderId?: string;
    screen?: string;
    [key: string]: unknown;
  };
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class PushNotificationService {
  private expoPushToken: string | null = null;
  private notificationListener: Notifications.EventSubscription | null = null;
  private responseListener: Notifications.EventSubscription | null = null;
  private onNotificationReceived: ((payload: PushNotificationPayload) => void) | null = null;
  private onNotificationTapped: ((deepLink: NotificationDeepLink) => void) | null = null;

  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'web') {
      logger.log('[Push] Web platform — skipping push permission');
      return false;
    }

    if (!Device.isDevice) {
      logger.warn('[Push] Must use physical device for push notifications');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      logger.warn('[Push] Permission not granted');
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF8C1A',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('orders', {
        name: 'Order Updates',
        description: 'Real-time updates about your orders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#34C759',
        sound: 'default',
      });

      await Notifications.setNotificationChannelAsync('promotions', {
        name: 'Promotions & Deals',
        description: 'Special offers and discounts',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }

    logger.log('[Push] Permission granted');
    return true;
  }

  async registerForPushNotifications(): Promise<string | null> {
    const permitted = await this.requestPermission();
    if (!permitted) return null;

    try {
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId: projectId ?? undefined,
      });
      this.expoPushToken = tokenResponse.data;
      logger.log('[Push] Expo push token:', this.expoPushToken);
      return this.expoPushToken;
    } catch (err: any) {
      logger.error('[Push] Failed to get push token:', err?.message);
      return null;
    }
  }

  async savePushTokenToSupabase(userId: string): Promise<void> {
    if (!this.expoPushToken) {
      logger.warn('[Push] No push token to save');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ push_token: this.expoPushToken })
        .eq('id', userId);

      if (error) {
        logger.warn('[Push] Failed to save push token:', error.message);
      } else {
        logger.log('[Push] Push token saved for user:', userId);
      }
    } catch (err: any) {
      logger.warn('[Push] Error saving push token:', err?.message);
    }
  }

  async clearPushToken(userId: string): Promise<void> {
    try {
      await supabase
        .from('profiles')
        .update({ push_token: null })
        .eq('id', userId);
      this.expoPushToken = null;
      logger.log('[Push] Push token cleared for user:', userId);
    } catch (err: any) {
      logger.warn('[Push] Error clearing push token:', err?.message);
    }
  }

  startListening(
    onReceived: (payload: PushNotificationPayload) => void,
    onTapped: (deepLink: NotificationDeepLink) => void,
  ): void {
    this.stopListening();
    this.onNotificationReceived = onReceived;
    this.onNotificationTapped = onTapped;

    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        const { title, body, data } = notification.request.content;
        logger.log('[Push] Notification received:', title);
        onReceived({
          title: title ?? '',
          body: body ?? '',
          data: (data as PushNotificationPayload['data']) ?? undefined,
        });
      },
    );

    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const { data } = response.notification.request.content;
        const deepLink = this.parseDeepLink(data as Record<string, unknown> | undefined);
        logger.log('[Push] Notification tapped, deep link:', deepLink);
        onTapped(deepLink);
      },
    );

    logger.log('[Push] Notification listeners registered');
  }

  stopListening(): void {
    if (this.notificationListener) {
      this.notificationListener.remove();
      this.notificationListener = null;
    }
    if (this.responseListener) {
      this.responseListener.remove();
      this.responseListener = null;
    }
    this.onNotificationReceived = null;
    this.onNotificationTapped = null;
  }

  private parseDeepLink(data?: Record<string, unknown>): NotificationDeepLink {
    if (!data) return { screen: 'notifications' };

    const type = data.type as string | undefined;
    const screen = data.screen as string | undefined;
    const orderId = data.orderId as string | undefined;

    if (type === 'orderUpdate' || screen === 'orders') {
      return { screen: 'orders', orderId };
    }
    if (type === 'promotion' || screen === 'promotions') {
      return { screen: 'promotions' };
    }
    if (screen === 'home') {
      return { screen: 'home' };
    }
    return { screen: 'notifications' };
  }

  async scheduleLocalNotification(
    title: string,
    body: string,
    data?: Record<string, unknown>,
    delaySeconds?: number,
    channelId?: string,
  ): Promise<string> {
    const trigger: Notifications.NotificationTriggerInput | null = delaySeconds
      ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delaySeconds, repeats: false }
      : null;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: 'default',
        ...(Platform.OS === 'android' && channelId ? { channelId } : {}),
      },
      trigger,
    });
    logger.log('[Push] Scheduled local notification:', id, title);
    return id;
  }

  async getBadgeCount(): Promise<number> {
    return Notifications.getBadgeCountAsync();
  }

  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }

  getToken(): string | null {
    return this.expoPushToken;
  }
}

export const pushNotificationService = new PushNotificationService();
