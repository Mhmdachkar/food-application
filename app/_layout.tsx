import '../global.css';
import { Slot, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import React, { useEffect, useCallback } from 'react';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { RecentlyViewedProvider } from '../src/providers/RecentlyViewedProvider';
import { QueryProvider } from '../src/providers/QueryProvider';
import { useAuthStore } from '../src/state/AuthStore';
import { useNotificationStore } from '../src/state/NotificationStore';
import type { NotificationDeepLink } from '../src/services/PushNotificationService';

function PushNotificationInit() {
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const { initPush, cleanupPush } = useNotificationStore();

  const handleDeepLink = useCallback((deepLink: NotificationDeepLink) => {
    switch (deepLink.screen) {
      case 'orders':
        router.push('/customer/orders' as any);
        break;
      case 'promotions':
        router.push('/customer/notifications' as any);
        break;
      case 'home':
        router.push('/customer/home' as any);
        break;
      default:
        router.push('/customer/notifications' as any);
    }
  }, [router]);

  useEffect(() => {
    if (user?.id) {
      initPush(user.id, handleDeepLink);
    }
    return () => {
      cleanupPush(user?.id);
    };
  }, [user?.id]);

  return null;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <SafeAreaProvider>
          <RecentlyViewedProvider>
            <PushNotificationInit />
            <Slot />
          </RecentlyViewedProvider>
        </SafeAreaProvider>
      </QueryProvider>
    </ErrorBoundary>
  );
}

