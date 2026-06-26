import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ORDERS_QUERY_KEY } from './useOrdersQuery';

/**
 * Subscribes to Supabase Realtime channels for `orders` and
 * `order_status_events`.  Any INSERT or UPDATE on either table
 * immediately invalidates the React Query orders cache, so every
 * screen that reads from useOrdersQuery re-fetches instantly.
 *
 * Designed to be called once from each role's _layout — the
 * subscription lives for the lifetime of the tab navigator and
 * is cleanly removed when the user navigates away (e.g. logs out).
 *
 * A 60-second poll via refetchInterval in the query hooks acts as
 * a safety-net fallback in case the WebSocket is unavailable.
 */
export function useRealtimeOrders() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: [...ORDERS_QUERY_KEY] });
    };

    /* Use a unique channel name so multiple role layouts never share
     * the same channel and accidentally unsubscribe each other. */
    const channelName = `rt-orders-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      /* any change on orders (INSERT from customer, UPDATE from admin/driver) */
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        invalidate,
      )
      /* new status event → same invalidation; catches PICKED_UP, DELIVERED, etc. */
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_status_events' },
        invalidate,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
