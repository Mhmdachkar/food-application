import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Switch,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { PLACEHOLDER_BLURHASH, IMAGE_TRANSITION_MS } from '../../constants/images';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDataStore } from '../../state/DataStore';
import { colors, spacing, radii } from '../../theme/theme';
import { Card } from '../../theme/components/Card';
import { Input } from '../../theme/components/Input';
import type { MenuItem, MenuCategory } from '../../models/MenuItem';

const CATEGORY_LABELS: Record<MenuCategory, string> = {
  burgers: 'Burgers', pizza: 'Pizza', sushi: 'Sushi', salads: 'Salads',
  pasta: 'Pasta', chicken: 'Chicken', seafood: 'Seafood', desserts: 'Desserts',
  drinks: 'Drinks', sides: 'Sides', breakfast: 'Breakfast', bowls: 'Bowls',
};

const ALL_CATEGORIES: MenuCategory[] = Object.keys(CATEGORY_LABELS) as MenuCategory[];

export const AdminMenuScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { menuItems, toggleMenuItemAvailability } = useDataStore();
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | 'ALL'>('ALL');
  const [searchText, setSearchText] = useState('');

  const filtered = menuItems.filter(item => {
    if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
    if (searchText.trim() && !item.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const renderItem = ({ item }: { item: MenuItem }) => (
    <Card style={styles.itemCard}>
      <View style={styles.itemRow}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.itemImage} placeholder={{ blurhash: PLACEHOLDER_BLURHASH }} transition={IMAGE_TRANSITION_MS} contentFit="cover" />
        ) : (
          <View style={styles.itemImagePlaceholder} />
        )}
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemMeta}>{CATEGORY_LABELS[item.category]} · ${item.price.toFixed(2)}</Text>
          <Text style={styles.itemMeta}>{item.calories} cal · ~{item.prepTimeMinutes} min</Text>
        </View>
        <Switch
          value={item.isAvailable}
          onValueChange={() => toggleMenuItemAvailability(item.id)}
          trackColor={{ true: colors.success, false: colors.border }}
        />
      </View>
    </Card>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Menu Management</Text>

      <View style={styles.searchRow}>
        <Input
          label=""
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search menu items..."
          style={{ flex: 1 }}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterContent}>
        <Pressable
          style={[styles.filterChip, selectedCategory === 'ALL' && styles.filterChipActive]}
          onPress={() => setSelectedCategory('ALL')}
        >
          <Text style={[styles.filterText, selectedCategory === 'ALL' && styles.filterTextActive]}>All</Text>
        </Pressable>
        {ALL_CATEGORIES.map(cat => (
          <Pressable
            key={cat}
            style={[styles.filterChip, selectedCategory === cat && styles.filterChipActive]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text style={[styles.filterText, selectedCategory === cat && styles.filterTextActive]}>{CATEGORY_LABELS[cat]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListEmptyComponent={
          <View style={styles.empty}><Text style={styles.emptyText}>No items found</Text></View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  searchRow: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  filterRow: { maxHeight: 48, marginBottom: spacing.md },
  filterContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.button, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardBackground },
  filterChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  filterTextActive: { color: '#FFFFFF' },
  itemCard: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemImage: { width: 56, height: 56, borderRadius: radii.small, marginRight: spacing.md },
  itemImagePlaceholder: { width: 56, height: 56, borderRadius: radii.small, marginRight: spacing.md, backgroundColor: colors.border },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  itemMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  empty: { padding: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: 14, color: colors.textSecondary },
});
