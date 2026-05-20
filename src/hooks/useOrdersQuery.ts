import { useQuery } from '@tanstack/react-query';
import { orderService } from '../services/OrderService';
import type { Order } from '../models/Order';

export const ORDERS_QUERY_KEY = ['orders'] as const;

export function useOrdersQuery(userId: string | undefined, role: 'customer' | 'admin' | 'driver' | null) {
  return useQuery<Order[], Error>({
    queryKey: [...ORDERS_QUERY_KEY, userId, role],
    queryFn: async () => {
      if (!userId || !role) return [];
      return orderService.fetchOrders(userId, role);
    },
    enabled: !!userId && !!role,
  });
}
