import React from 'react';
import { View, Dimensions } from 'react-native';
import { Skeleton } from '../../theme/components/Skeleton';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = (SCREEN_W - 16 * 2 - 10) / 2;

export const FoodCardSkeleton: React.FC = () => (
  <View className="bg-card rounded-md overflow-hidden mb-3" style={{ width: CARD_W }}>
    <Skeleton style={{ width: '100%', height: CARD_W * 0.7 }} />
    <View className="p-3 gap-y-2">
      <Skeleton style={{ height: 14, width: '70%', borderRadius: 6 }} />
      <Skeleton style={{ height: 11, width: '90%', borderRadius: 4 }} />
      <View className="flex-row justify-between mt-1">
        <Skeleton style={{ height: 15, width: 50, borderRadius: 4 }} />
        <Skeleton style={{ height: 11, width: 36, borderRadius: 4 }} />
      </View>
    </View>
  </View>
);
