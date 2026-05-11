import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'referral_data';

export interface ReferralData {
  referralCode: string;
  referralsCount: number;
  creditsEarned: number;
  referredUsers: string[];
}

export interface ReferralState {
  data: ReferralData;
  isLoaded: boolean;
  load: (userId: string) => Promise<void>;
  addReferral: (friendName: string) => void;
  getShareMessage: () => string;
}

function generateCode(userId: string): string {
  const base = userId.replace(/-/g, '').substring(0, 6).toUpperCase();
  return `FOOD${base}`;
}

export const useReferralStore = create<ReferralState>((set, get) => ({
  data: {
    referralCode: '',
    referralsCount: 0,
    creditsEarned: 0,
    referredUsers: [],
  },
  isLoaded: false,

  load: async (userId: string) => {
    try {
      const raw = await AsyncStorage.getItem(`${STORAGE_KEY}_${userId}`);
      if (raw) {
        set({ data: JSON.parse(raw), isLoaded: true });
      } else {
        const code = generateCode(userId);
        const initial: ReferralData = {
          referralCode: code,
          referralsCount: 0,
          creditsEarned: 0,
          referredUsers: [],
        };
        set({ data: initial, isLoaded: true });
        await AsyncStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(initial));
      }
    } catch {
      set({ data: { ...get().data, referralCode: generateCode(userId) }, isLoaded: true });
    }
  },

  addReferral: (friendName: string) => {
    const current = get().data;
    const updated: ReferralData = {
      ...current,
      referralsCount: current.referralsCount + 1,
      creditsEarned: current.creditsEarned + 5,
      referredUsers: [...current.referredUsers, friendName],
    };
    set({ data: updated });
    AsyncStorage.setItem(`${STORAGE_KEY}_referral`, JSON.stringify(updated)).catch(() => {});
  },

  getShareMessage: () => {
    const code = get().data.referralCode;
    return `Hey! Try SmartFood — the best food delivery app. Use my code ${code} to get $5 off your first order! Download now.`;
  },
}));
