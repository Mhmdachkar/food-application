import { create } from 'zustand';
import type { MenuItem } from '../models/MenuItem';
import type { Order, OrderStatus } from '../models/Order';
import type { AppUser } from '../models/AppUser';
import { menuService } from '../services/MenuService';
import { orderService } from '../services/OrderService';
import { driverService } from '../services/DriverService';
import { realtimeService } from '../services/RealtimeService';
import type { CartItem } from '../models/Cart';
import type { DeliveryAddress } from '../models/AppUser';
import { eventBus } from './EventBus';
import type { AppNotification } from '../models/Notification';
import { logger } from '../utils/logger';

export interface DataState {
  menuItems: MenuItem[];
  orders: Order[];
  notifications: AppNotification[];
  drivers: AppUser[];
  isLoading: boolean;
  loadFromSupabase: (userId: string, role: 'customer' | 'admin' | 'driver') => Promise<void>;
  refreshOrders: (userId: string, role: 'customer' | 'admin' | 'driver') => Promise<void>;
  refreshMenu: () => Promise<void>;
  placeOrderLocally: (order: Order) => void;
  placeOrderViaSupabase: (options: {
    userId: string;
    customerName: string;
    items: CartItem[];
    address: DeliveryAddress;
    notes: string;
    promoCode?: string | null;
    tip: number;
    paymentMethod: string;
  }) => Promise<string | null>;
  updateOrderStatusLocalOrRemote: (
    orderId: string,
    status: OrderStatus,
    changedBy?: string,
  ) => Promise<void>;
  assignDriverLocalOrRemote: (
    orderId: string,
    driverId: string,
    driverName: string,
    assignedBy?: string,
  ) => Promise<void>;
  driverAcceptOrder: (orderId: string, driverId: string) => Promise<void>;
  updateOrderLocally: (orderId: string, updates: Partial<Order>) => void;
  toggleMenuItemAvailability: (itemId: string) => Promise<void>;
  ordersForCustomer: (customerId: string) => Order[];
  ordersForDriver: (driverId: string) => Order[];
  availableOrders: () => Order[];
  activeOrders: () => Order[];
  subscribeToRealtimeUpdates: () => void;
  unsubscribeFromRealtime: () => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  menuItems: [],
  orders: [],
  notifications: [],
  drivers: [],
  isLoading: false,

  loadFromSupabase: async (userId, role) => {
    logger.log('[DATA] loadFromSupabase called:', { userId, role });
    set({ isLoading: true });

    try {
      await menuService.fetchMenuItems();
      logger.log('[DATA] Menu items loaded:', menuService.state.menuItems.length);
      if (menuService.state.errorMessage) {
        logger.warn('[DATA] Menu error:', menuService.state.errorMessage);
      }
      set({ menuItems: menuService.state.menuItems });
    } catch (e: any) {
      logger.error('[DATA] Menu fetch crashed:', e?.message);
    }

    try {
      const fetchedOrders = await orderService.fetchOrders(userId, role);
      logger.log('[DATA] Orders loaded:', fetchedOrders.length);
      set({ orders: fetchedOrders });
    } catch (e: any) {
      logger.error('[DATA] Orders fetch crashed:', e?.message);
    }

    if (role === 'admin') {
      try {
        await driverService.fetchDrivers();
        const state = driverService.state;
        if (state.onlineDrivers.length > 0) {
          set({ drivers: state.onlineDrivers });
        } else {
          const allDrivers = await driverService.fetchAllDriverProfiles();
          set({ drivers: allDrivers });
        }
      } catch (e: any) {
        logger.error('[DATA] Drivers fetch crashed:', e?.message);
      }
    }

    set({ isLoading: false });
  },

  refreshOrders: async (userId, role) => {
    const fetched = await orderService.fetchOrders(userId, role);
    set({ orders: fetched });
  },

  refreshMenu: async () => {
    await menuService.fetchMenuItems();
    if (menuService.state.menuItems.length > 0) {
      set({ menuItems: menuService.state.menuItems });
    }
  },

  placeOrderLocally: order => {
    const newOrder: Order = {
      ...order,
      timeline:
        order.timeline && order.timeline.length > 0
          ? order.timeline
          : [
              {
                id: `${order.id}-placed`,
                status: 'PLACED',
                timestamp: order.createdAt,
                note: null,
              },
            ],
    };
    set(state => ({
      orders: [newOrder, ...state.orders],
      notifications: [
        {
          id: `${Date.now()}`,
          title: 'Order Placed!',
          body: `Your order #${order.id.slice(0, 6)} has been placed successfully.`,
          type: 'orderUpdate',
          isRead: false,
          createdAt: new Date().toISOString(),
          orderId: order.id,
        },
        ...state.notifications,
      ],
    }));
    eventBus.publish({ type: 'orderPlaced', orderId: order.id });
  },

  placeOrderViaSupabase: async options => {
    const orderId = await orderService.createOrder(options);
    if (orderId) {
      set(state => ({
        notifications: [
          {
            id: `${Date.now()}`,
            title: 'Order Placed!',
            body: 'Your order has been placed successfully.',
            type: 'orderUpdate',
            isRead: false,
            createdAt: new Date().toISOString(),
            orderId,
          },
          ...state.notifications,
        ],
      }));
      eventBus.publish({ type: 'orderPlaced', orderId });
      await get().refreshOrders(options.userId, 'customer');
    }
    return orderId;
  },

  updateOrderStatusLocalOrRemote: async (orderId, status, changedBy) => {
    if (changedBy) {
      const success = await orderService.updateStatus(orderId, status, changedBy);
      if (success) {
        set(state => ({
          orders: state.orders.map(o =>
            o.id === orderId
              ? {
                  ...o,
                  status,
                  timeline: [
                    ...o.timeline,
                    {
                      id: `${orderId}-${Date.now()}`,
                      status,
                      timestamp: new Date().toISOString(),
                      note: null,
                    },
                  ],
                }
              : o,
          ),
        }));
        eventBus.publish({ type: 'orderStatusChanged', orderId, status });
      }
    } else {
      set(state => ({
        orders: state.orders.map(o =>
          o.id === orderId
            ? {
                ...o,
                status,
                timeline: [
                  ...o.timeline,
                  {
                    id: `${orderId}-${Date.now()}`,
                    status,
                    timestamp: new Date().toISOString(),
                    note: null,
                  },
                ],
              }
            : o,
        ),
      }));
      eventBus.publish({ type: 'orderStatusChanged', orderId, status });
    }
  },

  assignDriverLocalOrRemote: async (
    orderId,
    driverId,
    driverName,
    assignedBy,
  ) => {
    if (assignedBy) {
      const success = await orderService.assignDriver(orderId, driverId, assignedBy);
      if (success) {
        set(state => ({
          orders: state.orders.map(o =>
            o.id === orderId ? { ...o, driverId, driverName } : o,
          ),
        }));
        eventBus.publish({ type: 'driverAssigned', orderId, driverId });
      }
    } else {
      set(state => ({
        orders: state.orders.map(o =>
          o.id === orderId && !o.driverId
            ? {
                ...o,
                driverId,
                driverName,
                status: 'OUT_FOR_DELIVERY',
                timeline: [
                  ...o.timeline,
                  {
                    id: `${orderId}-${Date.now()}`,
                    status: 'OUT_FOR_DELIVERY',
                    timestamp: new Date().toISOString(),
                    note: `Driver ${driverName} assigned`,
                  },
                ],
              }
            : o,
        ),
      }));
      eventBus.publish({ type: 'driverAssigned', orderId, driverId });
    }
  },

  driverAcceptOrder: async (orderId, driverId) => {
    const success = await orderService.driverAcceptOrder(orderId, driverId);
    if (success) {
      set(state => ({
        orders: state.orders.map(o =>
          o.id === orderId
            ? {
                ...o,
                driverId,
                status: 'OUT_FOR_DELIVERY',
                timeline: [
                  ...o.timeline,
                  {
                    id: `${orderId}-${Date.now()}`,
                    status: 'OUT_FOR_DELIVERY',
                    timestamp: new Date().toISOString(),
                    note: 'Driver accepted',
                  },
                ],
              }
            : o,
        ),
      }));
      eventBus.publish({ type: 'driverAssigned', orderId, driverId });
    }
  },

  updateOrderLocally: (orderId, updates) => {
    set(state => ({
      orders: state.orders.map(o =>
        o.id === orderId ? { ...o, ...updates } : o,
      ),
    }));
  },

  toggleMenuItemAvailability: async itemId => {
    const items = get().menuItems;
    const idx = items.findIndex(m => m.id === itemId);
    if (idx < 0) return;
    const newValue = !items[idx].isAvailable;
    set({
      menuItems: items.map(m =>
        m.id === itemId ? { ...m, isAvailable: newValue } : m,
      ),
    });
    await menuService.toggleAvailability(itemId, newValue);
  },

  ordersForCustomer: customerId =>
    get().orders.filter(o => o.customerId === customerId),

  ordersForDriver: driverId =>
    get().orders.filter(o => o.driverId === driverId),

  availableOrders: () =>
    get().orders.filter(o => o.status === 'READY' && !o.driverId),

  activeOrders: () => get().orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELED'),

  subscribeToRealtimeUpdates: () => {
    realtimeService.subscribeToOrders(dbOrder => {
      const existing = get().orders;
      const idx = existing.findIndex(o => o.id === dbOrder.id);
      if (idx >= 0) {
        set({
          orders: existing.map(o =>
            o.id === dbOrder.id
              ? {
                  ...o,
                  status: (dbOrder.status as OrderStatus) ?? o.status,
                  driverId: dbOrder.assigned_driver_id ?? o.driverId,
                  driverName: dbOrder.driver_name ?? o.driverName,
                }
              : o,
          ),
        });
      }
    });
  },

  unsubscribeFromRealtime: () => {
    realtimeService.unsubscribeAll();
  },
}));

