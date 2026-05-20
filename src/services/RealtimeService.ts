import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { DBOrder, DBOrderStatusEvent } from '../models/SupabaseModels';
import { logger } from '../utils/logger';

export type OrderUpdateHandler = (order: DBOrder) => void;
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY_MS = 1000;
const BACKOFF_MULTIPLIER = 2;

/**
 * React Native / TypeScript equivalent of the Swift `RealtimeService`.
 * Handles Supabase realtime subscriptions for orders and order status events.
 * Includes automatic reconnection with exponential backoff on channel errors.
 */
export class RealtimeService {
  private client: SupabaseClient;
  private ordersChannel: RealtimeChannel | null = null;
  private statusEventsChannel: RealtimeChannel | null = null;
  private ordersReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private statusReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private ordersReconnectAttempts = 0;
  private statusReconnectAttempts = 0;
  private lastOrdersHandler: OrderUpdateHandler | null = null;
  private lastStatusHandler: ((event: DBOrderStatusEvent) => void) | null = null;

  lastOrderUpdate: DBOrder | null = null;
  lastStatusEvent: DBOrderStatusEvent | null = null;
  ordersConnectionStatus: ConnectionStatus = 'disconnected';
  statusConnectionStatus: ConnectionStatus = 'disconnected';

  constructor(client: SupabaseClient = supabase) {
    this.client = client;
  }

  /**
   * Subscribe to order changes.
   * Includes automatic reconnection on channel errors with exponential backoff.
   */
  subscribeToOrders(onUpdate: OrderUpdateHandler): void {
    this.unsubscribeFromOrders();
    this.lastOrdersHandler = onUpdate;
    this.ordersReconnectAttempts = 0;
    this.ordersConnectionStatus = 'connecting';

    const channelName = `orders-changes-${Date.now()}`;
    this.ordersChannel = this.client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        payload => {
          const next = payload.new as DBOrder | null;
          if (!next) return;
          this.lastOrderUpdate = next;
          onUpdate(next);
        },
      )
      .subscribe((status, err) => {
        this.handleChannelStatus(
          'orders',
          status,
          err,
          () => this.reconnectOrders(),
        );
      });
  }

  /**
   * Subscribe to new order status events to drive live timelines.
   * Includes automatic reconnection on channel errors with exponential backoff.
   */
  subscribeToStatusEvents(onEvent: (event: DBOrderStatusEvent) => void): void {
    this.unsubscribeFromStatusEvents();
    this.lastStatusHandler = onEvent;
    this.statusReconnectAttempts = 0;
    this.statusConnectionStatus = 'connecting';

    const channelName = `order-status-events-${Date.now()}`;
    this.statusEventsChannel = this.client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_status_events',
        },
        payload => {
          const evt = payload.new as DBOrderStatusEvent | null;
          if (!evt) return;
          this.lastStatusEvent = evt;
          onEvent(evt);
        },
      )
      .subscribe((status, err) => {
        this.handleChannelStatus(
          'status-events',
          status,
          err,
          () => this.reconnectStatusEvents(),
        );
      });
  }

  unsubscribeFromOrders(): void {
    this.clearTimer('orders');
    if (this.ordersChannel) {
      this.ordersChannel.unsubscribe();
      this.ordersChannel = null;
    }
    this.ordersConnectionStatus = 'disconnected';
  }

  unsubscribeFromStatusEvents(): void {
    this.clearTimer('status-events');
    if (this.statusEventsChannel) {
      this.statusEventsChannel.unsubscribe();
      this.statusEventsChannel = null;
    }
    this.statusConnectionStatus = 'disconnected';
  }

  /**
   * Convenience to fully tear down realtime when user logs out, etc.
   */
  unsubscribeAll(): void {
    this.lastOrdersHandler = null;
    this.lastStatusHandler = null;
    this.unsubscribeFromOrders();
    this.unsubscribeFromStatusEvents();
  }

  private handleChannelStatus(
    label: string,
    status: string,
    err: Error | undefined,
    reconnectFn: () => void,
  ): void {
    logger.log(`[Realtime:${label}] Channel status: ${status}`, err?.message ?? '');

    if (status === 'SUBSCRIBED') {
      if (label === 'orders') {
        this.ordersConnectionStatus = 'connected';
        this.ordersReconnectAttempts = 0;
      } else {
        this.statusConnectionStatus = 'connected';
        this.statusReconnectAttempts = 0;
      }
      return;
    }

    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      if (label === 'orders') {
        this.ordersConnectionStatus = 'error';
      } else {
        this.statusConnectionStatus = 'error';
      }
      reconnectFn();
    }
  }

  private reconnectOrders(): void {
    if (!this.lastOrdersHandler) return;
    if (this.ordersReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error('[Realtime:orders] Max reconnect attempts reached, giving up');
      return;
    }

    const delay = INITIAL_RECONNECT_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, this.ordersReconnectAttempts);
    this.ordersReconnectAttempts++;
    logger.warn(`[Realtime:orders] Reconnecting in ${delay}ms (attempt ${this.ordersReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    this.clearTimer('orders');
    this.ordersReconnectTimer = setTimeout(() => {
      if (this.lastOrdersHandler) {
        this.subscribeToOrders(this.lastOrdersHandler);
      }
    }, delay);
  }

  private reconnectStatusEvents(): void {
    if (!this.lastStatusHandler) return;
    if (this.statusReconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error('[Realtime:status-events] Max reconnect attempts reached, giving up');
      return;
    }

    const delay = INITIAL_RECONNECT_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, this.statusReconnectAttempts);
    this.statusReconnectAttempts++;
    logger.warn(`[Realtime:status-events] Reconnecting in ${delay}ms (attempt ${this.statusReconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    this.clearTimer('status-events');
    this.statusReconnectTimer = setTimeout(() => {
      if (this.lastStatusHandler) {
        this.subscribeToStatusEvents(this.lastStatusHandler);
      }
    }, delay);
  }

  private clearTimer(label: 'orders' | 'status-events'): void {
    if (label === 'orders' && this.ordersReconnectTimer) {
      clearTimeout(this.ordersReconnectTimer);
      this.ordersReconnectTimer = null;
    }
    if (label === 'status-events' && this.statusReconnectTimer) {
      clearTimeout(this.statusReconnectTimer);
      this.statusReconnectTimer = null;
    }
  }
}

// Singleton instance to import elsewhere
export const realtimeService = new RealtimeService();

