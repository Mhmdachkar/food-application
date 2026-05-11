export interface Message {
  id: string;
  orderId: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'driver' | 'admin' | 'system';
  text: string;
  timestamp: string; // ISO8601
  read: boolean;
  type: 'text' | 'image' | 'eta_update' | 'status_update' | 'system';
  metadata?: MessageMetadata | null;
}

export interface MessageMetadata {
  imageUrl?: string;
  newEta?: string; // ISO8601
  oldEta?: string;
  newStatus?: string;
  oldStatus?: string;
}

export interface ChatThread {
  orderId: string;
  customerId: string;
  customerName: string;
  driverId: string;
  driverName: string;
  messages: Message[];
  lastMessage: Message | null;
  unreadCount: number;
  updatedAt: string;
}

export interface DriverRating {
  id: string;
  orderId: string;
  customerId: string;
  driverId: string;
  rating: number; // 1-5
  comment: string;
  timestamp: string;
}

export interface DeliveryProof {
  orderId: string;
  driverId: string;
  note: string;
  photoUrl?: string | null;
  timestamp: string;
}
