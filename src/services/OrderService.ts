import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type {
  AddressSnapshotJSON,
  CreateOrderItemJSON,
  DBOrder,
  DBOrderLine,
  DBOrderStatusEvent,
} from '../models/SupabaseModels';
import type { CartItem } from '../models/Cart';
import type { DeliveryAddress } from '../models/AppUser';
import type { Order, OrderStatus, OrderTimelineEvent } from '../models/Order';
import { logger } from '../utils/logger';
import { withRetry, isTransientError } from '../utils/retry';

export interface CreateOrderParams {
  p_user_id: string;
  p_customer_name: string;
  p_items: string;           // JSON array — server looks up prices from menu_items
  p_address_snapshot: string; // JSON object
  p_notes: string;
  p_promo_code?: string | null;
  p_tip: number;
  p_payment_method: string;
  p_delivery_method: string;
  p_idempotency_key: string;
  // NOTE: subtotal, tax, delivery_fee, discount, total are calculated
  // server-side in the create_order RPC — never sent from client.
}

export interface UpdateStatusParams {
  p_order_id: string;
  p_new_status: string;
  p_changed_by: string;
  p_note?: string | null;
}

export interface AssignDriverParams {
  p_order_id: string;
  p_driver_id: string;
  p_assigned_by: string;
}

export interface DriverAcceptParams {
  p_order_id: string;
  p_driver_id: string;
}

export class OrderService {
  private client: SupabaseClient;
  isLoading = false;
  errorMessage?: string;

  constructor(client: SupabaseClient = supabase) {
    this.client = client;
  }

  async createOrder(options: {
    userId: string;
    customerName: string;
    items: CartItem[];
    address: DeliveryAddress;
    notes: string;
    promoCode?: string | null;
    tip: number;
    paymentMethod: string;
    deliveryMethod?: string;
  }): Promise<string | null> {
    const {
      userId,
      customerName,
      items,
      address,
      notes,
      promoCode,
      tip,
      paymentMethod,
      deliveryMethod = 'delivery',
    } = options;

    this.isLoading = true;
    this.errorMessage = undefined;

    try {
      const orderItems: CreateOrderItemJSON[] = items.map(ci => {
        const modifierLabels: string[] = [];
        if (ci.selectedModifiers) {
          Object.entries(ci.selectedModifiers).forEach(([groupId, optionIds]) => {
            const group = ci.menuItem.modifierGroups.find(g => g.id === groupId);
            if (group) {
              optionIds.forEach(optId => {
                const opt = group.options.find(o => o.id === optId);
                if (opt) modifierLabels.push(opt.name);
              });
            }
          });
        }
        return {
          item_id: ci.menuItem.id,
          name: ci.menuItem.name,
          image_url: ci.menuItem.imageUrl,
          qty: ci.quantity,
          notes: ci.specialInstructions,
          modifiers: modifierLabels.length > 0 ? modifierLabels : null,
        };
      });

      const itemsString = JSON.stringify(orderItems);

      const addressSnapshot: AddressSnapshotJSON = {
        street: address.street,
        city: address.city,
        state: address.state,
        zip: address.zip,
        notes: address.notes,
      };

      const addrString = JSON.stringify(addressSnapshot);

      const idempotencyKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

      const params: CreateOrderParams = {
        p_user_id: userId,
        p_customer_name: customerName,
        p_items: itemsString,
        p_address_snapshot: addrString,
        p_notes: notes,
        p_promo_code: promoCode ?? null,
        p_tip: tip,
        p_payment_method: paymentMethod,
        p_delivery_method: deliveryMethod,
        p_idempotency_key: idempotencyKey,
      };

      const { data, error } = await withRetry(
        async () => await this.client.rpc<string, CreateOrderParams>(
          'create_order',
          params,
        ),
        { label: 'OrderService.createOrder', shouldRetry: isTransientError },
      );
      if (error || !data) {
        this.errorMessage = error?.message ?? 'Failed to create order';
        this.isLoading = false;
        return null;
      }
      this.isLoading = false;
      return data;
    } catch (e: any) {
      this.errorMessage = e?.message ?? 'Failed to create order';
      this.isLoading = false;
      return null;
    }
  }

  async fetchOrders(userId: string, role: 'customer' | 'admin' | 'driver'): Promise<Order[]> {
    try {
      logger.log('[ORDERS] Fetching orders for:', { userId, role });
      let query = this.client.from('orders').select('*').order('created_at', {
        ascending: false,
      });

      if (role === 'customer') {
        query = query.eq('user_id', userId);
      }
      // For admin/driver we rely on RLS to scope what they see.

      const { data: dbOrders, error } = await withRetry(
        async () => await query.returns<DBOrder[]>(),
        { label: 'OrderService.fetchOrders', shouldRetry: isTransientError },
      );
      if (error || !dbOrders) {
        logger.warn('[ORDERS] Failed to fetch orders:', error?.message);
        this.errorMessage = error?.message ?? 'Failed to fetch orders';
        return [];
      }
      logger.log('[ORDERS] Fetched', dbOrders.length, 'orders');

      const orderIds = dbOrders.map(o => o.id);

      // Batch-fetch all lines and events in 2 queries instead of 2N
      const [linesResult, eventsResult] = await Promise.all([
        withRetry(
          async () => await this.client
            .from('order_lines')
            .select('*')
            .in('order_id', orderIds)
            .returns<DBOrderLine[]>(),
          { label: 'OrderService.fetchOrderLines', shouldRetry: isTransientError },
        ),
        withRetry(
          async () => await this.client
            .from('order_status_events')
            .select('*')
            .in('order_id', orderIds)
            .order('created_at', { ascending: true })
            .returns<DBOrderStatusEvent[]>(),
          { label: 'OrderService.fetchOrderEvents', shouldRetry: isTransientError },
        ),
      ]);

      // Group by order_id
      const linesByOrder = new Map<string, DBOrderLine[]>();
      for (const line of linesResult.data ?? []) {
        const arr = linesByOrder.get(line.order_id) ?? [];
        arr.push(line);
        linesByOrder.set(line.order_id, arr);
      }

      const eventsByOrder = new Map<string, DBOrderStatusEvent[]>();
      for (const evt of (eventsResult.data ?? [])) {
        const arr = eventsByOrder.get(evt.order_id) ?? [];
        arr.push(evt);
        eventsByOrder.set(evt.order_id, arr);
      }

      return dbOrders.map(dbOrder =>
        this.mapDBOrderToOrder(
          dbOrder,
          linesByOrder.get(dbOrder.id) ?? [],
          eventsByOrder.get(dbOrder.id) ?? [],
        ),
      );
    } catch (e: any) {
      this.errorMessage = e?.message ?? 'Failed to fetch orders';
      return [];
    }
  }

  async updateStatus(
    orderId: string,
    newStatus: OrderStatus,
    changedBy: string,
    note?: string | null,
  ): Promise<boolean> {
    try {
      const params: UpdateStatusParams = {
        p_order_id: orderId,
        p_new_status: newStatus,
        p_changed_by: changedBy,
        p_note: note ?? null,
      };
      const { error } = await withRetry(
        async () => await this.client.rpc('update_order_status', params),
        { label: 'OrderService.updateStatus', shouldRetry: isTransientError },
      );
      if (error) {
        this.errorMessage = error.message;
        return false;
      }
      return true;
    } catch (e: any) {
      this.errorMessage = e?.message ?? 'Failed to update order status';
      return false;
    }
  }

  async assignDriver(
    orderId: string,
    driverId: string,
    assignedBy: string,
  ): Promise<boolean> {
    try {
      const params: AssignDriverParams = {
        p_order_id: orderId,
        p_driver_id: driverId,
        p_assigned_by: assignedBy,
      };
      const { error } = await withRetry(
        async () => await this.client.rpc('assign_driver', params),
        { label: 'OrderService.assignDriver', shouldRetry: isTransientError },
      );
      if (error) {
        this.errorMessage = error.message;
        return false;
      }
      return true;
    } catch (e: any) {
      this.errorMessage = e?.message ?? 'Failed to assign driver';
      return false;
    }
  }

  async driverAcceptOrder(
    orderId: string,
    driverId: string,
  ): Promise<boolean> {
    try {
      const params: DriverAcceptParams = {
        p_order_id: orderId,
        p_driver_id: driverId,
      };
      const { error } = await withRetry(
        async () => await this.client.rpc('driver_accept_order', params),
        { label: 'OrderService.driverAcceptOrder', shouldRetry: isTransientError },
      );
      if (error) {
        this.errorMessage = error.message;
        return false;
      }
      return true;
    } catch (e: any) {
      this.errorMessage =
        e?.message ?? 'Failed to mark order as accepted by driver';
      return false;
    }
  }

  private mapDBOrderToOrder(
    db: DBOrder,
    lines: DBOrderLine[],
    events: DBOrderStatusEvent[],
  ): Order {
    const status = (db.status as OrderStatus) ?? 'PLACED';
    const addr = db.address_snapshot ?? {};
    const deliveryAddress: DeliveryAddress = {
      street: addr.street ?? '',
      city: addr.city ?? '',
      state: addr.state ?? '',
      zip: addr.zip ?? '',
      notes: addr.notes ?? '',
    };

    const items: CartItem[] = lines.map(line => ({
      id: line.id,
      menuItem: {
        id: line.item_id ?? line.id,
        name: line.name_snapshot,
        description: '',
        price: line.unit_price ?? 0,
        imageUrl: line.image_url_snapshot ?? '',
        category: 'bowls',
        tags: [],
        calories: 0,
        prepTimeMinutes: 15,
        rating: 4.5,
        reviewCount: 0,
        isAvailable: true,
        isLimitedTime: false,
        limitedTimeEnd: null,
        modifierGroups: [],
        nutritionInfo: {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          sugar: 0,
        },
        ingredients: [],
        allergens: [],
      },
      quantity: line.qty ?? 1,
      selectedModifiers: {},
      specialInstructions: line.notes ?? '',
    }));

    const createdAt =
      db.created_at ?? new Date().toISOString();

    const timeline: OrderTimelineEvent[] = (events ?? []).map(evt => ({
      id: evt.id,
      status: (evt.status as OrderStatus) ?? 'PLACED',
      timestamp: evt.created_at ?? createdAt,
      note: evt.note ?? null,
    }));

    const subtotal = db.subtotal ?? 0;
    const tax = db.tax ?? 0;
    const deliveryFee = db.delivery_fee ?? 0;
    const tip = db.tip ?? 0;
    const promoDiscount = db.discount ?? 0;
    const total = subtotal + tax + deliveryFee + tip - promoDiscount;

    return {
      id: db.id,
      customerId: db.user_id,
      customerName: db.customer_name ?? '',
      items,
      status,
      timeline:
        timeline.length > 0
          ? timeline
          : [
              {
                id: db.id,
                status,
                timestamp: createdAt,
                note: null,
              },
            ],
      subtotal,
      tax,
      deliveryFee,
      tip,
      total,
      deliveryAddress,
      deliveryNotes: db.notes ?? '',
      promoCode: db.promo_code,
      promoDiscount,
      driverId: db.assigned_driver_id,
      driverName: db.driver_name,
      estimatedDeliveryTime: null,
      scheduledFor: null,
      createdAt,
    };
  }
}

export const orderService = new OrderService();

