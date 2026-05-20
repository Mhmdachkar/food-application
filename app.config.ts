import 'dotenv/config';

export default {
  expo: {
    name: 'SmartFoodDeliveryApp',
    slug: 'smart-food-delivery-app',
    scheme: 'smartfooddelivery',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    platforms: ['ios', 'android', 'web'],
    web: {
      bundler: 'metro',
      output: 'single',
    },
    experiments: {
      typedRoutes: true
    },
    plugins: [
      'expo-router',
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#FF8C1A',
          defaultChannel: 'default',
        },
      ],
    ],
    extra: {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      POLLINATION_API_KEY: process.env.POLLINATION_API_KEY,
      VOICE_CHAT_URL: process.env.VOICE_CHAT_URL,
      VOICE_TTS_URL: process.env.VOICE_TTS_URL,
      VOICE_STT_URL: process.env.VOICE_STT_URL,
      GROQ_API_KEY: process.env.GROQ_API_KEY,
      APP_ENV: process.env.APP_ENV ?? 'development',
    }
  }
};

