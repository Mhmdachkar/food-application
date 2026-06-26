import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { DBProfile } from '../models/SupabaseModels';
import type { AppUser } from '../models/AppUser';
import { mapProfileToAppUser } from '../services/mappers/profileMapper';
import { logger } from '../utils/logger';

export interface AuthResult {
  user: AppUser | null;
  error?: string;
}

/**
 * Auth service wrapping Supabase auth & profiles table.
 * Mirrors `SupabaseAuthService` behavior from Swift.
 */
export class AuthService {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = supabase) {
    this.client = client;
  }

  async initialize(): Promise<AuthResult> {
    if (!isSupabaseConfigured) {
      return { user: null, error: undefined };
    }
    try {
      const {
        data: { session },
        error,
      } = await this.client.auth.getSession();
      if (error || !session) {
        return { user: null, error: error?.message };
      }
      const profile = await this.fetchProfile(session.user.id);
      if (!profile) return { user: null, error: 'Failed to load profile' };
      const user = mapProfileToAppUser(profile);
      return { user };
    } catch (e: any) {
      return { user: null, error: e?.message ?? 'Failed to initialize auth' };
    }
  }

  async signUp(
    email: string,
    password: string,
    fullName: string,
    role: string,
  ): Promise<AuthResult> {
    if (!isSupabaseConfigured) {
      return { user: null, error: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file, or use Quick Login.' };
    }
    try {
      logger.log('[AUTH] Starting signup:', { email, fullName, role });
      
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role,
          },
        },
      });
      
      logger.log('[AUTH] Signup response:', { 
        userId: data.user?.id, 
        error: error?.message,
        session: !!data.session 
      });
      
      if (error || !data.user) {
        logger.log('[AUTH] Signup failed:', error?.message);
        return { user: null, error: error?.message ?? 'Sign up failed' };
      }
      
      logger.log('[AUTH] Fetching profile for:', data.user.id);
      const profile = await this.fetchProfile(data.user.id, true);
      
      logger.log('[AUTH] Profile fetched:', profile ? 'Found' : 'Not found');
      
      if (!profile) {
        logger.log('[AUTH] Profile not found. Database trigger may not have run.');
        return { 
          user: null, 
          error: 'Profile not created. Please ensure database migration is complete.' 
        };
      }
      
      const user = mapProfileToAppUser(profile);
      logger.log('[AUTH] User mapped successfully:', user.name, user.role);
      
      return { user };
    } catch (e: any) {
      logger.error('[AUTH] Exception during signup:', e);
      return { user: null, error: e?.message ?? 'Sign up failed' };
    }
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    if (!isSupabaseConfigured) {
      return { user: null, error: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file, or use Quick Login.' };
    }
    try {
      logger.log('[AUTH] Starting sign in:', { email });
      
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password,
      });
      
      logger.log('[AUTH] Sign in response:', { 
        userId: data.user?.id, 
        error: error?.message 
      });
      
      if (error || !data.user) {
        logger.log('[AUTH] Sign in failed:', error?.message);
        return { user: null, error: error?.message ?? 'Sign in failed' };
      }
      
      const profile = await this.fetchProfile(data.user.id);
      
      if (!profile) {
        logger.log('[AUTH] Profile not found for existing user');
        return { user: null, error: 'Profile not found. Please contact support.' };
      }
      
      const user = mapProfileToAppUser(profile);
      logger.log('[AUTH] Sign in successful:', user.name, user.role);
      
      return { user };
    } catch (e: any) {
      logger.error('[AUTH] Exception during sign in:', e);
      return { user: null, error: e?.message ?? 'Sign in failed' };
    }
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  async updateFoodMemory(userId: string, memory: {
    dietary_restrictions?: string[];
    disliked_ingredients?: string[];
    spice_level?: string;
    default_drink?: string | null;
    common_notes?: string | null;
    preferred_cuisines?: string[];
  }): Promise<void> {
    if (!isSupabaseConfigured) return;
    try {
      await this.client
        .from('profiles')
        .update({ food_memory: memory })
        .eq('id', userId);
    } catch {
      // silently fail — AsyncStorage is the fallback
    }
  }

  private async fetchProfile(userId: string, waitForTrigger = false): Promise<DBProfile | null> {
    logger.log('[AUTH] Fetching profile for user:', userId);

    const maxAttempts = waitForTrigger ? 5 : 1;
    let delay = 500; // ms — doubles each attempt: 500 → 1000 → 2000 → 4000 → 8000

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (waitForTrigger && attempt > 1) {
        logger.log(`[AUTH] Profile poll attempt ${attempt}/${maxAttempts}, waiting ${delay}ms`);
      }

      // Wait before the query on retries (first attempt has no delay for non-trigger path)
      if (waitForTrigger) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const { data, error } = await this.client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle<DBProfile>();

      if (error) {
        logger.error('[AUTH] Profile fetch error:', error.message);
        return null;
      }

      if (data) {
        return data;
      }

      // Profile not found yet — double delay for next attempt
      delay *= 2;
    }

    logger.log('[AUTH] No profile found for user:', userId);
    return null;
  }
}

export const authService = new AuthService();

