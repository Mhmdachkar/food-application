import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Image,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useDataStore } from '../../state/DataStore';
import { useCartStore } from '../../state/CartStore';
import { colors, spacing, radii } from '../../theme/theme';
import { Card } from '../../theme/components/Card';
import { Chip } from '../../theme/components/Chip';
import { SectionHeader } from '../../theme/components/SectionHeader';
import type { MenuItem, MenuCategory } from '../../models/MenuItem';
import { CAT_EMOJI, CATEGORY_LABELS, CATEGORIES } from '../../constants/categories';

/* ── Responsive Menu Item Card ── */
const MenuItemCard: React.FC<{
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
  onPress: (item: MenuItem) => void;
  cardWidth: number;
}> = ({ item, onAdd, onPress, cardWidth }) => {
  const imgHeight = Math.min(cardWidth * 0.55, 180);

  return (
    <Pressable onPress={() => onPress(item)}>
    <Card style={[styles.menuItem, { width: cardWidth }]}>
      {/* Image */}
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={[styles.itemImage, { height: imgHeight }]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.itemImagePlaceholder, { height: imgHeight }]}>
          <Text style={styles.placeholderEmoji}>
            {CAT_EMOJI[item.category] ?? '\uD83C\uDF7D\uFE0F'}
          </Text>
        </View>
      )}

      {/* Limited time badge */}
      {item.isLimitedTime && (
        <View style={styles.limitedBadge}>
          <Text style={styles.limitedText}>Limited Time</Text>
        </View>
      )}

      {/* Content */}
      <View style={styles.itemContent}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemDescription} numberOfLines={2}>
          {item.description}
        </Text>

        {/* Tags */}
        {item.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {item.tags.slice(0, 3).map((tag, idx) => (
              <Chip key={idx} label={tag} />
            ))}
          </View>
        )}

        {/* Nutrition info */}
        <View style={styles.nutritionRow}>
          <Text style={styles.nutritionText}>{item.calories} cal</Text>
          <Text style={styles.nutritionDot}>{'\u00B7'}</Text>
          <Text style={styles.nutritionText}>
            {item.nutritionInfo.protein}g protein
          </Text>
          <Text style={styles.nutritionDot}>{'\u00B7'}</Text>
          <Text style={styles.nutritionText}>~{item.prepTimeMinutes} min</Text>
        </View>

        {/* Price, rating, add button */}
        <View style={styles.itemFooter}>
          <View>
            <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
            <Text style={styles.ratingText}>
              {'\u2B50'} {item.rating.toFixed(1)} ({item.reviewCount})
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}
            onPress={() => onAdd(item)}
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </Pressable>
        </View>
      </View>
    </Card>
    </Pressable>
  );
};

export const CategoriesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { menuItems } = useDataStore();
  const { addItem } = useCartStore();
  const [selectedCategory, setSelectedCategory] =
    useState<MenuCategory>('burgers');
  const [search, setSearch] = useState('');

  // Responsive: 2 columns on screens >= 600px, 1 column on smaller
  const numColumns = width >= 600 ? 2 : 1;
  const horizontalPad = spacing.lg;
  const gap = spacing.md;
  const cardWidth =
    numColumns === 2
      ? (width - horizontalPad * 2 - gap) / 2
      : width - horizontalPad * 2;

  const categoryCount = useMemo(() => {
    const counts: Record<string, number> = {};
    menuItems.filter(i => i.isAvailable).forEach(i => {
      counts[i.category] = (counts[i.category] || 0) + 1;
    });
    return counts;
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    let items = menuItems.filter(
      item => item.category === selectedCategory && item.isAvailable,
    );
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
    }
    return items;
  }, [menuItems, selectedCategory, search]);

  const goToItem = (item: MenuItem) => router.push(`/customer/menu-item/${item.id}` as any);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Browse</Text>
        <Text style={styles.itemCountHeader}>{filteredItems.length} items</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color="#999" />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={`Search in ${CATEGORY_LABELS[selectedCategory]}...`}
          placeholderTextColor="#BBB"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#CCC" />
          </Pressable>
        )}
      </View>

      {/* Category selector */}
      <View style={styles.categoriesContainer}>
        <FlatList
          horizontal
          data={CATEGORIES}
          keyExtractor={cat => cat}
          renderItem={({ item: cat }) => {
            const isSelected = cat === selectedCategory;
            return (
              <Pressable
                onPress={() => { setSelectedCategory(cat); setSearch(''); }}
                style={[
                  styles.categoryChip,
                  isSelected && styles.categoryChipActive,
                ]}
              >
                <Text style={styles.categoryEmoji}>{CAT_EMOJI[cat] ?? ''}</Text>
                <Text
                  style={[
                    styles.categoryChipText,
                    isSelected && styles.categoryChipTextActive,
                  ]}
                >
                  {CATEGORY_LABELS[cat]}
                </Text>
                {(categoryCount[cat] ?? 0) > 0 && (
                  <View style={[styles.catCount, isSelected && styles.catCountActive]}>
                    <Text style={[styles.catCountText, isSelected && styles.catCountTextActive]}>{categoryCount[cat]}</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        />
      </View>

      {/* Section header */}
      <SectionHeader title={CATEGORY_LABELS[selectedCategory]} />

      {/* Menu items grid */}
      <FlatList
        key={`cols-${numColumns}`}
        data={filteredItems}
        keyExtractor={item => item.id}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
        renderItem={({ item }) => (
          <MenuItemCard item={item} onAdd={i => addItem(i, 1)} onPress={goToItem} cardWidth={cardWidth} />
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: spacing.xl }]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>{CAT_EMOJI[selectedCategory] ?? '\uD83C\uDF7D\uFE0F'}</Text>
            <Text style={styles.emptyText}>
              No items available in {CATEGORY_LABELS[selectedCategory]}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  itemCountHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    marginLeft: 8,
    padding: 0,
  },
  categoriesContainer: {
    marginBottom: spacing.sm,
  },
  categoriesList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.button,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  categoryEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  catCount: {
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
    minWidth: 20,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    paddingHorizontal: 5,
  },
  catCountActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  catCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  catCountTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  menuItem: {
    marginBottom: spacing.md,
    padding: 0,
    overflow: 'hidden' as const,
    borderRadius: radii.medium,
  },
  itemImage: {
    width: '100%',
    borderTopLeftRadius: radii.medium,
    borderTopRightRadius: radii.medium,
  },
  itemImagePlaceholder: {
    width: '100%',
    backgroundColor: colors.border,
    borderTopLeftRadius: radii.medium,
    borderTopRightRadius: radii.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 48,
    opacity: 0.5,
  },
  itemContent: {
    padding: spacing.md,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    gap: 4,
  },
  nutritionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 10,
    gap: 4,
  },
  nutritionText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  nutritionDot: {
    fontSize: 11,
    color: colors.textSecondary,
    marginHorizontal: 2,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  ratingText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.button,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  limitedBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.small,
    zIndex: 1,
  },
  limitedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyContainer: {
    padding: spacing.xl * 2,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
