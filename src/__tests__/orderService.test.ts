/**
 * Unit tests for OrderService — RPC calls, error handling.
 */

import { OrderService } from '../services/OrderService';
import type { CartItem } from '../models/Cart';
import type { DeliveryAddress } from '../models/AppUser';

// ─── Supabase mock builder ──────────────────────────────────────────────────────

function createMockSupabase(overrides: {
  rpcResult?: { data: any; error: any };
  selectResult?: { data: any; error: any };
} = {}) {
  const rpcResult = overrides.rpcResult ?? { data: 'order-123', error: null };
  const selectResult = overrides.selectResult ?? { data: [], error: null };

  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    returns: jest.fn().mockResolvedValue(selectResult),
    then: (resolve: any) => resolve(selectResult),
  };

  const client = {
    rpc: jest.fn().mockResolvedValue(rpcResult),
    from: jest.fn().mockReturnValue(queryBuilder),
  };

  return { client: client as any, queryBuilder };
}

// ─── Test data ──────────────────────────────────────────────────────────────────

const CART_ITEMS: CartItem[] = [
  {
    id: 'ci-1',
    menuItem: {
      id: 'item-1',
      name: 'Smash Burger',
      description: '',
      price: 14.99,
      imageUrl: 'https://img.test/burger.jpg',
      category: 'burgers',
      tags: [],
      calories: 500,
      prepTimeMinutes: 10,
      rating: 4.5,
      reviewCount: 100,
      isAvailable: true,
      isLimitedTime: false,
      limitedTimeEnd: null,
      modifierGroups: [],
      nutritionInfo: { calories: 500, protein: 25, carbs: 40, fat: 20, fiber: 5, sugar: 8 },
      ingredients: [],
      allergens: [],
    },
    quantity: 2,
    selectedModifiers: {},
    specialInstructions: 'No onions',
  },
];

const ADDRESS: DeliveryAddress = {
  street: '123 Main St',
  city: 'Anytown',
  state: 'CA',
  zip: '90210',
  notes: 'Ring bell',
};

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('OrderService', () => {
  describe('createOrder', () => {
    it('returns order ID on success', async () => {
      const { client } = createMockSupabase({ rpcResult: { data: 'order-abc', error: null } });
      const svc = new OrderService(client);

      const result = await svc.createOrder({
        userId: 'user-1',
        customerName: 'John',
        items: CART_ITEMS,
        address: ADDRESS,
        notes: 'Leave at door',
        promoCode: 'SAVE10',
        tip: 2.5,
        paymentMethod: 'card',
        deliveryMethod: 'delivery',
      });

      expect(result).toBe('order-abc');
      expect(client.rpc).toHaveBeenCalledWith(
        'create_order',
        expect.objectContaining({
          p_user_id: 'user-1',
          p_customer_name: 'John',
          p_notes: 'Leave at door',
          p_promo_code: 'SAVE10',
          p_tip: 2.5,
          p_payment_method: 'card',
          p_delivery_method: 'delivery',
        }),
      );
    });

    it('sends items as JSON string', async () => {
      const { client } = createMockSupabase();
      const svc = new OrderService(client);

      await svc.createOrder({
        userId: 'u1',
        customerName: 'Jane',
        items: CART_ITEMS,
        address: ADDRESS,
        notes: '',
        tip: 0,
        paymentMethod: 'cash',
      });

      const callArgs = client.rpc.mock.calls[0][1];
      const parsedItems = JSON.parse(callArgs.p_items);
      expect(parsedItems).toHaveLength(1);
      expect(parsedItems[0].item_id).toBe('item-1');
      expect(parsedItems[0].qty).toBe(2);
      expect(parsedItems[0].notes).toBe('No onions');
    });

    it('includes idempotency key', async () => {
      const { client } = createMockSupabase();
      const svc = new OrderService(client);

      await svc.createOrder({
        userId: 'u1',
        customerName: 'Jane',
        items: CART_ITEMS,
        address: ADDRESS,
        notes: '',
        tip: 0,
        paymentMethod: 'cash',
      });

      const callArgs = client.rpc.mock.calls[0][1];
      expect(callArgs.p_idempotency_key).toBeDefined();
      expect(callArgs.p_idempotency_key.length).toBeGreaterThan(10);
    });

    it('returns null and sets errorMessage on RPC error', async () => {
      const { client } = createMockSupabase({
        rpcResult: { data: null, error: { message: 'DB error' } },
      });
      const svc = new OrderService(client);

      const result = await svc.createOrder({
        userId: 'u1',
        customerName: 'Jane',
        items: CART_ITEMS,
        address: ADDRESS,
        notes: '',
        tip: 0,
        paymentMethod: 'cash',
      });

      expect(result).toBeNull();
      expect(svc.errorMessage).toBe('DB error');
    });
  });

  describe('updateStatus', () => {
    it('returns true on success', async () => {
      const { client } = createMockSupabase({ rpcResult: { data: null, error: null } });
      const svc = new OrderService(client);

      const result = await svc.updateStatus('order-1', 'PREPARING', 'admin-1', 'Started cooking');
      expect(result).toBe(true);
      expect(client.rpc).toHaveBeenCalledWith(
        'update_order_status',
        expect.objectContaining({
          p_order_id: 'order-1',
          p_new_status: 'PREPARING',
          p_changed_by: 'admin-1',
          p_note: 'Started cooking',
        }),
      );
    });

    it('returns false on error', async () => {
      const { client } = createMockSupabase({
        rpcResult: { data: null, error: { message: 'Not authorized' } },
      });
      const svc = new OrderService(client);

      const result = await svc.updateStatus('order-1', 'PREPARING', 'user-bad');
      expect(result).toBe(false);
      expect(svc.errorMessage).toBe('Not authorized');
    });
  });

  describe('assignDriver', () => {
    it('returns true on success', async () => {
      const { client } = createMockSupabase({ rpcResult: { data: null, error: null } });
      const svc = new OrderService(client);

      const result = await svc.assignDriver('order-1', 'driver-1', 'admin-1');
      expect(result).toBe(true);
      expect(client.rpc).toHaveBeenCalledWith(
        'assign_driver',
        { p_order_id: 'order-1', p_driver_id: 'driver-1', p_assigned_by: 'admin-1' },
      );
    });

    it('returns false on error', async () => {
      const { client } = createMockSupabase({
        rpcResult: { data: null, error: { message: 'already assigned' } },
      });
      const svc = new OrderService(client);

      const result = await svc.assignDriver('order-1', 'driver-1', 'admin-1');
      expect(result).toBe(false);
    });
  });

  describe('driverAcceptOrder', () => {
    it('returns true on success', async () => {
      const { client } = createMockSupabase({ rpcResult: { data: null, error: null } });
      const svc = new OrderService(client);

      const result = await svc.driverAcceptOrder('order-1', 'driver-1');
      expect(result).toBe(true);
      expect(client.rpc).toHaveBeenCalledWith(
        'driver_accept_order',
        { p_order_id: 'order-1', p_driver_id: 'driver-1' },
      );
    });

    it('returns false on error', async () => {
      const { client } = createMockSupabase({
        rpcResult: { data: null, error: { message: 'invalid state' } },
      });
      const svc = new OrderService(client);

      const result = await svc.driverAcceptOrder('order-1', 'driver-1');
      expect(result).toBe(false);
      expect(svc.errorMessage).toBe('invalid state');
    });
  });

  describe('fetchOrders', () => {
    it('uses batch queries (3 from() calls) instead of per-order loop', async () => {
      const dbOrders = [
        { id: 'o1', user_id: 'u1', status: 'PLACED', customer_name: 'A', created_at: '2025-01-01T00:00:00Z', subtotal: 10, tax: 1, delivery_fee: 3, tip: 0, discount: 0, notes: '', promo_code: null, assigned_driver_id: null, driver_name: null, address_snapshot: {} },
        { id: 'o2', user_id: 'u1', status: 'PLACED', customer_name: 'A', created_at: '2025-01-01T00:00:00Z', subtotal: 20, tax: 2, delivery_fee: 0, tip: 1, discount: 0, notes: '', promo_code: null, assigned_driver_id: null, driver_name: null, address_snapshot: {} },
        { id: 'o3', user_id: 'u1', status: 'PLACED', customer_name: 'A', created_at: '2025-01-01T00:00:00Z', subtotal: 30, tax: 3, delivery_fee: 0, tip: 2, discount: 0, notes: '', promo_code: null, assigned_driver_id: null, driver_name: null, address_snapshot: {} },
      ];
      const dbLines = [
        { id: 'l1', order_id: 'o1', item_id: 'i1', name_snapshot: 'Burger', unit_price: 10, qty: 1, image_url_snapshot: '', notes: '' },
        { id: 'l2', order_id: 'o2', item_id: 'i2', name_snapshot: 'Salad', unit_price: 20, qty: 1, image_url_snapshot: '', notes: '' },
      ];
      const dbEvents = [
        { id: 'e1', order_id: 'o1', status: 'PLACED', created_at: '2025-01-01T00:00:00Z', note: null },
      ];

      // Build a mock that returns different data per table
      const makeQueryBuilder = (resolvedData: any) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        returns: jest.fn().mockResolvedValue({ data: resolvedData, error: null }),
      });

      const ordersQB = makeQueryBuilder(dbOrders);
      const linesQB = makeQueryBuilder(dbLines);
      const eventsQB = makeQueryBuilder(dbEvents);

      const client = {
        rpc: jest.fn(),
        from: jest.fn((table: string) => {
          if (table === 'orders') return ordersQB;
          if (table === 'order_lines') return linesQB;
          if (table === 'order_status_events') return eventsQB;
          return makeQueryBuilder([]);
        }),
      };

      const svc = new OrderService(client as any);
      const orders = await svc.fetchOrders('u1', 'customer');

      // Verify exactly 3 from() calls (orders, order_lines, order_status_events)
      expect(client.from).toHaveBeenCalledTimes(3);
      expect(client.from).toHaveBeenCalledWith('orders');
      expect(client.from).toHaveBeenCalledWith('order_lines');
      expect(client.from).toHaveBeenCalledWith('order_status_events');

      // Verify .in() was used with all order IDs for batch fetching
      expect(linesQB.in).toHaveBeenCalledWith('order_id', ['o1', 'o2', 'o3']);
      expect(eventsQB.in).toHaveBeenCalledWith('order_id', ['o1', 'o2', 'o3']);

      // Verify all 3 orders returned with correct mapping
      expect(orders).toHaveLength(3);
      expect(orders[0].id).toBe('o1');
      expect(orders[0].items).toHaveLength(1);
      expect(orders[0].items[0].menuItem.name).toBe('Burger');
      expect(orders[1].items).toHaveLength(1);
      expect(orders[2].items).toHaveLength(0); // o3 has no lines
    });
  });
});
