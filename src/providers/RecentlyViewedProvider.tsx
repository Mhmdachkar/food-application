import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MenuItem } from '../models/MenuItem';
import { useDataStore } from '../state/DataStore';
import { logger } from '../utils/logger';

const STORAGE_KEY = '@recently_viewed_ids';
const MAX_ITEMS = 10;

interface RecentlyViewedContextValue {
  recentItems: MenuItem[];
  trackView: (foodId: string) => void;
}

const RecentlyViewedContext = createContext<RecentlyViewedContextValue | null>(null);

export const useRecentlyViewed = (): RecentlyViewedContextValue => {
  const ctx = useContext(RecentlyViewedContext);
  if (!ctx) throw new Error('useRecentlyViewed must be used within RecentlyViewedProvider');
  return ctx;
};

export const RecentlyViewedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ids, setIds] = useState<string[]>([]);
  const { menuItems } = useDataStore();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setIds(parsed);
        } catch {
          logger.log('[RecentlyViewed] Failed to parse stored IDs');
        }
      }
    });
  }, []);

  const trackView = useCallback((foodId: string) => {
    setIds(prev => {
      const filtered = prev.filter(id => id !== foodId);
      const next = [foodId, ...filtered].slice(0, MAX_ITEMS);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const recentItems = useMemo(() => {
    if (menuItems.length === 0 || ids.length === 0) return [];
    return ids
      .map(id => menuItems.find(m => m.id === id))
      .filter((m): m is MenuItem => m != null);
  }, [ids, menuItems]);

  const value = useMemo(() => ({ recentItems, trackView }), [recentItems, trackView]);

  return (
    <RecentlyViewedContext.Provider value={value}>
      {children}
    </RecentlyViewedContext.Provider>
  );
};
