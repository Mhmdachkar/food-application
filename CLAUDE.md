# CLAUDE.md — AI Assistant Context for SmartFood

> This file provides project context to AI coding assistants (Claude, Cursor, Windsurf, etc.) working on the SmartFood codebase.

---

## Project Overview

**SmartFood** is a React Native (Expo) food delivery app with three user roles: **customer**, **driver**, and **admin**. Its key differentiator is a **voice-first AI ordering system** powered by Pollinations API. The app uses Supabase for backend (auth, database, realtime) and Zustand for state management.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React Native (Expo) | SDK 54, RN 0.81.5 |
| Language | TypeScript | latest (strict) |
| Routing | Expo Router | v6 (file-based) |
| State | Zustand | v5 |
| Backend | Supabase | JS SDK ^2.97.0 |
| Voice AI | Pollinations API | Free tier (no API key required) |
| Audio | expo-av, expo-speech | ~16.0.8, ~14.0.8 |
| Icons | @expo/vector-icons (Ionicons) | ^15.0.3 |
| Storage | @react-native-async-storage | 2.2.0 |
| Styling | NativeWind (TailwindCSS) | 4.2.3 (new code only) |
| Data Fetching | @tanstack/react-query | (pending install) |

---

## Project Structure

```
food app/
├── app/                          # Expo Router pages (file-based routing)
│   ├── _layout.tsx               # Root layout: SafeAreaProvider → RecentlyViewedProvider → Slot
│   ├── index.tsx                 # Auth check → role-based redirect
│   ├── auth/login.tsx            # Login/signup screen
│   ├── customer/                 # 5 tabs + 12 hidden routes
│   │   ├── _layout.tsx           # Tab navigator (Home, Browse, Orders, Cart, Account)
│   │   ├── home.tsx, cart.tsx, checkout.tsx, orders.tsx, profile.tsx, ...
│   │   └── menu-item/[itemId].tsx  # Dynamic route
│   ├── driver/                   # 4 tabs + 2 hidden routes
│   │   ├── _layout.tsx           # Tab navigator (Available, Active, Earnings, Profile)
│   │   └── available.tsx, active.tsx, earnings.tsx, ...
│   ├── admin/                    # 5 tabs + 3 hidden routes
│   │   ├── _layout.tsx           # Tab navigator (Dashboard, Orders, Menu, Dispatch, Settings)
│   │   └── dashboard.tsx, orders.tsx, menu.tsx, ...
│   └── voice/                    # Voice AI screens
│       ├── ai.tsx                # Text-based AI assistant
│       └── call.tsx              # Voice call interface
├── src/
│   ├── state/                    # 16 Zustand stores
│   │   ├── AuthStore.ts          # Auth state, signIn/signUp/signOut, quickLogin (demo)
│   │   ├── CartStore.ts          # Cart items, promo, computed totals (subtotal/tax/deliveryFee/total)
│   │   ├── DataStore.ts          # Menu items, orders, CRUD via services
│   │   ├── VoiceCallStore.ts     # Voice call lifecycle, action parsing, cart integration
│   │   ├── MessageStore.ts       # Chat threads, messages, read receipts
│   │   ├── EventBus.ts           # Pub/sub for cross-store events
│   │   ├── FavoritesStore.ts     # Favorite menu items
│   │   ├── FeedbackStore.ts      # Order feedback/ratings
│   │   ├── GroupOrderStore.ts    # Group ordering sessions
│   │   ├── KitchenQueueStore.ts  # Kitchen queue positions
│   │   ├── LoyaltyStore.ts       # Points, tiers, streaks
│   │   ├── NotificationStore.ts  # In-app notifications
│   │   ├── ReferralStore.ts      # Referral program
│   │   ├── ScheduleOrderStore.ts # Scheduled/recurring orders
│   │   ├── SmartReorderStore.ts  # Reorder suggestions
│   │   └── UpsellStore.ts        # Cart upsell suggestions
│   ├── services/                 # 11 service classes (singletons)
│   │   ├── AuthService.ts        # Supabase auth wrapper
│   │   ├── MenuService.ts        # Menu CRUD, category mapping
│   │   ├── OrderService.ts       # Order RPCs (create_order, update_order_status)
│   │   ├── DriverService.ts      # Driver status, online/offline
│   │   ├── VoiceAIService.ts     # Pollinations chat/STT/TTS
│   │   ├── AudioService.ts       # Recording/playback (Web + Native)
│   │   ├── AIClient.ts           # Local heuristic recommendation engine
│   │   ├── MenuSearchService.ts  # Scored search with semantic matching
│   │   ├── FoodMemoryService.ts  # Persist food preferences (AsyncStorage)
│   │   ├── RealtimeService.ts    # Supabase realtime subscriptions
│   │   └── mappers/profileMapper.ts  # DB profile → AppUser mapper
│   ├── models/                   # 15 TypeScript model files
│   │   ├── AppUser.ts            # User profile with FoodMemory, address
│   │   ├── MenuItem.ts           # Menu item with modifiers, nutrition, allergens
│   │   ├── Order.ts              # Order with timeline events, status enum
│   │   ├── Cart.ts               # CartItem with modifiers, instructions
│   │   ├── SupabaseModels.ts     # DB row types (DBProfile, DBOrder, etc.)
│   │   ├── VoiceCallTypes.ts     # Call state, message types
│   │   ├── VoiceActions.ts       # AI action types (add_to_cart, etc.)
│   │   ├── FoodMemory.ts         # Dietary preferences, spice level, cuisines
│   │   └── ... (Message, Notification, Loyalty, Feedback, etc.)
│   ├── screens/                  # 39 screen components
│   │   ├── Auth/LoginScreen.tsx
│   │   ├── Customer/             # 22 screens
│   │   ├── Driver/               # 5 screens
│   │   ├── Admin/                # 8 screens
│   │   ├── Shared/ChatScreen.tsx
│   │   └── Voice/                # 2 screens (VoiceAIScreen, VoiceCallScreen)
│   ├── components/               # 17 reusable components
│   ├── theme/                    # Design tokens + themed components
│   │   ├── theme.ts              # colors, spacing, radii, shadows, typography
│   │   └── components/           # Button, Card, Input, Chip, EmptyState, etc.
│   ├── providers/RecentlyViewedProvider.tsx
│   ├── config/Config.ts          # Environment variable reader
│   ├── lib/supabase.ts           # Supabase client + isSupabaseConfigured flag
│   └── mocks/deals.ts            # Flash deal & popular item mock data
├── supabase/                     # Database SQL files
│   ├── seed.sql                  # Demo data (3 customers, 1 admin, 2 drivers, 24 items)
│   ├── fix_all_rls.sql           # RLS policy fixes
│   ├── fix_rls_policies.sql      # Additional RLS fixes
│   └── new_features_schema.sql   # Loyalty, feedback, incidents, scheduling tables
├── docs/
│   ├── GRILLME.md                # Technical audit with critical issues
│   └── PRD.md                    # Product Requirements Document
├── app.config.ts                 # Expo config (reads .env)
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
└── .env                          # Environment variables (gitignored)
```

---

## Key Architectural Patterns

### Data Flow
```
User Action → Screen → Zustand Store → Service → Supabase
                              ↕
                          EventBus (cross-store)
```

### State Management
- All 16 stores use `zustand/create()` with interface-first pattern
- Computed values (subtotal, tax, total) are functions on the store, not derived state
- `EventBus` singleton publishes typed events: `orderPlaced`, `orderStatusChanged`, `driverAssigned`, `cartUpdated`, `notificationReceived`

### Service Layer
- All services are singletons exported as default instances
- Constructors accept optional `SupabaseClient` for DI/testing
- DB types (e.g., `DBOrder`) are mapped to domain types (e.g., `Order`) in service methods
- Services never expose raw Supabase queries to UI

### Voice AI Pipeline
```
Recording → STT (Pollinations/Browser) → LLM Chat → Parse ACTION blocks → Execute → TTS → Loop
```
- Action format: `|||ACTION:{"type":"add_to_cart","item":"Classic Burger","quantity":2}|||`
- Fuzzy matching via Levenshtein distance for menu item names
- Sara persona: friendly, bilingual (EN/AR), ultra-short responses

### Navigation
- Expo Router file-based: `app/` directory maps to routes
- Role-based redirect in `app/index.tsx`
- Tab layouts per role with hidden routes for secondary screens

---

## Database

### Core Tables
`profiles`, `categories`, `menu_items`, `modifier_groups`, `modifier_options`, `item_modifier_groups`, `orders`, `order_lines`, `order_status_events`, `driver_status`, `addresses`

### Extended Tables
`loyalty_profiles`, `order_feedback`, `order_incidents`, `scheduled_orders`, `group_orders`, `group_order_members`, `kitchen_queue`

### Key RPCs
- `create_order` — Places new order with lines and initial status event
- `update_order_status` — Updates order status and creates status event
- `driver_accept_order` / `assign_driver` — Driver assignment

### Auth Trigger
`on_auth_user_created` → `handle_new_user()`: auto-creates profile row + driver_status (if role=driver) on signup.

### RLS
All tables have RLS enabled. Role checks use `auth.jwt()->'user_metadata'->>'role'`.

### Demo Data
- **Customers:** sarah@demo.com, mike@demo.com, emily@demo.com
- **Admin:** alex@demo.com
- **Drivers:** james@demo.com, lisa@demo.com
- **Password:** Demo1234!
- **Menu:** 24 items across 12 categories

---

## Environment Variables

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
POLLINATION_API_KEY=       # Optional, free tier works without it
VOICE_CHAT_URL=https://text.pollinations.ai/openai
VOICE_TTS_URL=https://text.pollinations.ai/
VOICE_STT_URL=https://toolkit.rork.com/stt/transcribe/
APP_ENV=development
```

Read via `src/config/Config.ts` → `expo-constants extra` → `process.env` → fallback defaults.

---

## Common Commands

```bash
npm start          # Start Expo dev server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Run on web (browser)
npm test           # Run Jest tests
npx tsc --noEmit        # Type-check without emitting files
npx jest <filename>     # Run a single test file by name (e.g., npx jest voiceActions)
```

---

## Known Issues

See `docs/GRILLME.md` for the full technical audit. Top P0 blockers:

- **No server-side price validation** — client-computed totals are trusted by `create_order` RPC
- **Demo credentials (`quickLogin`) not gated by `APP_ENV`** — admin accessible in production binary
- **No order idempotency key** — double-tap or voice `confirm_order` can create duplicate orders

---

## Coding Conventions

- **TypeScript strict mode** — no `any` abuse, proper interfaces for all models
- **Zustand stores:** interface-first, computed values as `() => T` functions
- **Services:** singleton pattern, DI-ready constructors
- **Screens:** functional components with hooks, StyleSheet at bottom of file (existing) or NativeWind className (new components)
- **Imports:** relative paths (e.g., `../../state/CartStore`)
- **Colors:** use `colors` from `src/theme/theme.ts`, primary accent is `#FF6B00`
- **Icons:** Ionicons from `@expo/vector-icons`, not Lucide (despite package.json listing it)
- **Animations:** React Native `Animated` API (no Reanimated)
- **Navigation:** `useRouter()` from expo-router, `router.push()` / `router.replace()`
- **Safe area:** `useSafeAreaInsets()` from react-native-safe-area-context
- **No comments unless they mark sections** (e.g., `/* ── Header ── */`)

---

## AI Assistant Protocol

**Read `docs/GRILLME.md`, `docs/HANDOFF.md`, and `docs/PRD.md` at the start of every session**

1. **Ask the developer Phase 0 questions before doing any work** — what is the goal, any constraints, anything not in the docs
2. **Spec before code, always. No exceptions**
3. **One item at a time. Report after each one. Wait for "continue"**
4. **Maximum two to three items per session before pausing for developer confirmation**
5. **Small careful steps. This is a production codebase**
6. **Never implement multiple items in the same code-writing session.** One item means one item — write the code, stop, report exactly what files changed and what was done, then wait for "continue." If you feel the urge to do the next item while you're already in the code, resist it. Batching is not efficiency, it is a loss of control. This rule has no exceptions.

---

## Hard Rules

- Never use Lucide icons — all icons must use Ionicons from `@expo/vector-icons`
- Never use Reanimated — use React Native's built-in `Animated` API only
- Never write Supabase queries directly in screen components — always go through a service
- **Existing files:** Never add inline styles — use `StyleSheet.create()` at the bottom of the file
- **New components:** Use NativeWind `className` props. Theme tokens are mapped in `tailwind.config.ts`
- Never commit `.env` values or hardcode credentials
- Never modify SQL files that have already been applied to production — add new ones instead

---

## File Naming

- Screens: `PascalCase` (e.g., `CustomerHomeScreen.tsx`)
- Stores: `PascalCase` (e.g., `CartStore.ts`)
- Services: `PascalCase` (e.g., `OrderService.ts`)
- Models: `PascalCase` (e.g., `MenuItem.ts`)
- Router pages: `kebab-case` (e.g., `menu-item/[itemId].tsx`)
- Components: `PascalCase` (e.g., `FavoriteButton.tsx`)

---

## When Making Changes

1. **New screen?** Create in `src/screens/{Role}/`, add route file in `app/{role}/`
2. **New store?** Create in `src/state/`, follow Zustand interface-first pattern
3. **New service?** Create in `src/services/`, export singleton instance
4. **New model?** Create in `src/models/`, add DB counterpart in `SupabaseModels.ts` if needed
5. **New component?** Create in `src/components/`
6. **Database change?** Add SQL to `supabase/`, update `SupabaseModels.ts`
7. **New route?** Add to appropriate `_layout.tsx` if it should appear in tabs or be hidden

---

## Reference Documents

- `docs/PRD.md` — Full product requirements and feature status
- `docs/GRILLME.md` — Technical audit with critical issues and recommendations
- `ARCHITECTURE_PARITY.md` — Swift-to-RN conversion parity comparison
- `AUTH_FIX_GUIDE.md` — Authentication setup troubleshooting
- `README.md` — Setup instructions and project overview
