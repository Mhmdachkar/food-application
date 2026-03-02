# Voice AI Food Ordering App

A full-stack food delivery application built with React Native (Expo), TypeScript, and Supabase, featuring AI-powered voice ordering and comprehensive order management.

## Features

### Customer Features
- 🎤 **Voice AI Ordering** - Natural language voice commands for ordering food
- 🏠 **Smart Home Screen** - Delivery banner, live activity feed, flash deals, quick reorder
- 🔥 **Flash Deals** - Time-limited offers with countdown timers
- 🏆 **Top Picks Today** - Curated high-rated items
- 👁️ **Recently Viewed** - Track and revisit viewed items
- 🚚 **Free Delivery Progress** - Visual progress toward free delivery threshold
- 💰 **Savings Card** - Real-time savings breakdown
- 🎯 **Popular Now Badge** - Trending items indicator
- 👥 **Group Orders** - Order with friends
- 📅 **Scheduled Orders** - Pre-order meals
- 🏅 **Loyalty Program** - Points, tiers, and streaks
- 🛡️ **Dietary Profiles** - Allergen safety and preferences

### Driver Features
- 📍 **Live Tracking** - Real-time order tracking
- 🗺️ **Heat Map** - Zone demand visualization
- 💵 **Earnings Dashboard** - Track income and tips

### Admin Features
- 📊 **Dashboard** - Order analytics and metrics
- 🚦 **Dispatch System** - Order assignment and routing
- 🍔 **Menu Management** - Add/edit menu items
- 🎫 **Incident Management** - Handle customer issues

## Tech Stack

- **Frontend**: React Native (Expo), TypeScript, Expo Router
- **State Management**: Zustand
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Voice AI**: Pollinations AI (STT, TTS, Chat)
- **Icons**: Lucide React Native, Expo Vector Icons
- **Images**: Expo Image
- **Animations**: React Native Animated API

## Setup

### Prerequisites
- Node.js 18+ and npm
- Expo CLI (`npm install -g expo-cli`)
- Supabase account
- iOS Simulator (Mac) or Android Emulator

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Mhmdachkar/voice-ai-agent-foodapp.git
   cd voice-ai-agent-foodapp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   POLLINATION_API_KEY=your-api-key-here
   VOICE_CHAT_URL=https://gen.pollinations.ai/v1/chat/completions
   VOICE_TTS_URL=https://gen.pollinations.ai/v1/audio/speech
   VOICE_STT_URL=https://gen.pollinations.ai/v1/audio/transcriptions
   APP_ENV=development
   ```

   **⚠️ SECURITY WARNING**: Never commit the `.env` file to Git. It's already in `.gitignore`.

4. **Set up Supabase**
   
   Run the SQL migrations in your Supabase project:
   ```bash
   # In Supabase SQL Editor, run these files in order:
   # 1. supabase/migrations/001_initial_schema.sql
   # 2. supabase/fix_rls_policies.sql
   # 3. supabase/new_features_schema.sql
   # 4. supabase/seed.sql (optional - demo data)
   ```

5. **Start the development server**
   ```bash
   npm start
   ```

6. **Run on your device**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app for physical device

## Project Structure

```
├── app/                      # Expo Router file-based routing
│   ├── customer/            # Customer screens
│   ├── driver/              # Driver screens
│   ├── admin/               # Admin screens
│   ├── auth/                # Authentication screens
│   └── voice/               # Voice AI screens
├── src/
│   ├── components/          # Reusable UI components
│   ├── screens/             # Screen components
│   ├── state/               # Zustand stores
│   ├── services/            # API services
│   ├── models/              # TypeScript types
│   ├── theme/               # Design system
│   ├── providers/           # Context providers
│   ├── config/              # App configuration
│   └── lib/                 # Supabase client
├── supabase/                # Database migrations & seeds
└── SmartFoodDeliveryApp/    # Swift iOS app (optional)
```

## Environment Variables

All sensitive credentials are managed through environment variables:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `POLLINATION_API_KEY` - API key for voice AI services
- `VOICE_CHAT_URL` - Voice chat endpoint
- `VOICE_TTS_URL` - Text-to-speech endpoint
- `VOICE_STT_URL` - Speech-to-text endpoint
- `APP_ENV` - Environment (development/production)

**Never commit these values to version control!**

## Security Best Practices

1. ✅ All API keys are stored in `.env` (gitignored)
2. ✅ Configuration uses environment variables via `app.config.ts`
3. ✅ Supabase Row Level Security (RLS) enabled on all tables
4. ✅ No hardcoded credentials in source code
5. ✅ `.env.example` provided for reference

## Demo Credentials

For testing purposes (after running seed.sql):

**Customer**
- Email: `customer@demo.com`
- Password: `demo123`

**Driver**
- Email: `driver@demo.com`
- Password: `demo123`

**Admin**
- Email: `admin@demo.com`
- Password: `demo123`

## Scripts

```bash
npm start          # Start Expo dev server
npm run android    # Run on Android
npm run ios        # Run on iOS
npm run web        # Run on web
npm test           # Run tests
npm run lint       # Run ESLint
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please open an issue on GitHub.

---

Built with ❤️ using React Native, Expo, and Supabase
