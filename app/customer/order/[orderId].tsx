import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../../src/state/AuthStore';
import { useOrdersQuery } from '../../../src/hooks/useOrdersQuery';
import { OrderTrackingScreen } from '../../../src/screens/Customer/OrderTrackingScreen';
import { EmptyState } from '../../../src/theme/components/EmptyState';
import { colors } from '../../../src/theme/theme';

export default function OrderTrackingRoute() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { user, role } = useAuthStore();
  const { data: orders = [], isLoading } = useOrdersQuery(user?.id, role);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const order = orders.find(o => o.id === orderId);

  if (!order) {
    return (
      <EmptyState
        title="Order not found"
        message="This order may no longer be available."
      />
    );
  }

  return (
    <OrderTrackingScreen
      order={order}
      onClose={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
