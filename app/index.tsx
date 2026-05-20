import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useAuthStore } from '../src/state/AuthStore';
import { SplashScreen } from '../src/components/SplashScreen';

export default function Index() {
  const { user, role, isLoading, initialize } = useAuthStore();
  const router = useRouter();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (splashDone && !isLoading && user && role) {
      if (role === 'customer') {
        router.replace('/customer/home');
      } else if (role === 'admin') {
        router.replace('/admin/dashboard');
      } else if (role === 'driver') {
        router.replace('/driver/available');
      }
    }
  }, [splashDone, isLoading, user, role, router]);

  if (!splashDone) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A1A2E' }}>
        <SplashScreen onFinish={() => setSplashDone(true)} />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A1A2E' }}>
        <SplashScreen onFinish={() => {}} />
      </View>
    );
  }

  if (!user || !role) {
    return <Redirect href="/auth/login" />;
  }

  // If we get here, the role-based redirect effect will run.
  return null;
}

