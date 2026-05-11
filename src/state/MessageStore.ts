import { create } from 'zustand';
import type { Message, ChatThread, DriverRating, DeliveryProof } from '../models/Message';

/* ──────────────────────────── helpers ──────────────────────────── */

let _msgCounter = 0;
const genId = () => `msg-${Date.now()}-${++_msgCounter}`;

/* ──────────────────────────── store ───────────────────────────── */

export interface MessageStoreState {
  threads: Record<string, ChatThread>; // keyed by orderId
  ratings: DriverRating[];
  deliveryProofs: Record<string, DeliveryProof>; // keyed by orderId

  // Thread helpers
  getThread: (orderId: string) => ChatThread | null;
  getThreadsForUser: (userId: string) => ChatThread[];
  getUnreadCount: (userId: string) => number;

  // Messaging
  sendMessage: (params: {
    orderId: string;
    senderId: string;
    senderName: string;
    senderRole: 'customer' | 'driver' | 'admin' | 'system';
    text: string;
    type?: Message['type'];
    metadata?: Message['metadata'];
  }) => Message;

  markThreadRead: (orderId: string, userId: string) => void;

  // Thread management
  initThread: (params: {
    orderId: string;
    customerId: string;
    customerName: string;
    driverId: string;
    driverName: string;
  }) => void;

  // System messages
  sendSystemMessage: (orderId: string, text: string, metadata?: Message['metadata']) => void;
  sendEtaUpdate: (orderId: string, driverName: string, newEta: string, oldEta?: string) => void;
  sendStatusUpdate: (orderId: string, newStatus: string, oldStatus?: string) => void;

  // Driver ratings
  addRating: (rating: Omit<DriverRating, 'id' | 'timestamp'>) => void;
  getRatingsForDriver: (driverId: string) => DriverRating[];
  getAverageRating: (driverId: string) => number;
  getRatingForOrder: (orderId: string) => DriverRating | null;

  // Delivery proof
  setDeliveryProof: (proof: DeliveryProof) => void;
  getDeliveryProof: (orderId: string) => DeliveryProof | null;
}

export const useMessageStore = create<MessageStoreState>((set, get) => ({
  threads: {},
  ratings: [],
  deliveryProofs: {},

  /* ── Thread helpers ── */

  getThread: (orderId) => get().threads[orderId] ?? null,

  getThreadsForUser: (userId) => {
    const all = Object.values(get().threads);
    return all
      .filter(t => t.customerId === userId || t.driverId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  getUnreadCount: (userId) => {
    const threads = Object.values(get().threads);
    let total = 0;
    for (const t of threads) {
      if (t.customerId === userId || t.driverId === userId) {
        // Count messages NOT sent by this user that are unread
        total += t.messages.filter(m => m.senderId !== userId && !m.read).length;
      }
    }
    return total;
  },

  /* ── Thread management ── */

  initThread: ({ orderId, customerId, customerName, driverId, driverName }) => {
    const existing = get().threads[orderId];
    if (existing) return; // already exists

    const welcomeMsg: Message = {
      id: genId(),
      orderId,
      senderId: 'system',
      senderName: 'System',
      senderRole: 'system',
      text: `Chat started for order #${orderId.slice(0, 6)}. You can now message your driver directly.`,
      timestamp: new Date().toISOString(),
      read: false,
      type: 'system',
    };

    const thread: ChatThread = {
      orderId,
      customerId,
      customerName,
      driverId,
      driverName,
      messages: [welcomeMsg],
      lastMessage: welcomeMsg,
      unreadCount: 1,
      updatedAt: new Date().toISOString(),
    };

    set(state => ({
      threads: { ...state.threads, [orderId]: thread },
    }));
  },

  /* ── Messaging ── */

  sendMessage: ({ orderId, senderId, senderName, senderRole, text, type = 'text', metadata }) => {
    const msg: Message = {
      id: genId(),
      orderId,
      senderId,
      senderName,
      senderRole,
      text,
      timestamp: new Date().toISOString(),
      read: false,
      type,
      metadata: metadata ?? null,
    };

    set(state => {
      const thread = state.threads[orderId];
      if (!thread) return state;

      const updatedThread: ChatThread = {
        ...thread,
        messages: [...thread.messages, msg],
        lastMessage: msg,
        unreadCount: thread.unreadCount + 1,
        updatedAt: msg.timestamp,
      };

      return {
        threads: { ...state.threads, [orderId]: updatedThread },
      };
    });

    return msg;
  },

  markThreadRead: (orderId, userId) => {
    set(state => {
      const thread = state.threads[orderId];
      if (!thread) return state;

      const updatedMessages = thread.messages.map(m =>
        m.senderId !== userId && !m.read ? { ...m, read: true } : m,
      );

      const unread = updatedMessages.filter(m => m.senderId !== userId && !m.read).length;

      return {
        threads: {
          ...state.threads,
          [orderId]: {
            ...thread,
            messages: updatedMessages,
            unreadCount: unread,
          },
        },
      };
    });
  },

  /* ── System messages ── */

  sendSystemMessage: (orderId, text, metadata) => {
    get().sendMessage({
      orderId,
      senderId: 'system',
      senderName: 'System',
      senderRole: 'system',
      text,
      type: 'system',
      metadata,
    });
  },

  sendEtaUpdate: (orderId, driverName, newEta, oldEta) => {
    const etaTime = new Date(newEta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    get().sendMessage({
      orderId,
      senderId: 'system',
      senderName: 'System',
      senderRole: 'system',
      text: `${driverName} updated the estimated delivery time to ${etaTime}`,
      type: 'eta_update',
      metadata: { newEta, oldEta },
    });
  },

  sendStatusUpdate: (orderId, newStatus, oldStatus) => {
    const labels: Record<string, string> = {
      PLACED: 'placed',
      ACCEPTED: 'accepted by the restaurant',
      PREPARING: 'being prepared',
      READY: 'ready for pickup',
      OUT_FOR_DELIVERY: 'out for delivery',
      DELIVERED: 'delivered',
      CANCELED: 'canceled',
      PICKED_UP: 'picked up by driver',
    };
    get().sendMessage({
      orderId,
      senderId: 'system',
      senderName: 'System',
      senderRole: 'system',
      text: `Order is now ${labels[newStatus] ?? newStatus.toLowerCase()}`,
      type: 'status_update',
      metadata: { newStatus, oldStatus },
    });
  },

  /* ── Ratings ── */

  addRating: (partial) => {
    const rating: DriverRating = {
      ...partial,
      id: `rating-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    set(state => ({ ratings: [...state.ratings, rating] }));
  },

  getRatingsForDriver: (driverId) => {
    return get().ratings.filter(r => r.driverId === driverId);
  },

  getAverageRating: (driverId) => {
    const ratings = get().ratings.filter(r => r.driverId === driverId);
    if (ratings.length === 0) return 0;
    return ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
  },

  getRatingForOrder: (orderId) => {
    return get().ratings.find(r => r.orderId === orderId) ?? null;
  },

  /* ── Delivery proof ── */

  setDeliveryProof: (proof) => {
    set(state => ({
      deliveryProofs: { ...state.deliveryProofs, [proof.orderId]: proof },
    }));
  },

  getDeliveryProof: (orderId) => {
    return get().deliveryProofs[orderId] ?? null;
  },
}));
