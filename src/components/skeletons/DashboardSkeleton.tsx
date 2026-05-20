import React from 'react';
import { View, ScrollView } from 'react-native';
import { Skeleton } from '../../theme/components/Skeleton';

const MetricCardSkeleton: React.FC = () => (
  <View className="bg-card rounded-md p-4 items-center gap-y-2" style={{ flex: 1, minWidth: 80 }}>
    <Skeleton style={{ width: 40, height: 40, borderRadius: 20 }} />
    <Skeleton style={{ height: 22, width: 50, borderRadius: 6 }} />
    <Skeleton style={{ height: 10, width: 56, borderRadius: 4 }} />
  </View>
);

const ActivityRowSkeleton: React.FC = () => (
  <View className="flex-row items-center px-4 py-3 gap-x-3">
    <Skeleton style={{ width: 10, height: 10, borderRadius: 5 }} />
    <View className="flex-1 gap-y-1">
      <Skeleton style={{ height: 13, width: '60%', borderRadius: 5 }} />
      <Skeleton style={{ height: 11, width: '40%', borderRadius: 4 }} />
    </View>
    <Skeleton style={{ height: 22, width: 80, borderRadius: 11 }} />
  </View>
);

export const DashboardSkeleton: React.FC = () => (
  <ScrollView className="flex-1 bg-background" scrollEnabled={false}>
    {/* Header */}
    <View className="px-4 pt-4 pb-3 gap-y-2">
      <Skeleton style={{ height: 14, width: 120, borderRadius: 6 }} />
      <Skeleton style={{ height: 26, width: 180, borderRadius: 8 }} />
    </View>

    {/* Metric cards row 1 */}
    <View className="flex-row px-4 gap-x-3 mb-3">
      <MetricCardSkeleton />
      <MetricCardSkeleton />
      <MetricCardSkeleton />
    </View>

    {/* Metric cards row 2 */}
    <View className="flex-row px-4 gap-x-3 mb-4">
      <MetricCardSkeleton />
      <MetricCardSkeleton />
    </View>

    {/* Section header */}
    <View className="px-4 mb-2">
      <Skeleton style={{ height: 18, width: 140, borderRadius: 6 }} />
    </View>

    {/* Activity rows */}
    {[0, 1, 2, 3, 4].map(i => (
      <ActivityRowSkeleton key={i} />
    ))}
  </ScrollView>
);
