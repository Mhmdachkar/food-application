import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadows, radii } from '../theme/theme';
import { useCartStore } from '../state/CartStore';

interface TabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

const TAB_CONFIG: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; iconFocused: keyof typeof Ionicons.glyphMap; label: string }
> = {
  home: { icon: 'home-outline', iconFocused: 'home', label: 'Home' },
  categories: { icon: 'compass-outline', iconFocused: 'compass', label: 'Browse' },
  orders: { icon: 'receipt-outline', iconFocused: 'receipt', label: 'Orders' },
  cart: { icon: 'bag-outline', iconFocused: 'bag', label: 'Cart' },
  profile: { icon: 'person-outline', iconFocused: 'person', label: 'Account' },
};

const VISIBLE_TABS = ['home', 'categories', 'orders', 'cart', 'profile'];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const TabItem: React.FC<{
  routeName: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}> = ({ routeName, isFocused, onPress, onLongPress }) => {
  const config = TAB_CONFIG[routeName];
  if (!config) return null;

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const dotAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(dotAnim, {
      toValue: isFocused ? 1 : 0,
      friction: 6,
      tension: 100,
      useNativeDriver: true,
    }).start();
  }, [isFocused]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.85,
      friction: 5,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 150,
      useNativeDriver: true,
    }).start();
  };

  const isCart = routeName === 'cart';
  const count = useCartStore(s => s.itemCount)();

  const iconColor = isFocused ? colors.accent : colors.textSecondary;
  const labelColor = isFocused ? colors.accent : colors.textSecondary;

  return (
    <AnimatedPressable
      style={[styles.tabItem, { transform: [{ scale: scaleAnim }] }]}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="tab"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={config.label}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name={isFocused ? config.iconFocused : config.icon}
          size={isCart ? 24 : 22}
          color={iconColor}
        />
        {isCart && count > 0 && (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        )}
      </View>
      <Text
        style={[
          styles.tabLabel,
          { color: labelColor, fontWeight: isFocused ? '700' : '500' },
        ]}
      >
        {config.label}
      </Text>
      <Animated.View
        style={[
          styles.indicator,
          {
            opacity: dotAnim,
            transform: [
              {
                scaleX: dotAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              },
            ],
          },
        ]}
      />
    </AnimatedPressable>
  );
};

export const CustomerTabBar: React.FC<TabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 8);

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomPadding,
          height: 60 + bottomPadding,
        },
      ]}
    >
      {state.routes.map((route: any, index: number) => {
        if (!VISIBLE_TABS.includes(route.name)) return null;

        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <TabItem
            key={route.key}
            routeName={route.name}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.cardBackground,
    borderTopWidth: 0,
    paddingTop: 8,
    ...shadows.lg,
    ...(Platform.OS === 'android' && { elevation: 16 }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconContainer: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
  indicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginTop: 2,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: colors.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.cardBackground,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
});
