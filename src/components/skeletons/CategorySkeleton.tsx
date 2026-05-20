import React from 'react';
import { View, Dimensions } from 'react-native';
import { Skeleton } from '../../theme/components/Skeleton';
import { FoodCardSkeleton } from './FoodCardSkeleton';

const { width: SCREEN_W } = Dimensions.get('window');

export const CategorySkeleton: React.FC = () => (
  <View className="flex-1 bg-background">
    {/* Search bar */}
    <View className="mx-4 mt-4 mb-4">
      <Skeleton style={{ height: 44, borderRadius: 22 }} />
    </View>

    {/* Category pills */}
    <View className="flex-row flex-wrap px-4 mb-4 gap-x-2 gap-y-2">
      {[80, 65, 90, 70, 75, 60, 85, 72].map((w, i) => (
        <Skeleton key={i} style={{ height: 32, width: w, borderRadius: 16 }} />
      ))}
    </View>

    {/* Count label */}
    <View className="px-4 mb-3">
      <Skeleton style={{ height: 14, width: 100, borderRadius: 6 }} />
    </View>

    {/* Food cards grid */}
    <View className="flex-row flex-wrap px-4 gap-x-2.5">
      {[0, 1, 2, 3, 4, 5].map(i => (
        <FoodCardSkeleton key={i} />
      ))}
    </View>
  </View>
);
