/**
 * Unit tests for CartStore — money math, promo codes, tip logic.
 */

import { useCartStore } from '../state/CartStore';
import type { MenuItem } from '../models/MenuItem';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function mockMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: overrides.id ?? `item-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides.name ?? 'Test Item',
    description: overrides.description ?? '',
    price: overrides.price ?? 10,
    imageUrl: '',
    category: overrides.category ?? 'burgers',
    tags: overrides.tags ?? [],
    calories: overrides.calories ?? 500,
    prepTimeMinutes: overrides.prepTimeMinutes ?? 10,
    rating: overrides.rating ?? 4.5,
    reviewCount: overrides.reviewCount ?? 100,
    isAvailable: overrides.isAvailable ?? true,
    isLimitedTime: overrides.isLimitedTime ?? false,
    limitedTimeEnd: null,
    modifierGroups: overrides.modifierGroups ?? [],
    nutritionInfo: overrides.nutritionInfo ?? {
      calories: 500, protein: 25, carbs: 40, fat: 20, fiber: 5, sugar: 8,
    },
    ingredients: overrides.ingredients ?? [],
    allergens: overrides.allergens ?? [],
  };
}

const BURGER = mockMenuItem({ id: 'burger-1', name: 'Smash Burger', price: 14.99 });
const SALAD = mockMenuItem({ id: 'salad-1', name: 'Caesar Salad', price: 10.49 });
const DRINK = mockMenuItem({ id: 'drink-1', name: 'Mango Smoothie', price: 6.49 });

function resetCart() {
  useCartStore.setState({
    items: [],
    promoCode: '',
    promoDiscount: 0,
    deliveryNotes: '',
    selectedTip: { type: 'ten' },
    toastMessage: undefined,
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('CartStore', () => {
  beforeEach(resetCart);

  describe('addItem', () => {
    it('adds a new item', () => {
      useCartStore.getState().addItem(BURGER, 1, {}, '');
      const { items } = useCartStore.getState();
      expect(items).toHaveLength(1);
      expect(items[0].menuItem.name).toBe('Smash Burger');
      expect(items[0].quantity).toBe(1);
    });

    it('stacks quantity for same item + same modifiers', () => {
      useCartStore.getState().addItem(BURGER, 1, {}, '');
      useCartStore.getState().addItem(BURGER, 2, {}, '');
      const { items } = useCartStore.getState();
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(3);
    });

    it('creates separate entry for same item with different modifiers', () => {
      useCartStore.getState().addItem(BURGER, 1, { g1: ['opt-a'] }, '');
      useCartStore.getState().addItem(BURGER, 1, { g1: ['opt-b'] }, '');
      expect(useCartStore.getState().items).toHaveLength(2);
    });
  });

  describe('removeItem', () => {
    it('removes by cart item id', () => {
      useCartStore.getState().addItem(BURGER, 1, {}, '');
      useCartStore.getState().addItem(SALAD, 1, {}, '');
      const item = useCartStore.getState().items[0];
      useCartStore.getState().removeItem(item);
      expect(useCartStore.getState().items).toHaveLength(1);
      expect(useCartStore.getState().items[0].menuItem.name).toBe('Caesar Salad');
    });
  });

  describe('updateQuantity', () => {
    it('updates to the given quantity', () => {
      useCartStore.getState().addItem(BURGER, 1, {}, '');
      const item = useCartStore.getState().items[0];
      useCartStore.getState().updateQuantity(item, 5);
      expect(useCartStore.getState().items[0].quantity).toBe(5);
    });

    it('removes item when quantity set to 0', () => {
      useCartStore.getState().addItem(BURGER, 1, {}, '');
      const item = useCartStore.getState().items[0];
      useCartStore.getState().updateQuantity(item, 0);
      expect(useCartStore.getState().items).toHaveLength(0);
    });
  });

  describe('money math', () => {
    it('subtotal sums price * quantity for all items', () => {
      useCartStore.getState().addItem(BURGER, 2, {}, ''); // 14.99 * 2 = 29.98
      useCartStore.getState().addItem(SALAD, 1, {}, '');  // 10.49
      const sub = useCartStore.getState().subtotal();
      expect(sub).toBeCloseTo(40.47, 2);
    });

    it('tax is 8.75% of subtotal', () => {
      useCartStore.getState().addItem(BURGER, 1, {}, '');
      const tax = useCartStore.getState().tax();
      expect(tax).toBeCloseTo(14.99 * 0.0875, 2);
    });

    it('delivery fee is $3.99 when subtotal <= $35', () => {
      useCartStore.getState().addItem(SALAD, 1, {}, ''); // 10.49
      expect(useCartStore.getState().deliveryFee()).toBe(3.99);
    });

    it('delivery fee is free when subtotal > $35', () => {
      useCartStore.getState().addItem(BURGER, 3, {}, ''); // 44.97
      expect(useCartStore.getState().deliveryFee()).toBe(0);
    });

    it('total = subtotal + tax + deliveryFee + tip - promoDiscount', () => {
      useCartStore.getState().addItem(BURGER, 1, {}, ''); // 14.99
      useCartStore.setState({ selectedTip: { type: 'none' } });
      const state = useCartStore.getState();
      const expected = state.subtotal() + state.tax() + state.deliveryFee() + state.tipAmount() - state.promoDiscount;
      expect(state.total()).toBeCloseTo(expected, 2);
    });
  });

  describe('tip calculation', () => {
    beforeEach(() => {
      useCartStore.getState().addItem(BURGER, 1, {}, ''); // 14.99
    });

    it('none tip = 0', () => {
      useCartStore.getState().setSelectedTip({ type: 'none' });
      expect(useCartStore.getState().tipAmount()).toBe(0);
    });

    it('five = 5%', () => {
      useCartStore.getState().setSelectedTip({ type: 'five' });
      expect(useCartStore.getState().tipAmount()).toBeCloseTo(14.99 * 0.05, 2);
    });

    it('ten = 10%', () => {
      useCartStore.getState().setSelectedTip({ type: 'ten' });
      expect(useCartStore.getState().tipAmount()).toBeCloseTo(14.99 * 0.1, 2);
    });

    it('fifteen = 15%', () => {
      useCartStore.getState().setSelectedTip({ type: 'fifteen' });
      expect(useCartStore.getState().tipAmount()).toBeCloseTo(14.99 * 0.15, 2);
    });

    it('twenty = 20%', () => {
      useCartStore.getState().setSelectedTip({ type: 'twenty' });
      expect(useCartStore.getState().tipAmount()).toBeCloseTo(14.99 * 0.2, 2);
    });

    it('custom = fixed amount', () => {
      useCartStore.getState().setSelectedTip({ type: 'custom', amount: 3.50 });
      expect(useCartStore.getState().tipAmount()).toBe(3.50);
    });
  });

  describe('applyPromo', () => {
    beforeEach(() => {
      useCartStore.getState().addItem(BURGER, 1, {}, ''); // 14.99
    });

    it('SAVE10 applies 10% discount', () => {
      useCartStore.getState().applyPromo('SAVE10');
      expect(useCartStore.getState().promoDiscount).toBeCloseTo(14.99 * 0.1, 2);
      expect(useCartStore.getState().promoCode).toBe('SAVE10');
    });

    it('FREE5 applies $5 discount', () => {
      useCartStore.getState().applyPromo('FREE5');
      expect(useCartStore.getState().promoDiscount).toBe(5);
    });

    it('is case-insensitive', () => {
      useCartStore.getState().applyPromo('save10');
      expect(useCartStore.getState().promoDiscount).toBeCloseTo(14.99 * 0.1, 2);
    });

    it('invalid code sets 0 discount', () => {
      useCartStore.getState().applyPromo('INVALID');
      expect(useCartStore.getState().promoDiscount).toBe(0);
      expect(useCartStore.getState().toastMessage).toContain('Invalid');
    });
  });

  describe('removePromo', () => {
    it('clears promo code and discount', () => {
      useCartStore.getState().addItem(BURGER, 1, {}, '');
      useCartStore.getState().applyPromo('SAVE10');
      useCartStore.getState().removePromo();
      expect(useCartStore.getState().promoCode).toBe('');
      expect(useCartStore.getState().promoDiscount).toBe(0);
    });
  });

  describe('clear', () => {
    it('resets cart to empty state', () => {
      useCartStore.getState().addItem(BURGER, 2, {}, '');
      useCartStore.getState().applyPromo('SAVE10');
      useCartStore.setState({ deliveryNotes: 'Leave at door' });
      useCartStore.getState().clear();
      const state = useCartStore.getState();
      expect(state.items).toHaveLength(0);
      expect(state.promoCode).toBe('');
      expect(state.promoDiscount).toBe(0);
      expect(state.deliveryNotes).toBe('');
    });
  });

  describe('isEmpty', () => {
    it('true when no items', () => {
      expect(useCartStore.getState().isEmpty()).toBe(true);
    });

    it('false when items exist', () => {
      useCartStore.getState().addItem(DRINK, 1, {}, '');
      expect(useCartStore.getState().isEmpty()).toBe(false);
    });
  });

  describe('itemCount', () => {
    it('sums all item quantities', () => {
      useCartStore.getState().addItem(BURGER, 2, {}, '');
      useCartStore.getState().addItem(SALAD, 3, {}, '');
      expect(useCartStore.getState().itemCount()).toBe(5);
    });
  });

  describe('setItemNote', () => {
    it('adds a note to an existing item by fuzzy name', () => {
      useCartStore.getState().addItem(BURGER, 1, {}, '');
      const result = useCartStore.getState().setItemNote('burger', 'no onions');
      expect(result).toBe(true);
      expect(useCartStore.getState().items[0].specialInstructions).toBe('no onions');
    });

    it('appends to existing note', () => {
      useCartStore.getState().addItem(BURGER, 1, {}, 'extra cheese');
      useCartStore.getState().setItemNote('burger', 'no onions');
      expect(useCartStore.getState().items[0].specialInstructions).toBe('extra cheese, no onions');
    });

    it('returns false if item not found', () => {
      const result = useCartStore.getState().setItemNote('pizza', 'well done');
      expect(result).toBe(false);
    });
  });
});
