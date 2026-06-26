import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { OrderFeedback, OrderIncident, IncidentType, ResolutionType, IncidentStatus } from '../models/Feedback';

const FEEDBACK_KEY = '@smartfood_feedback';
const INCIDENTS_KEY = '@smartfood_incidents';

export interface FeedbackState {
  feedbacks: OrderFeedback[];
  incidents: OrderIncident[];
  isLoaded: boolean;
  load: () => Promise<void>;
  submitFeedback: (feedback: Omit<OrderFeedback, 'id' | 'createdAt'>) => void;
  submitIncident: (incident: Omit<OrderIncident, 'id' | 'createdAt' | 'status' | 'resolution' | 'resolutionNote' | 'resolvedAt'>) => void;
  resolveIncident: (incidentId: string, resolution: ResolutionType, note: string) => void;
  getFeedbackForOrder: (orderId: string) => OrderFeedback | null;
  getIncidentsForOrder: (orderId: string) => OrderIncident[];
  getOpenIncidents: () => OrderIncident[];
  getColdFoodAlerts: () => { itemName: string; count: number }[];
}

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  feedbacks: [],
  incidents: [],
  isLoaded: false,

  load: async () => {
    try {
      const [fbRaw, incRaw] = await Promise.all([
        AsyncStorage.getItem(FEEDBACK_KEY),
        AsyncStorage.getItem(INCIDENTS_KEY),
      ]);
      set({
        feedbacks: fbRaw ? JSON.parse(fbRaw) : [],
        incidents: incRaw ? JSON.parse(incRaw) : [],
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true });
    }
  },

  submitFeedback: (feedback) => {
    const entry: OrderFeedback = {
      ...feedback,
      id: `fb-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    set(state => {
      const updated = [...state.feedbacks, entry];
      AsyncStorage.setItem(FEEDBACK_KEY, JSON.stringify(updated)).catch(() => {});
      return { feedbacks: updated };
    });
    if (isSupabaseConfigured) {
      supabase.from('order_feedback').insert({
        order_id: feedback.orderId,
        customer_id: feedback.customerId,
        overall_rating: feedback.overallRating,
        food_rating: feedback.foodRating ?? null,
        delivery_rating: feedback.deliveryRating ?? null,
        comment: feedback.comment ?? null,
        tags: feedback.tags ?? [],
      }).then(() => {}).catch(() => {});
    }
  },

  submitIncident: (incident) => {
    const entry: OrderIncident = {
      ...incident,
      id: `inc-${Date.now()}`,
      status: 'open',
      resolution: null,
      resolutionNote: null,
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    };
    set(state => {
      const updated = [...state.incidents, entry];
      AsyncStorage.setItem(INCIDENTS_KEY, JSON.stringify(updated)).catch(() => {});
      return { incidents: updated };
    });
    if (isSupabaseConfigured) {
      supabase.from('order_incidents').insert({
        order_id: incident.orderId,
        customer_id: incident.customerId,
        type: incident.type,
        description: incident.description,
        status: 'open',
      }).then(() => {}).catch(() => {});
    }
  },

  resolveIncident: (incidentId, resolution, note) => {
    set(state => {
      const updated = state.incidents.map(inc =>
        inc.id === incidentId
          ? { ...inc, status: 'resolved' as IncidentStatus, resolution, resolutionNote: note, resolvedAt: new Date().toISOString() }
          : inc,
      );
      AsyncStorage.setItem(INCIDENTS_KEY, JSON.stringify(updated)).catch(() => {});
      return { incidents: updated };
    });
  },

  getFeedbackForOrder: (orderId) => {
    return get().feedbacks.find(f => f.orderId === orderId) ?? null;
  },

  getIncidentsForOrder: (orderId) => {
    return get().incidents.filter(i => i.orderId === orderId);
  },

  getOpenIncidents: () => {
    return get().incidents.filter(i => i.status === 'open' || i.status === 'in_review');
  },

  getColdFoodAlerts: () => {
    const coldIncidents = get().incidents.filter(i => i.type === 'cold_food');
    const countMap: Record<string, number> = {};
    for (const inc of coldIncidents) {
      countMap[inc.description] = (countMap[inc.description] || 0) + 1;
    }
    return Object.entries(countMap)
      .filter(([, c]) => c >= 3)
      .map(([name, count]) => ({ itemName: name, count }));
  },
}));
