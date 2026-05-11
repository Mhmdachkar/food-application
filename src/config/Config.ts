import Constants from 'expo-constants';

export interface AppConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  pollinationApiKey: string;
  voiceChatUrl: string;
  voiceTtsUrl: string;
  voiceSttUrl: string;
  appEnv: 'development' | 'production' | string;
}

const extra = Constants.expoConfig?.extra ?? {};

const getEnv = (key: string, fallback: string = ''): string => {
  // 1. Try expo-constants extra (forwarded from app.config.ts)
  const fromExtra = extra[key];
  if (typeof fromExtra === 'string' && fromExtra.length > 0) return fromExtra;
  // 2. Try process.env (works in web / Metro config-time)
  const fromProcess = (process.env as Record<string, string | undefined>)[key];
  if (typeof fromProcess === 'string' && fromProcess.length > 0) return fromProcess;
  // 3. Fallback
  return fallback;
};

export const Config: AppConfig = {
  supabaseUrl: getEnv('SUPABASE_URL'),
  supabaseAnonKey: getEnv('SUPABASE_ANON_KEY'),
  pollinationApiKey: getEnv('POLLINATION_API_KEY'),
  voiceChatUrl: getEnv('VOICE_CHAT_URL', 'https://text.pollinations.ai/openai/v1/chat/completions'),
  voiceTtsUrl: getEnv('VOICE_TTS_URL', 'https://text.pollinations.ai/openai'),
  voiceSttUrl: getEnv('VOICE_STT_URL', 'https://text.pollinations.ai/openai'),
  appEnv: getEnv('APP_ENV', 'development'),
};

