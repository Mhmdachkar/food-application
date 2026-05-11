import React, { useEffect } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFavoritesStore } from '../../state/FavoritesStore';
import { useDataStore } from '../../state/DataStore';
import { useCartStore } from '../../state/CartStore';
import { FavoriteButton } from '../../components/FavoriteButton';
import { colors, spacing, radii } from '../../theme/theme';
import type { MenuItem } from '../../models/MenuItem';

const CAT_EMOJI: Record<string, string> = {
  burgers: '\uD83C\uDF54', pizza: '\uD83C\uDF55', sushi: '\uD83C\uDF63',
  salads: '\uD83E\uDD57', pasta: '\uD83C\uDF5D', chicken: '\uD83C\uDF57',
  seafood: '\uD83E\uDD90', desserts: '\uD83C\uDF70', drinks: '\uD83E\uDD64',
  sides: '\uD83C\uDF5F', breakfast: '\uD83E\uDD5E', bowls: '\uD83C\uDF5C',
};

export const FavoritesScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { favoriteIds, isLoaded, load } = useFavoritesStore();
  const { menuItems } = useDataStore();
  const { addItem } = useCartStore();

  useEffect(() => { if (!isLoaded) load(); }, [isLoaded, load]);

  const favoriteItems = menuItems.filter(item => favoriteIds.includes(item.id));

  const renderItem = ({ item }: { item: MenuItem }) => {
    const emoji = CAT_EMOJI[item.category] ?? '\uD83C\uDF7D\uFE0F';
    return (
      <View style={s.card}>
        <Pressable
          style={s.cardInner}
          onPress={() => router.push(`/customer/item/${item.id}` as any)}
        >
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={s.img} />
          ) : (
            <View style={s.imgPlaceholder}>
              <Text style={{ fontSize: 32 }}>{emoji}</Text>
            </View>
          )}
          <View style={s.info}>
            <Text style={s.name} numberOfLines={1}>{item.name}</Text>
            <Text style={s.desc} numberOfLines={2}>{item.description}</Text>
            <View style={s.row}>
              <Text style={s.price}>${item.price.toFixed(2)}</Text>
              <Text style={s.meta}>{'\u2B50'} {item.rating.toFixed(1)} · {item.prepTimeMinutes}min</Text>
            </View>
          </View>
        </Pressable>
        <View style={s.actions}>
          <FavoriteButton itemId={item.id} size={24} />
          <Pressable
            style={s.addBtn}
            onPress={() => addItem(item)}
          >
            <Text style={s.addBtnText}>+ Add</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={s.back}>{'\u2190'}</Text>
        </Pressable>
        <Text style={s.title}>{'\u2764\uFE0F'} My Favorites</Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={favoriteItems}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 56 }}>{'\uD83D\uDC94'}</Text>
            <Text style={s.emptyTitle}>No favorites yet</Text>
            <Text style={s.emptyDesc}>
              Tap the heart icon on any item to save it here for quick access
            </Text>
            <Pressable
              style={s.browseBtn}
              onPress={() => router.push('/customer/home' as any)}
            >
              <Text style={s.browseBtnText}>Browse Menu</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  back: { fontSize: 24, color: colors.textPrimary },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#FFF', borderRadius: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2, overflow: 'hidden',
  },
  cardInner: { flexDirection: 'row', padding: 12 },
  img: { width: 80, height: 80, borderRadius: 12 },
  imgPlaceholder: {
    width: 80, height: 80, borderRadius: 12, backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '600', color: '#111' },
  desc: { fontSize: 13, color: '#777', marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  price: { fontSize: 15, fontWeight: '700', color: '#FF8C1A' },
  meta: { fontSize: 12, color: '#999' },
  actions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingBottom: 10, paddingTop: 0,
  },
  addBtn: {
    backgroundColor: '#FF8C1A', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginTop: 16 },
  emptyDesc: { fontSize: 14, color: '#999', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  browseBtn: {
    marginTop: 24, backgroundColor: '#FF8C1A', paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 24,
  },
  browseBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
