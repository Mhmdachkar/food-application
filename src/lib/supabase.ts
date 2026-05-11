import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Config } from '../config/Config';
import { logger } from '../utils/logger';

const url = Config.supabaseUrl;
const key = Config.supabaseAnonKey;

export const isSupabaseConfigured =
  url.length > 0 &&
  key.length > 0 &&
  !url.includes('YOUR') &&
  !key.includes('YOUR') &&
  url.startsWith('https://');

logger.log('[SUPABASE] url=', url ? url.substring(0, 30) + '...' : '(empty)');
logger.log('[SUPABASE] key length=', key.length);
logger.log('[SUPABASE] isConfigured=', isSupabaseConfigured);

// Typed Supabase client instance shared across services.
export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? url : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? key : 'placeholder-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

