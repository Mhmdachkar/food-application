import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'favorites_item_ids';

export interface FavoritesState {
  favoriteIds: string[];
  isLoaded: boolean;
  load: () => Promise<void>;
  toggle: (itemId: string) => void;
  isFavorite: (itemId: string) => boolean;
  clear: () => void;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favoriteIds: [],
  isLoaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const ids = JSON.parse(raw) as string[];
        set({ favoriteIds: ids, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  toggle: (itemId: string) => {
    const current = get().favoriteIds;
    const next = current.includes(itemId)
      ? current.filter(id => id !== itemId)
      : [...current, itemId];
    set({ favoriteIds: next });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  },

  isFavorite: (itemId: string) => get().favoriteIds.includes(itemId),

  clear: () => {
    set({ favoriteIds: [] });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
}));
