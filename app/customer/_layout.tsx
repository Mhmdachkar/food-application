import React from 'react';
import { Tabs } from 'expo-router';
import { CustomerTabBar } from '../../src/components/TabBar';

export default function CustomerLayout() {
  return (
    <Tabs
      tabBar={props => <CustomerTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {/* ── 5 Visible Tabs ── */}
      <Tabs.Screen name="home" />
      <Tabs.Screen name="categories" />
      <Tabs.Screen name="orders" />
      <Tabs.Screen name="cart" />
      <Tabs.Screen name="profile" />

      {/* ── Hidden Routes (accessible via navigation, not visible in tab bar) ── */}
      <Tabs.Screen name="checkout" options={{ href: null }} />
      <Tabs.Screen name="reorder" options={{ href: null }} />
      <Tabs.Screen name="group" options={{ href: null }} />
      <Tabs.Screen name="schedule" options={{ href: null }} />
      <Tabs.Screen name="loyalty" options={{ href: null }} />
      <Tabs.Screen name="dietary" options={{ href: null }} />
      <Tabs.Screen name="feedback" options={{ href: null }} />
      <Tabs.Screen name="report" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="payments" options={{ href: null }} />
      <Tabs.Screen name="addresses" options={{ href: null }} />
      <Tabs.Screen name="help" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="favorites" options={{ href: null }} />
      <Tabs.Screen name="referral" options={{ href: null }} />
      <Tabs.Screen name="menu-item" options={{ href: null }} />
    </Tabs>
  );
}
