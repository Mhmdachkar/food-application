import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DRIVERS_QUERY_KEY } from './useDriversQuery';
import { ORDERS_QUERY_KEY } from './useOrdersQuery';

/**
 * Subscribes to Supabase Realtime changes on the `driver_status` table.
 * When a driver goes online/offline or accepts an order, the admin
 * dispatch and dashboard screens update immediately.
 *
 * Also invalidates orders because driver assignment changes the
 * `assigned_driver_id` column on the orders row.
 *
 * Intended to be mounted from the admin _layout.
 */
export function useRealtimeDriverStatus() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channelName = `rt-driver-status-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_status' },
        () => {
          queryClient.invalidateQueries({ queryKey: [...DRIVERS_QUERY_KEY] });
          queryClient.invalidateQueries({ queryKey: [...ORDERS_QUERY_KEY] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
