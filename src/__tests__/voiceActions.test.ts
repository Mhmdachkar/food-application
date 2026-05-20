/**
 * Comprehensive test suite for the Voice AI Action system.
 *
 * Covers:
 *  - levenshtein distance computation
 *  - fuzzyMatchItemName (exact, substring, Levenshtein)
 *  - parseAction (clean text extraction, JSON parsing, edge cases)
 *  - executeAction (add, remove, update, clear, view, promo, notes, fuzzy)
 */

import {
  levenshtein,
  fuzzyMatchItemName,
} from '../models/VoiceActions';
import type { VoiceAction } from '../models/VoiceActions';
import type { MenuItem } from '../models/MenuItem';
import { parseAction, executeAction as executeActionReal } from '../state/VoiceCallStore';

// ─── Test helpers ──────────────────────────────────────────────────────────────

/** Minimal mock MenuItem factory */
function mockMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: overrides.id ?? `item-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides.name ?? 'Test Item',
    description: overrides.description ?? '',
    price: overrides.price ?? 9.99,
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

const MENU_ITEMS: MenuItem[] = [
  mockMenuItem({ id: '1', name: 'Smash Burger Deluxe', price: 14.99, category: 'burgers' }),
  mockMenuItem({ id: '2', name: 'Crispy Chicken Sandwich', price: 12.99, category: 'chicken' }),
  mockMenuItem({ id: '3', name: 'Caesar Salad', price: 10.49, category: 'salads' }),
  mockMenuItem({ id: '4', name: 'Margherita Pizza', price: 16.99, category: 'pizza' }),
  mockMenuItem({ id: '5', name: 'Spicy Tuna Roll', price: 13.49, category: 'sushi' }),
  mockMenuItem({ id: '6', name: 'Chocolate Lava Cake', price: 8.99, category: 'desserts' }),
  mockMenuItem({ id: '7', name: 'Mango Smoothie', price: 6.49, category: 'drinks' }),
  mockMenuItem({ id: '8', name: 'Sold Out Special', price: 19.99, isAvailable: false }),
];

const MENU_NAMES = MENU_ITEMS.map(m => m.name);

// ─── parseAction and executeAction are now imported from '../state/VoiceCallStore'
// so tests validate the real production code paths.

// ═══════════════════════════════════════════════════════════════════════════════
// levenshtein
// ═══════════════════════════════════════════════════════════════════════════════

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('hello', 'hello')).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(levenshtein('Hello', 'hello')).toBe(0);
    expect(levenshtein('BURGER', 'burger')).toBe(0);
  });

  it('returns the correct edit distance for single edits', () => {
    expect(levenshtein('cat', 'car')).toBe(1); // substitution
    expect(levenshtein('cat', 'cats')).toBe(1); // insertion
    expect(levenshtein('cats', 'cat')).toBe(1); // deletion
  });

  it('returns the length of the other string when one is empty', () => {
    expect(levenshtein('', 'hello')).toBe(5);
    expect(levenshtein('world', '')).toBe(5);
  });

  it('handles multi-character differences', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('sunday', 'saturday')).toBe(3);
  });

  it('handles completely different strings', () => {
    expect(levenshtein('abc', 'xyz')).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// fuzzyMatchItemName
// ═══════════════════════════════════════════════════════════════════════════════

describe('fuzzyMatchItemName', () => {
  describe('exact matching', () => {
    it('matches exact name (case-insensitive)', () => {
      expect(fuzzyMatchItemName('Smash Burger Deluxe', MENU_NAMES)).toBe('Smash Burger Deluxe');
      expect(fuzzyMatchItemName('smash burger deluxe', MENU_NAMES)).toBe('Smash Burger Deluxe');
      expect(fuzzyMatchItemName('CAESAR SALAD', MENU_NAMES)).toBe('Caesar Salad');
    });
  });

  describe('substring matching', () => {
    it('matches when query is a substring of a menu item', () => {
      expect(fuzzyMatchItemName('Smash Burger', MENU_NAMES)).toBe('Smash Burger Deluxe');
      expect(fuzzyMatchItemName('Chicken Sandwich', MENU_NAMES)).toBe('Crispy Chicken Sandwich');
      expect(fuzzyMatchItemName('Lava Cake', MENU_NAMES)).toBe('Chocolate Lava Cake');
    });

    it('matches when menu item is a substring of query', () => {
      expect(fuzzyMatchItemName('I want the Caesar Salad please', MENU_NAMES)).toBe('Caesar Salad');
    });

    it('returns the first match for ambiguous substrings', () => {
      // "Spicy" matches "Spicy Tuna Roll"
      const result = fuzzyMatchItemName('Spicy', MENU_NAMES);
      expect(result).toBe('Spicy Tuna Roll');
    });
  });

  describe('Levenshtein fuzzy matching', () => {
    it('matches with minor typos', () => {
      expect(fuzzyMatchItemName('Smash Burge Deluxe', MENU_NAMES)).toBe('Smash Burger Deluxe');
      expect(fuzzyMatchItemName('Caeser Salad', MENU_NAMES)).toBe('Caesar Salad');
      expect(fuzzyMatchItemName('Margharita Pizza', MENU_NAMES)).toBe('Margherita Pizza');
    });

    it('matches with missing letters', () => {
      expect(fuzzyMatchItemName('Mango Smoothe', MENU_NAMES)).toBe('Mango Smoothie');
    });
  });

  describe('edge cases', () => {
    it('returns null for empty query', () => {
      expect(fuzzyMatchItemName('', MENU_NAMES)).toBeNull();
      expect(fuzzyMatchItemName('   ', MENU_NAMES)).toBeNull();
    });

    it('returns null for completely unrelated query', () => {
      expect(fuzzyMatchItemName('Lobster Thermidor', MENU_NAMES)).toBeNull();
    });

    it('returns null for empty menu', () => {
      expect(fuzzyMatchItemName('Burger', [])).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// parseAction
// ═══════════════════════════════════════════════════════════════════════════════

describe('parseAction', () => {
  describe('no action block', () => {
    it('returns the original text and null action', () => {
      const result = parseAction('Here are some suggestions for you.');
      expect(result.cleanText).toBe('Here are some suggestions for you.');
      expect(result.action).toBeNull();
    });

    it('handles empty string', () => {
      const result = parseAction('');
      expect(result.cleanText).toBe('');
      expect(result.action).toBeNull();
    });
  });

  describe('add_to_cart action', () => {
    it('parses a well-formed add_to_cart action', () => {
      const text = 'I\'ll add Smash Burger Deluxe ($14.99) to your cart. |||ACTION:{"type":"add_to_cart","itemName":"Smash Burger Deluxe","quantity":1}|||';
      const result = parseAction(text);
      expect(result.cleanText).toBe("I'll add Smash Burger Deluxe ($14.99) to your cart");
      expect(result.action).toEqual({
        type: 'add_to_cart',
        itemName: 'Smash Burger Deluxe',
        quantity: 1,
      });
    });

    it('parses add_to_cart with quantity > 1', () => {
      const text = 'Adding 3 burgers. |||ACTION:{"type":"add_to_cart","itemName":"Smash Burger Deluxe","quantity":3}|||';
      const result = parseAction(text);
      expect(result.action).toEqual({
        type: 'add_to_cart',
        itemName: 'Smash Burger Deluxe',
        quantity: 3,
      });
    });
  });

  describe('remove_from_cart action', () => {
    it('parses remove action correctly', () => {
      const text = 'Removed! |||ACTION:{"type":"remove_from_cart","itemName":"Caesar Salad"}|||';
      const result = parseAction(text);
      expect(result.cleanText).toBe('Removed!');
      expect(result.action).toEqual({ type: 'remove_from_cart', itemName: 'Caesar Salad' });
    });
  });

  describe('update_quantity action', () => {
    it('parses update_quantity correctly', () => {
      const text = 'Updated to 5. |||ACTION:{"type":"update_quantity","itemName":"Mango Smoothie","quantity":5}|||';
      const result = parseAction(text);
      expect(result.action).toEqual({ type: 'update_quantity', itemName: 'Mango Smoothie', quantity: 5 });
    });
  });

  describe('clear_cart action', () => {
    it('parses clear_cart', () => {
      const text = 'Cart cleared. |||ACTION:{"type":"clear_cart"}|||';
      const result = parseAction(text);
      expect(result.action).toEqual({ type: 'clear_cart' });
    });
  });

  describe('view_cart action', () => {
    it('parses view_cart', () => {
      const text = 'Here is your cart. |||ACTION:{"type":"view_cart"}|||';
      const result = parseAction(text);
      expect(result.action).toEqual({ type: 'view_cart' });
    });
  });

  describe('apply_promo action', () => {
    it('parses promo code action', () => {
      const text = 'Applied! |||ACTION:{"type":"apply_promo","code":"SAVE10"}|||';
      const result = parseAction(text);
      expect(result.action).toEqual({ type: 'apply_promo', code: 'SAVE10' });
    });
  });

  describe('set_delivery_notes action', () => {
    it('parses delivery notes', () => {
      const text = 'Got it. |||ACTION:{"type":"set_delivery_notes","notes":"Ring the bell twice"}|||';
      const result = parseAction(text);
      expect(result.action).toEqual({ type: 'set_delivery_notes', notes: 'Ring the bell twice' });
    });
  });

  describe('none action', () => {
    it('parses none action and strips it from text', () => {
      const text = 'Our top picks are the Burger and Salad. |||ACTION:{"type":"none"}|||';
      const result = parseAction(text);
      expect(result.cleanText).toBe('Our top picks are the Burger and Salad');
      expect(result.action).toEqual({ type: 'none' });
    });
  });

  describe('edge cases & robustness', () => {
    it('handles action block with extra whitespace inside', () => {
      const text = 'Done. |||ACTION:  { "type" : "clear_cart" }  |||';
      const result = parseAction(text);
      expect(result.action).toEqual({ type: 'clear_cart' });
    });

    it('handles action block wrapped in markdown code fences', () => {
      const text = 'Done. |||ACTION:```json\n{"type":"clear_cart"}\n```|||';
      const result = parseAction(text);
      expect(result.action).toEqual({ type: 'clear_cart' });
    });

    it('strips multiple action blocks but only parses the first', () => {
      const text = 'Done. |||ACTION:{"type":"clear_cart"}||| Also |||ACTION:{"type":"view_cart"}|||';
      const result = parseAction(text);
      expect(result.action).toEqual({ type: 'clear_cart' });
      expect(result.cleanText).toBe('Done Also');
    });

    it('returns null action for malformed JSON', () => {
      const text = 'Oops. |||ACTION:{broken json}|||';
      const result = parseAction(text);
      expect(result.action).toBeNull();
      expect(result.cleanText).toBe('Oops');
    });

    it('collapses double spaces left by stripping', () => {
      const text = 'Added  the burger  |||ACTION:{"type":"add_to_cart","itemName":"Burger","quantity":1}|||  to your cart.';
      const result = parseAction(text);
      expect(result.cleanText).not.toContain('  ');
    });

    it('handles action block at the very start', () => {
      const text = '|||ACTION:{"type":"none"}||| Here you go.';
      const result = parseAction(text);
      expect(result.cleanText).toBe('Here you go');
      expect(result.action).toEqual({ type: 'none' });
    });

    it('handles action block with newlines in JSON', () => {
      const text = 'Sure thing. |||ACTION:{\n"type":"add_to_cart",\n"itemName":"Caesar Salad",\n"quantity":2\n}|||';
      const result = parseAction(text);
      expect(result.action).toEqual({ type: 'add_to_cart', itemName: 'Caesar Salad', quantity: 2 });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// executeAction (using CartStore mock)
// ═══════════════════════════════════════════════════════════════════════════════

// We need to mock the CartStore for executeAction tests.
// We'll test the logic by importing the real store and resetting it.

import { useCartStore } from '../state/CartStore';

// Wrapper around the production executeAction that provides mock storeGet/storeSet
// for VoiceCallStore state (not needed for cart operations but required by signature).
const mockVoiceState: Record<string, unknown> = {};
async function executeAction(action: VoiceAction, menuItems: MenuItem[]) {
  return await executeActionReal(
    action,
    menuItems,
    () => mockVoiceState as any,
    (partial: any) => Object.assign(mockVoiceState, partial),
  );
}

describe('executeAction', () => {
  beforeEach(() => {
    // Reset cart to empty state before each test
    useCartStore.setState({
      items: [],
      promoCode: '',
      promoDiscount: 0,
      deliveryNotes: '',
      selectedTip: { type: 'fifteen' },
      toastMessage: undefined,
    });
  });

  describe('add_to_cart', () => {
    it('adds an item to cart by exact name', async () => {
      const result = await executeAction(
        { type: 'add_to_cart', itemName: 'Smash Burger Deluxe', quantity: 1 },
        MENU_ITEMS,
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain('Smash Burger Deluxe');
      expect(useCartStore.getState().items).toHaveLength(1);
      expect(useCartStore.getState().items[0].menuItem.name).toBe('Smash Burger Deluxe');
      expect(useCartStore.getState().items[0].quantity).toBe(1);
    });

    it('adds an item by fuzzy/substring name', async () => {
      const result = await executeAction(
        { type: 'add_to_cart', itemName: 'burger', quantity: 2 },
        MENU_ITEMS,
      );
      expect(result.success).toBe(true);
      expect(useCartStore.getState().items[0].menuItem.name).toBe('Smash Burger Deluxe');
      expect(useCartStore.getState().items[0].quantity).toBe(2);
    });

    it('rejects an unavailable item', async () => {
      const result = await executeAction(
        { type: 'add_to_cart', itemName: 'Sold Out Special', quantity: 1 },
        MENU_ITEMS,
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('unavailable');
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('rejects a non-existent item', async () => {
      const result = await executeAction(
        { type: 'add_to_cart', itemName: 'Lobster Thermidor', quantity: 1 },
        MENU_ITEMS,
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('stacks quantity when adding the same item twice', async () => {
      await executeAction({ type: 'add_to_cart', itemName: 'Caesar Salad', quantity: 1 }, MENU_ITEMS);
      await executeAction({ type: 'add_to_cart', itemName: 'Caesar Salad', quantity: 2 }, MENU_ITEMS);
      expect(useCartStore.getState().items).toHaveLength(1);
      expect(useCartStore.getState().items[0].quantity).toBe(3);
    });

    it('defaults quantity to 1 when 0 is passed', async () => {
      await executeAction({ type: 'add_to_cart', itemName: 'Mango Smoothie', quantity: 0 }, MENU_ITEMS);
      expect(useCartStore.getState().items[0].quantity).toBe(1);
    });
  });

  describe('remove_from_cart', () => {
    beforeEach(async () => {
      await executeAction({ type: 'add_to_cart', itemName: 'Caesar Salad', quantity: 2 }, MENU_ITEMS);
      await executeAction({ type: 'add_to_cart', itemName: 'Mango Smoothie', quantity: 1 }, MENU_ITEMS);
    });

    it('removes an item by exact name', async () => {
      const result = await executeAction(
        { type: 'remove_from_cart', itemName: 'Caesar Salad' },
        MENU_ITEMS,
      );
      expect(result.success).toBe(true);
      expect(useCartStore.getState().items).toHaveLength(1);
      expect(useCartStore.getState().items[0].menuItem.name).toBe('Mango Smoothie');
    });

    it('removes an item by fuzzy name', async () => {
      const result = await executeAction(
        { type: 'remove_from_cart', itemName: 'smoothie' },
        MENU_ITEMS,
      );
      expect(result.success).toBe(true);
      expect(useCartStore.getState().items).toHaveLength(1);
    });

    it('fails to remove an item not in cart', async () => {
      const result = await executeAction(
        { type: 'remove_from_cart', itemName: 'Margherita Pizza' },
        MENU_ITEMS,
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('not in your cart');
    });
  });

  describe('update_quantity', () => {
    beforeEach(async () => {
      await executeAction({ type: 'add_to_cart', itemName: 'Spicy Tuna Roll', quantity: 2 }, MENU_ITEMS);
    });

    it('updates quantity of an existing item', async () => {
      const result = await executeAction(
        { type: 'update_quantity', itemName: 'Spicy Tuna Roll', quantity: 5 },
        MENU_ITEMS,
      );
      expect(result.success).toBe(true);
      expect(useCartStore.getState().items[0].quantity).toBe(5);
    });

    it('removes item when quantity is set to 0', async () => {
      const result = await executeAction(
        { type: 'update_quantity', itemName: 'Spicy Tuna Roll', quantity: 0 },
        MENU_ITEMS,
      );
      expect(result.success).toBe(true);
      expect(result.message).toContain('Removed');
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('fails for item not in cart', async () => {
      const result = await executeAction(
        { type: 'update_quantity', itemName: 'Margherita Pizza', quantity: 3 },
        MENU_ITEMS,
      );
      expect(result.success).toBe(false);
    });
  });

  describe('clear_cart', () => {
    it('clears a cart with items', async () => {
      await executeAction({ type: 'add_to_cart', itemName: 'Caesar Salad', quantity: 1 }, MENU_ITEMS);
      await executeAction({ type: 'add_to_cart', itemName: 'Mango Smoothie', quantity: 1 }, MENU_ITEMS);
      const result = await executeAction({ type: 'clear_cart' }, MENU_ITEMS);
      expect(result.success).toBe(true);
      expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('succeeds even when cart is already empty', async () => {
      const result = await executeAction({ type: 'clear_cart' }, MENU_ITEMS);
      expect(result.success).toBe(true);
      expect(result.message).toContain('already empty');
    });
  });

  describe('view_cart', () => {
    it('reports empty cart', async () => {
      const result = await executeAction({ type: 'view_cart' }, MENU_ITEMS);
      expect(result.success).toBe(true);
      expect(result.message).toContain('empty');
    });

    it('lists cart items', async () => {
      await executeAction({ type: 'add_to_cart', itemName: 'Caesar Salad', quantity: 2 }, MENU_ITEMS);
      await executeAction({ type: 'add_to_cart', itemName: 'Mango Smoothie', quantity: 1 }, MENU_ITEMS);
      const result = await executeAction({ type: 'view_cart' }, MENU_ITEMS);
      expect(result.success).toBe(true);
      expect(result.message).toContain('2x Caesar Salad');
      expect(result.message).toContain('1x Mango Smoothie');
    });
  });

  describe('apply_promo', () => {
    it('applies a valid promo code', async () => {
      await executeAction({ type: 'add_to_cart', itemName: 'Caesar Salad', quantity: 1 }, MENU_ITEMS);
      const result = await executeAction({ type: 'apply_promo', code: 'SAVE10' }, MENU_ITEMS);
      expect(result.success).toBe(true);
      expect(useCartStore.getState().promoDiscount).toBeGreaterThan(0);
    });
  });

  describe('set_delivery_notes', () => {
    it('sets delivery notes', async () => {
      const result = await executeAction(
        { type: 'set_delivery_notes', notes: 'Ring the bell twice' },
        MENU_ITEMS,
      );
      expect(result.success).toBe(true);
      expect(useCartStore.getState().deliveryNotes).toBe('Ring the bell twice');
    });
  });

  describe('none action', () => {
    it('is a no-op and succeeds', async () => {
      const result = await executeAction({ type: 'none' }, MENU_ITEMS);
      expect(result.success).toBe(true);
      expect(result.message).toBe('');
    });
  });

  describe('action result always includes the action', () => {
    it('includes the original action in every result', async () => {
      const action: VoiceAction = { type: 'add_to_cart', itemName: 'Caesar Salad', quantity: 1 };
      const result = await executeAction(action, MENU_ITEMS);
      expect(result.action).toEqual(action);
    });

    it('includes the action even on failure', async () => {
      const action: VoiceAction = { type: 'add_to_cart', itemName: 'Nonexistent', quantity: 1 };
      const result = await executeAction(action, MENU_ITEMS);
      expect(result.action).toEqual(action);
      expect(result.success).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Integration: parseAction → executeAction pipeline
// ═══════════════════════════════════════════════════════════════════════════════

describe('parseAction → executeAction pipeline', () => {
  beforeEach(() => {
    useCartStore.setState({
      items: [],
      promoCode: '',
      promoDiscount: 0,
      deliveryNotes: '',
      selectedTip: { type: 'fifteen' },
      toastMessage: undefined,
    });
  });

  it('full flow: AI response → parse → execute → cart updated', async () => {
    const aiResponse = "I'll add 2 Smash Burger Deluxe ($29.98) to your cart. |||ACTION:{\"type\":\"add_to_cart\",\"itemName\":\"Smash Burger Deluxe\",\"quantity\":2}|||";
    const { cleanText, action } = parseAction(aiResponse);

    expect(cleanText).toBe("I'll add 2 Smash Burger Deluxe ($29.98) to your cart");
    expect(action).not.toBeNull();

    const result = await executeAction(action!, MENU_ITEMS);
    expect(result.success).toBe(true);
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(2);
  });

  it('handles fuzzy name in AI response', async () => {
    // AI might say "burger" instead of exact name
    const aiResponse = 'Adding a burger for you! |||ACTION:{"type":"add_to_cart","itemName":"burger","quantity":1}|||';
    const { action } = parseAction(aiResponse);
    const result = await executeAction(action!, MENU_ITEMS);
    expect(result.success).toBe(true);
    expect(useCartStore.getState().items[0].menuItem.name).toBe('Smash Burger Deluxe');
  });

  it('handles multiple operations in sequence', async () => {
    // Add item
    const add = parseAction('Added! |||ACTION:{"type":"add_to_cart","itemName":"Caesar Salad","quantity":1}|||');
    await executeAction(add.action!, MENU_ITEMS);
    expect(useCartStore.getState().items).toHaveLength(1);

    // Add another
    const add2 = parseAction('Added! |||ACTION:{"type":"add_to_cart","itemName":"Mango Smoothie","quantity":2}|||');
    await executeAction(add2.action!, MENU_ITEMS);
    expect(useCartStore.getState().items).toHaveLength(2);

    // Update quantity
    const update = parseAction('Updated! |||ACTION:{"type":"update_quantity","itemName":"Caesar Salad","quantity":3}|||');
    await executeAction(update.action!, MENU_ITEMS);
    expect(useCartStore.getState().items.find((ci: any) => ci.menuItem.name === 'Caesar Salad')!.quantity).toBe(3);

    // Remove one
    const remove = parseAction('Removed! |||ACTION:{"type":"remove_from_cart","itemName":"Mango Smoothie"}|||');
    await executeAction(remove.action!, MENU_ITEMS);
    expect(useCartStore.getState().items).toHaveLength(1);

    // Clear
    const clear = parseAction('Cleared! |||ACTION:{"type":"clear_cart"}|||');
    await executeAction(clear.action!, MENU_ITEMS);
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('gracefully handles no action block (informational response)', () => {
    const aiResponse = 'Our most popular items are the Smash Burger and Caesar Salad!';
    const { cleanText, action } = parseAction(aiResponse);
    expect(cleanText).toBe(aiResponse);
    expect(action).toBeNull();
    // No cart changes
    expect(useCartStore.getState().items).toHaveLength(0);
  });
});
