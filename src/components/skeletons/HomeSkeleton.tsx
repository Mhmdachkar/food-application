import React from 'react';
import { View, ScrollView, Dimensions } from 'react-native';
import { Skeleton } from '../../theme/components/Skeleton';
import { FoodCardSkeleton } from './FoodCardSkeleton';

const { width: SCREEN_W } = Dimensions.get('window');

export const HomeSkeleton: React.FC = () => (
  <ScrollView className="flex-1 bg-background" scrollEnabled={false}>
    {/* Header */}
    <View className="px-4 pt-4 pb-3 gap-y-2">
      <Skeleton style={{ height: 16, width: 140, borderRadius: 6 }} />
      <Skeleton style={{ height: 28, width: 200, borderRadius: 8 }} />
    </View>

    {/* Search bar */}
    <View className="mx-4 mb-4">
      <Skeleton style={{ height: 44, borderRadius: 22 }} />
    </View>

    {/* Quick actions row */}
    <View className="flex-row px-4 mb-4 gap-x-3">
      {[0, 1, 2, 3].map(i => (
        <View key={i} className="items-center gap-y-1" style={{ flex: 1 }}>
          <Skeleton style={{ width: 52, height: 52, borderRadius: 26 }} />
          <Skeleton style={{ height: 10, width: 48, borderRadius: 4 }} />
        </View>
      ))}
    </View>

    {/* Section header */}
    <View className="px-4 mb-3">
      <Skeleton style={{ height: 18, width: 120, borderRadius: 6 }} />
    </View>

    {/* Category pills */}
    <View className="flex-row px-4 mb-4 gap-x-2">
      {[80, 70, 90, 65, 75].map((w, i) => (
        <Skeleton key={i} style={{ height: 32, width: w, borderRadius: 16 }} />
      ))}
    </View>

    {/* Food card grid */}
    <View className="flex-row flex-wrap px-4 gap-x-2.5">
      {[0, 1, 2, 3, 4, 5].map(i => (
        <FoodCardSkeleton key={i} />
      ))}
    </View>
  </ScrollView>
);
