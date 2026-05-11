import type { CartItem } from './Cart';
import type { DeliveryAddress } from './AppUser';

export type OrderStatus =
  | 'PLACED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELED';

export interface OrderTimelineEvent {
  id: string;
  status: OrderStatus;
  timestamp: string; // ISO8601
  note?: string | null;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string | null;
  items: CartItem[];
  status: OrderStatus;
  timeline: OrderTimelineEvent[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  tip: number;
  total: number;
  deliveryAddress: DeliveryAddress;
  deliveryNotes: string;
  promoCode?: string | null;
  promoDiscount: number;
  driverId?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  driverAvatarUrl?: string | null;
  driverRating?: number | null;
  estimatedDeliveryTime?: string | null;
  estimatedPickupTime?: string | null;
  actualDeliveryTime?: string | null;
  scheduledFor?: string | null;
  cancelReason?: string | null;
  canceledBy?: 'customer' | 'admin' | 'driver' | null;
  deliveryProofNote?: string | null;
  deliveryProofPhotoUrl?: string | null;
  createdAt: string; // ISO8601
}

