import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppUser } from '../models/AppUser';
import type { UserRole } from '../models/UserRole';
import type { FoodMemory } from '../models/FoodMemory';
import type { DeliveryAddress } from '../models/AppUser';
import { authService } from '../services/AuthService';
import { isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';
import { Config } from '../config/Config';

export interface AuthState {
  user: AppUser | null;
  role: UserRole | null;
  isLoading: boolean;
  error?: string;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: UserRole,
  ) => Promise<void>;
  quickLogin: (role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  updateFoodMemory: (memory: FoodMemory) => Promise<void>;
  updateAddress: (address: DeliveryAddress) => Promise<void>;
  loadAddress: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  role: null,
  isLoading: false,

  initialize: async () => {
    set({ isLoading: true, error: undefined });
    const result = await authService.initialize();
    if (result.error || !result.user) {
      set({ user: null, role: null, isLoading: false, error: result.error });
    } else {
      set({
        user: result.user,
        role: result.user.role,
        isLoading: false,
        error: undefined,
      });
      await get().loadAddress();
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: undefined });
    const result = await authService.signIn(email, password);
    if (result.error || !result.user) {
      set({ user: null, role: null, isLoading: false, error: result.error });
    } else {
      set({
        user: result.user,
        role: result.user.role,
        isLoading: false,
        error: undefined,
      });
      await get().loadAddress();
    }
  },

  signUp: async (email, password, fullName, role) => {
    set({ isLoading: true, error: undefined });
    const result = await authService.signUp(email, password, fullName, role);
    if (result.error || !result.user) {
      set({ user: null, role: null, isLoading: false, error: result.error });
    } else {
      set({
        user: result.user,
        role: result.user.role,
        isLoading: false,
        error: undefined,
      });
    }
  },

  quickLogin: async (role) => {
    if (!__DEV__ && Config.appEnv !== 'development') {
      set({ error: 'Demo login is not available in production' });
      return;
    }

    // Demo credentials matching the seeded auth.users in seed.sql
    const demoCredentials: Record<UserRole, { email: string; password: string }> = {
      customer: { email: 'sarah@demo.com', password: 'Demo1234!' },
      admin:    { email: 'admin@demo.com', password: 'Demo1234!' },
      driver:   { email: 'james@demo.com', password: 'Demo1234!' },
    };

    // Offline fallback users (used when Supabase is not configured)
    const offlineUsers: Record<UserRole, AppUser> = {
      customer: {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Sarah Johnson',
        email: 'sarah@demo.com',
        phone: '+1-555-0101',
        role: 'customer',
        avatarUrl: null,
        address: null,
        foodMemory: { dietaryRestrictions: [], dislikedIngredients: ['cilantro', 'anchovies'], spiceLevel: 'medium', defaultDrink: 'Iced Latte', commonNotes: 'Extra napkins please', preferredCuisines: ['Italian', 'Japanese'] },
        createdAt: new Date().toISOString(),
      },
      admin: {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        name: 'Alex Martinez',
        email: 'admin@demo.com',
        phone: '+1-555-0200',
        role: 'admin',
        avatarUrl: null,
        address: null,
        foodMemory: { dietaryRestrictions: [], dislikedIngredients: [], spiceLevel: 'medium', defaultDrink: null, commonNotes: null, preferredCuisines: [] },
        createdAt: new Date().toISOString(),
      },
      driver: {
        id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        name: 'James Wilson',
        email: 'james@demo.com',
        phone: '+1-555-0301',
        role: 'driver',
        avatarUrl: null,
        address: null,
        foodMemory: { dietaryRestrictions: [], dislikedIngredients: [], spiceLevel: 'medium', defaultDrink: null, commonNotes: null, preferredCuisines: [] },
        createdAt: new Date().toISOString(),
      },
    };

    set({ isLoading: true, error: undefined });

    // Try real Supabase sign-in if configured
    if (isSupabaseConfigured) {
      const creds = demoCredentials[role];
      logger.log('[AUTH] Quick login via Supabase:', creds.email);
      const result = await authService.signIn(creds.email, creds.password);
      if (result.user) {
        set({ user: result.user, role: result.user.role, isLoading: false, error: undefined });
        return;
      }
      logger.warn('[AUTH] Supabase quick login failed, falling back to offline:', result.error);
    }

    // Fallback to offline demo users
    const user = offlineUsers[role];
    set({ user, role, isLoading: false, error: undefined });
  },

  signOut: async () => {
    await authService.signOut();
    set({ user: null, role: null });
  },

  updateFoodMemory: async (memory: FoodMemory) => {
    const currentUser = get().user;
    if (!currentUser) return;
    set({ user: { ...currentUser, foodMemory: memory } });
    try {
      await AsyncStorage.setItem(`food_memory_${currentUser.id}`, JSON.stringify(memory));
      await authService.updateFoodMemory(currentUser.id, {
        dietary_restrictions: memory.dietaryRestrictions,
        disliked_ingredients: memory.dislikedIngredients,
        spice_level: memory.spiceLevel,
        default_drink: memory.defaultDrink,
        common_notes: memory.commonNotes,
        preferred_cuisines: memory.preferredCuisines,
      });
    } catch {
      // silently fail
    }
  },

  updateAddress: async (address: DeliveryAddress) => {
    const currentUser = get().user;
    if (!currentUser) return;
    set({ user: { ...currentUser, address } });
    try {
      await AsyncStorage.setItem(`address_${currentUser.id}`, JSON.stringify(address));
    } catch {
      // silently fail
    }
  },

  loadAddress: async () => {
    const currentUser = get().user;
    if (!currentUser || currentUser.address) return;
    try {
      const raw = await AsyncStorage.getItem(`address_${currentUser.id}`);
      if (raw) {
        const address: DeliveryAddress = JSON.parse(raw);
        set({ user: { ...currentUser, address } });
      }
    } catch {
      // silently fail
    }
  },
}));

