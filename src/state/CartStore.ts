import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CartItem, Mood } from '../models/Cart';
import type { MenuItem } from '../models/MenuItem';
import { eventBus } from './EventBus';

export type TipOption =
  | { type: 'none' }
  | { type: 'five' }
  | { type: 'ten' }
  | { type: 'fifteen' }
  | { type: 'twenty' }
  | { type: 'custom'; amount: number };

export interface CartState {
  items: CartItem[];
  promoCode: string;
  promoDiscount: number;
  deliveryNotes: string;
  selectedTip: TipOption;
  toastMessage?: string;
  itemCount: () => number;
  subtotal: () => number;
  tax: () => number;
  deliveryFee: () => number;
  tipAmount: () => number;
  total: () => number;
  isEmpty: () => boolean;
  addItem: (
    menuItem: MenuItem,
    quantity?: number,
    modifiers?: Record<string, string[]>,
    instructions?: string,
  ) => void;
  removeItem: (item: CartItem) => void;
  updateQuantity: (item: CartItem, quantity: number) => void;
  applyPromo: (code: string) => void;
  removePromo: () => void;
  setSelectedTip: (tip: TipOption) => void;
  setItemNote: (itemName: string, note: string) => boolean;
  clear: () => void;
  clearToast: () => void;
}

const computeItemTotal = (ci: CartItem): number => {
  const base = ci.menuItem.price;
  
  // Calculate actual modifier costs by looking up price adjustments
  let modifierTotal = 0;
  const modifierGroups = ci.menuItem.modifierGroups;
  
  for (const [groupId, optionIds] of Object.entries(ci.selectedModifiers)) {
    const group = modifierGroups.find(g => g.id === groupId);
    if (group) {
      for (const optionId of optionIds) {
        const option = group.options.find(o => o.id === optionId);
        if (option) {
          modifierTotal += option.priceAdjustment;
        }
      }
    }
  }
  
  return (base + modifierTotal) * ci.quantity;
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
  items: [],
  promoCode: '',
  promoDiscount: 0,
  deliveryNotes: '',
  selectedTip: { type: 'ten' },
  toastMessage: undefined,

  itemCount: () =>
    get().items.reduce((sum, item) => sum + item.quantity, 0),

  subtotal: () =>
    get().items.reduce((sum, item) => sum + computeItemTotal(item), 0),

  tax: () => get().subtotal() * 0.0875,

  deliveryFee: () => (get().subtotal() > 35 ? 0 : 3.99),

  tipAmount: () => {
    const sub = get().subtotal();
    const tip = get().selectedTip;
    switch (tip.type) {
      case 'none':
        return 0;
      case 'five':
        return sub * 0.05;
      case 'ten':
        return sub * 0.1;
      case 'fifteen':
        return sub * 0.15;
      case 'twenty':
        return sub * 0.2;
      case 'custom':
        return tip.amount;
      default:
        return 0;
    }
  },

  total: () =>
    get().subtotal() +
    get().tax() +
    get().deliveryFee() +
    get().tipAmount() -
    get().promoDiscount,

  isEmpty: () => get().items.length === 0,

  addItem: (menuItem, quantity = 1, modifiers = {}, instructions = '') =>
    set(state => {
      const existingIndex = state.items.findIndex(
        i =>
          i.menuItem.id === menuItem.id &&
          JSON.stringify(i.selectedModifiers) ===
            JSON.stringify(modifiers),
      );

      let newItems: CartItem[];
      if (existingIndex >= 0) {
        newItems = [...state.items];
        newItems[existingIndex] = {
          ...newItems[existingIndex],
          quantity: newItems[existingIndex].quantity + quantity,
        };
      } else {
        newItems = [
          ...state.items,
          {
            id: `${Date.now()}-${Math.random()}`,
            menuItem,
            quantity,
            selectedModifiers: modifiers,
            specialInstructions: instructions,
          },
        ];
      }

      eventBus.publish({ type: 'cartUpdated' });
      return {
        ...state,
        items: newItems,
        toastMessage: `${menuItem.name} added to cart`,
      };
    }),

  removeItem: item =>
    set(state => {
      const newItems = state.items.filter(i => i.id !== item.id);
      eventBus.publish({ type: 'cartUpdated' });
      return { ...state, items: newItems };
    }),

  updateQuantity: (item, quantity) =>
    set(state => {
      const idx = state.items.findIndex(i => i.id === item.id);
      if (idx < 0) return state;
      let newItems = [...state.items];
      if (quantity <= 0) {
        newItems.splice(idx, 1);
      } else {
        newItems[idx] = { ...newItems[idx], quantity };
      }
      eventBus.publish({ type: 'cartUpdated' });
      return { ...state, items: newItems };
    }),

  removePromo: () =>
    set({ promoCode: '', promoDiscount: 0 }),

  setSelectedTip: (tip) => set({ selectedTip: tip }),

  applyPromo: code =>
    set(state => {
      // Client-side preview only — the server (create_order RPC)
      // validates the code against the promotions table and
      // calculates the authoritative discount. This preview gives
      // the user immediate UI feedback.
      const upper = code.toUpperCase();
      const subtotal = get().subtotal();
      let previewDiscount = 0;
      let toast: string;
      if (upper === 'SAVE10') {
        previewDiscount = subtotal * 0.1;
        toast = '10% discount applied!';
      } else if (upper === 'FREE5') {
        previewDiscount = 5;
        toast = '$5 discount applied!';
      } else {
        toast = 'Invalid promo code';
      }
      return {
        ...state,
        promoCode: code,
        promoDiscount: previewDiscount,
        toastMessage: toast,
      };
    }),

  setItemNote: (itemName, note) => {
    const items = get().items;
    const lower = itemName.toLowerCase();
    const idx = items.findIndex(ci => ci.menuItem.name.toLowerCase().includes(lower) || lower.includes(ci.menuItem.name.toLowerCase()));
    if (idx < 0) return false;
    const updated = [...items];
    const existing = updated[idx].specialInstructions;
    updated[idx] = {
      ...updated[idx],
      specialInstructions: existing ? `${existing}, ${note}` : note,
    };
    set({ items: updated });
    return true;
  },

  clear: () =>
    set({
      items: [],
      promoCode: '',
      promoDiscount: 0,
      deliveryNotes: '',
      selectedTip: { type: 'ten' },
    }),

  clearToast: () => set({ toastMessage: undefined }),
    }),
    {
      name: 'smartfood-cart',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        items: state.items,
        promoCode: state.promoCode,
        promoDiscount: state.promoDiscount,
        deliveryNotes: state.deliveryNotes,
        selectedTip: state.selectedTip,
      }),
    },
  ),
);

