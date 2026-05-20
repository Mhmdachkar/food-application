import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDataStore } from '../state/DataStore';
import { ORDERS_QUERY_KEY } from './useOrdersQuery';
import type { CartItem } from '../models/Cart';
import type { DeliveryAddress } from '../models/AppUser';

interface PlaceOrderOptions {
  userId: string;
  customerName: string;
  items: CartItem[];
  address: DeliveryAddress;
  notes: string;
  promoCode?: string | null;
  tip: number;
  paymentMethod: string;
}

export function usePlaceOrderMutation() {
  const queryClient = useQueryClient();
  const placeOrderViaSupabase = useDataStore(s => s.placeOrderViaSupabase);

  return useMutation<string | null, Error, PlaceOrderOptions>({
    mutationFn: async (options) => {
      return placeOrderViaSupabase(options);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    },
  });
}
