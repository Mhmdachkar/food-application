import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { PLACEHOLDER_BLURHASH, IMAGE_TRANSITION_MS } from '../../constants/images';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMenuQuery } from '../../hooks/useMenuQuery';
import { CategorySkeleton } from '../../components/skeletons/CategorySkeleton';
import { useCartStore } from '../../state/CartStore';
import { colors, spacing } from '../../theme/theme';
import { SectionHeader } from '../../theme/components/SectionHeader';
import type { MenuItem, MenuCategory } from '../../models/MenuItem';
import { CAT_EMOJI, CATEGORY_LABELS, CATEGORIES } from '../../constants/categories';

/* ── Compact Menu Item Card (2-col optimized) ── */
const MenuItemCard = React.memo<{
  item: MenuItem;
  onAdd: (item: MenuItem) => void;
  onPress: (item: MenuItem) => void;
  cardWidth: number;
}>(({ item, onAdd, onPress, cardWidth }) => {
  const imgHeight = cardWidth * 0.65;

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
    >
      <View style={[styles.menuItem, { width: cardWidth }]}>
        {/* Image */}
        {item.imageUrl ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={[styles.itemImage, { height: imgHeight }]}
            contentFit="cover"
            placeholder={{ blurhash: PLACEHOLDER_BLURHASH }}
            transition={IMAGE_TRANSITION_MS}
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
            <Text style={styles.limitedText}>Limited</Text>
          </View>
        )}

        {/* Rating badge */}
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingBadgeText}>{'\u2B50'} {item.rating.toFixed(1)}</Text>
        </View>

        {/* Content */}
        <View style={styles.itemContent}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.itemDescription} numberOfLines={1}>
            {item.calories} cal {'\u00B7'} ~{item.prepTimeMinutes} min
          </Text>

          {/* Price + Add */}
          <View style={styles.itemFooter}>
            <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
            <Pressable
              style={({ pressed }) => [styles.addBtn, pressed && { transform: [{ scale: 0.92 }] }]}
              onPress={() => onAdd(item)}
            >
              <Ionicons name="add" size={16} color="#FFF" />
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

export const CategoriesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { category: initialCategory } = useLocalSearchParams<{ category?: string }>();
  const { width } = useWindowDimensions();
  const { data: menuItems = [], isLoading: menuLoading } = useMenuQuery();
  const { addItem } = useCartStore();
  const [selectedCategory, setSelectedCategory] =
    useState<MenuCategory>((initialCategory as MenuCategory) ?? 'burgers');
  const [search, setSearch] = useState('');

  // Always 2 columns for compact grid
  const numColumns = 2;
  const horizontalPad = spacing.md;
  const gap = 12;
  const cardWidth = (width - horizontalPad * 2 - gap) / 2;

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

  if (menuLoading && menuItems.length === 0) {
    return <CategorySkeleton />;
  }

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
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 }]}
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  itemCountHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    borderRadius: 14,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    marginLeft: 8,
    padding: 0,
  },
  categoriesContainer: {
    marginBottom: 4,
  },
  categoriesList: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.cardBackground,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  categoryEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  catCount: {
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
    minWidth: 18,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 5,
    paddingHorizontal: 4,
  },
  catCountActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  catCountText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  catCountTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: 4,
  },
  columnWrapper: {
    gap: 12,
  },
  menuItem: {
    marginBottom: 12,
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  itemImage: {
    width: '100%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  itemImagePlaceholder: {
    width: '100%',
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 32,
    opacity: 0.5,
  },
  itemContent: {
    padding: 10,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  itemDescription: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ratingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  addBtn: {
    backgroundColor: colors.accent,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.danger,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 1,
  },
  limitedText: {
    fontSize: 9,
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
