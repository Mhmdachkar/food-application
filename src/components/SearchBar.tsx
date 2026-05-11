import React, { useState, useRef, useEffect } from 'react';
import {
  View, TextInput, StyleSheet, Pressable, Text, FlatList, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MenuItem } from '../models/MenuItem';

interface FilterOption {
  label: string;
  key: string;
  values: string[];
}

const PRICE_FILTERS = ['Under $5', '$5–$10', '$10–$15', '$15+'];
const SORT_OPTIONS = ['Popular', 'Price: Low', 'Price: High', 'Fastest'];

interface Props {
  menuItems: MenuItem[];
  onSelectItem?: (item: MenuItem) => void;
  onResultsChange?: (items: MenuItem[]) => void;
}

export const SearchBar: React.FC<Props> = ({ menuItems, onSelectItem, onResultsChange }) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [activePrice, setActivePrice] = useState<string | null>(null);
  const [activeSort, setActiveSort] = useState<string>('Popular');
  const expandAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  const filtered = React.useMemo(() => {
    let items = [...menuItems];

    // Text search
    if (query.trim()) {
      const q = query.toLowerCase();
      items = items.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    // Price filter
    if (activePrice) {
      switch (activePrice) {
        case 'Under $5': items = items.filter(i => i.price < 5); break;
        case '$5–$10': items = items.filter(i => i.price >= 5 && i.price <= 10); break;
        case '$10–$15': items = items.filter(i => i.price >= 10 && i.price <= 15); break;
        case '$15+': items = items.filter(i => i.price > 15); break;
      }
    }

    // Sort
    switch (activeSort) {
      case 'Popular': items.sort((a, b) => b.rating - a.rating); break;
      case 'Price: Low': items.sort((a, b) => a.price - b.price); break;
      case 'Price: High': items.sort((a, b) => b.price - a.price); break;
      case 'Fastest': items.sort((a, b) => a.prepTimeMinutes - b.prepTimeMinutes); break;
    }

    return items;
  }, [menuItems, query, activePrice, activeSort]);

  useEffect(() => {
    if (onResultsChange && (query.trim() || activePrice)) {
      onResultsChange(filtered);
    }
  }, [filtered]);

  const showResults = isFocused && query.trim().length > 0;

  return (
    <View style={s.wrapper}>
      {/* Search Input */}
      <View style={[s.inputRow, isFocused && s.inputRowFocused]}>
        <Ionicons name="search" size={18} color="#999" style={{ marginRight: 8 }} />
        <TextInput
          style={s.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search burgers, sushi, pizza..."
          placeholderTextColor="#BBB"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(''); setActivePrice(null); }} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#CCC" />
          </Pressable>
        )}
      </View>

      {/* Filters Row (shown when focused) */}
      {isFocused && (
        <Animated.View style={[s.filtersRow, { opacity: expandAnim }]}>
          {/* Price Filters */}
          {PRICE_FILTERS.map(p => (
            <Pressable
              key={p}
              style={[s.filterChip, activePrice === p && s.filterChipActive]}
              onPress={() => setActivePrice(activePrice === p ? null : p)}
            >
              <Text style={[s.filterText, activePrice === p && s.filterTextActive]}>{p}</Text>
            </Pressable>
          ))}
          <View style={s.filterDivider} />
          {/* Sort */}
          {SORT_OPTIONS.map(opt => (
            <Pressable
              key={opt}
              style={[s.filterChip, activeSort === opt && s.filterChipActive]}
              onPress={() => setActiveSort(opt)}
            >
              <Text style={[s.filterText, activeSort === opt && s.filterTextActive]}>{opt}</Text>
            </Pressable>
          ))}
        </Animated.View>
      )}

      {/* Quick Results Dropdown */}
      {showResults && (
        <View style={s.dropdown}>
          {filtered.length === 0 ? (
            <View style={s.noResults}>
              <Text style={s.noResultsText}>No items found for "{query}"</Text>
            </View>
          ) : (
            <FlatList
              data={filtered.slice(0, 6)}
              keyExtractor={item => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={s.resultItem}
                  onPress={() => {
                    onSelectItem?.(item);
                    setQuery('');
                    setIsFocused(false);
                  }}
                >
                  <View style={s.resultLeft}>
                    <Text style={s.resultName} numberOfLines={1}>{item.name}</Text>
                    <Text style={s.resultMeta}>{item.category} · {'\u2B50'}{item.rating.toFixed(1)} · {item.prepTimeMinutes}min</Text>
                  </View>
                  <Text style={s.resultPrice}>${item.price.toFixed(2)}</Text>
                </Pressable>
              )}
            />
          )}
          {filtered.length > 6 && (
            <Text style={s.moreText}>+{filtered.length - 6} more results</Text>
          )}
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  wrapper: { position: 'relative', zIndex: 100 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F5', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    marginHorizontal: 16, marginBottom: 8,
  },
  inputRowFocused: { backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#FF8C1A' },
  input: { flex: 1, fontSize: 15, color: '#111', padding: 0 },
  filtersRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 6, marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: '#F0F0F0', borderRadius: 12,
  },
  filterChipActive: { backgroundColor: '#FF8C1A' },
  filterText: { fontSize: 12, color: '#666', fontWeight: '500' },
  filterTextActive: { color: '#FFF' },
  filterDivider: { width: 1, height: 20, backgroundColor: '#E0E0E0', marginHorizontal: 4, alignSelf: 'center' },
  dropdown: {
    position: 'absolute', top: 52, left: 16, right: 16,
    backgroundColor: '#FFF', borderRadius: 14,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8, maxHeight: 320, overflow: 'hidden',
  },
  resultItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0',
  },
  resultLeft: { flex: 1, marginRight: 12 },
  resultName: { fontSize: 15, fontWeight: '600', color: '#111' },
  resultMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  resultPrice: { fontSize: 15, fontWeight: '700', color: '#FF8C1A' },
  noResults: { padding: 24, alignItems: 'center' },
  noResultsText: { fontSize: 14, color: '#999' },
  moreText: { textAlign: 'center', paddingVertical: 10, fontSize: 13, color: '#FF8C1A', fontWeight: '600' },
});
