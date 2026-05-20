import React from 'react';
import { View } from 'react-native';
import { Skeleton } from '../../theme/components/Skeleton';

export const OrderCardSkeleton: React.FC = () => (
  <View className="bg-card rounded-md p-4 mb-3 mx-4">
    <View className="flex-row justify-between items-start mb-3">
      <View className="gap-y-2">
        <Skeleton style={{ height: 14, width: 120, borderRadius: 6 }} />
        <Skeleton style={{ height: 11, width: 80, borderRadius: 4 }} />
      </View>
      <View className="items-end gap-y-2">
        <Skeleton style={{ height: 22, width: 80, borderRadius: 11 }} />
        <Skeleton style={{ height: 14, width: 50, borderRadius: 4 }} />
      </View>
    </View>
    <Skeleton style={{ height: 11, width: '85%', borderRadius: 4, marginBottom: 8 }} />
    <Skeleton style={{ height: 28, width: 100, borderRadius: 6 }} />
  </View>
);

export const OrderCardSkeletonList: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <OrderCardSkeleton key={i} />
    ))}
  </>
);
