# PRD — SmartFood Delivery App

> **Version:** 1.0.0 | **Status:** MVP — Pre-Launch
> **Last Updated:** 2025-05-11 — update this file whenever a P0 or P1 item from GRILLME.md is resolved

---

## 1. Product Description

SmartFood is a voice-first AI-powered food delivery platform built with React Native (Expo). Customers order via natural voice conversation with "Sara," a bilingual (EN/AR) AI assistant, or through a standard touch UI. Drivers manage deliveries. Admins control menu, orders, and operations. Backend is Supabase (PostgreSQL, Auth, Realtime); voice AI is powered by Pollinations API.

---

## 2. Features — Implemented

### 2.1 Authentication (All Roles)

| Feature | Files |
|---------|-------|
| Email/password signup with role selection | `src/services/AuthService.ts` → `signUp()`, `src/screens/Auth/LoginScreen.tsx` |
| Email/password login | `AuthService.signIn()`, auto-session restore via `AuthStore.initialize()` |
| Role-based redirect on login | `app/index.tsx` → redirects to `/customer/home`, `/admin/dashboard`, `/driver/available` |
| Quick-access demo login (dev) | `src/state/AuthStore.ts` → `quickLogin()` — hardcoded emails `sarah@demo.com`, `alex@demo.com`, `james@demo.com` |
| Sign out | `AuthStore.signOut()` → clears AsyncStorage + Supabase session |
| Session persistence | `AsyncStorage` via `@supabase/supabase-js` auth storage adapter |

### 2.2 Customer — Menu & Browsing

| Feature | Files |
|---------|-------|
| Home screen with category grid, flash deals, top picks | `src/screens/Customer/CustomerHomeScreen.tsx` |
| Search bar with scored keyword matching | `src/components/SearchBar.tsx`, `src/services/MenuSearchService.ts` → `search()` |
| Menu item detail (modifiers, allergens, nutrition) | `src/screens/Customer/MenuItemDetailScreen.tsx` |
| Category browsing | `src/screens/Customer/CategoriesScreen.tsx`, `app/customer/categories.tsx` |
| Recently viewed items | `src/providers/RecentlyViewedProvider.tsx`, `src/components/RecentlyViewedRow.tsx` |
| Flash deals with countdown timers | `src/components/FlashDealCard.tsx`, `src/mocks/deals.ts` → `buildFlashDeals()` ⚠️ mock data only — no real promotions backend |
| Favorites | `src/state/FavoritesStore.ts`, `src/screens/Customer/FavoritesScreen.tsx`, `src/components/FavoriteButton.tsx` |
| Dietary profile | `src/screens/Customer/DietaryProfileScreen.tsx` |

### 2.3 Customer — Cart & Checkout

| Feature | Files |
|---------|-------|
| Cart with quantity, modifiers, special instructions | `src/state/CartStore.ts` → `addItem()`, `removeItem()`, `updateQuantity()` |
| Cart screen | `src/screens/Customer/CartScreen.tsx` |
| Promo codes (client-side only) | `CartStore.applyPromo()` — hardcoded `SAVE10`, `FIRST20`, `FREE` codes |
| Upsell suggestions | `src/state/UpsellStore.ts`, `src/components/UpsellRow.tsx` |
| Free delivery progress bar ($30 threshold) | `src/components/FreeDeliveryProgress.tsx` |
| Checkout with address, tip, delivery/pickup toggle | `src/screens/Customer/CheckoutScreen.tsx` |
| Order placement via Supabase RPC | `src/state/DataStore.ts` → `placeOrderViaSupabase()` → `OrderService.createOrder()` |
| Computed totals (subtotal, tax 8.875%, delivery fee $3.99, tip) | `CartStore.subtotal()`, `.tax()`, `.deliveryFee()`, `.tipAmount()`, `.total()` |

### 2.4 Customer — Orders & Tracking

| Feature | Files |
|---------|-------|
| Orders list (Active / Past tabs) | `src/screens/Customer/OrdersScreen.tsx` |
| Order tracking with progress stepper | `src/screens/Customer/OrderTrackingScreen.tsx` |
| Cancel order (PLACED/ACCEPTED only) | `OrderTrackingScreen` → `DataStore.updateOrderStatus('CANCELED')` |
| Reorder from past order | `src/screens/Customer/SmartReorderScreen.tsx`, `src/state/SmartReorderStore.ts` |
| Feedback (food + driver rating) | `src/screens/Customer/FeedbackScreen.tsx`, `src/state/FeedbackStore.ts` |
| Report issue | `src/screens/Customer/ReportIssueScreen.tsx` |
| Kitchen queue position | `src/screens/Customer/KitchenQueueScreen.tsx`, `src/state/KitchenQueueStore.ts` |

### 2.5 Customer — Voice AI

| Feature | Files |
|---------|-------|
| Text-based AI assistant | `src/screens/Voice/VoiceAIScreen.tsx`, `src/services/AIClient.ts` |
| Voice call mode (live STT → LLM → TTS loop) | `src/screens/Voice/VoiceCallScreen.tsx`, `src/state/VoiceCallStore.ts` |
| Speech-to-Text (Web: SpeechRecognition, Native: Pollinations) | `src/services/AudioService.ts` → `startRecording()`, `stopRecordingAndTranscribe()` |
| Text-to-Speech (Web: SpeechSynthesis, Native: expo-speech) | `AudioService.playTTS()` → `speakWithExpoSpeech()` |
| Action parsing from AI response | `VoiceCallStore` — regex `|||ACTION:{...}|||` extraction |
| 11 action types | `src/models/VoiceActions.ts` — `add_to_cart`, `remove_from_cart`, `update_quantity`, `set_item_note`, `clear_cart`, `view_cart`, `apply_promo`, `set_delivery_notes`, `confirm_order`, `set_address`, `none` |
| Fuzzy menu item matching | `VoiceActions.ts` → `fuzzyMatchItemName()` (exact → substring → Levenshtein ≤30%) |
| Silence detection (3-tier) | `AudioService` — metering → fallback timer (5s) → hard cap (12s) |
| Bilingual (EN/AR) with auto-detection | `VoiceCallStore` — Arabic regex detection, language hint to STT/TTS |
| Food memory context injection | `src/services/FoodMemoryService.ts` → `contextString()` injected into LLM prompt |
| Sara persona (warm, ultra-short responses) | `VoiceAIService.chat()` — system prompt with 15 conversation workflow rules |

### 2.6 Driver

| Feature | Files |
|---------|-------|
| Online/offline toggle | `src/services/DriverService.ts` → `setOnlineStatus()` |
| Available orders with accept | `src/screens/Driver/DriverAvailableScreen.tsx` |
| Active delivery progress + ETA updates | `src/screens/Driver/DriverActiveScreen.tsx` |
| Earnings dashboard + weekly chart | `src/screens/Driver/DriverEarningsScreen.tsx` |
| Driver profile | `src/screens/Driver/DriverProfileScreen.tsx` |
| Demand heat map (mock data) | `src/screens/Driver/DriverHeatMapScreen.tsx` |
| Chat with customer | `src/screens/Shared/ChatScreen.tsx`, `app/driver/chat.tsx` |

### 2.7 Admin

| Feature | Files |
|---------|-------|
| Dashboard | `src/screens/Admin/AdminDashboardScreen.tsx`, `app/admin/dashboard.tsx` |
| Orders management | `src/screens/Admin/AdminOrdersScreen.tsx` |
| Menu management | `src/screens/Admin/AdminMenuScreen.tsx` |
| Dispatch / driver assignment | `src/screens/Admin/AdminDispatchScreen.tsx` |
| User management | `src/screens/Admin/AdminUsersScreen.tsx` |
| Incident management | `src/screens/Admin/AdminIncidentsScreen.tsx` |
| Messaging | `src/screens/Admin/AdminMessagesScreen.tsx` |
| Settings | `src/screens/Admin/AdminSettingsScreen.tsx` |

### 2.8 Cross-Cutting

| Feature | Files |
|---------|-------|
| Order-specific chat (customer↔driver) | `src/screens/Shared/ChatScreen.tsx`, `src/state/MessageStore.ts` |
| Real-time order updates | `src/services/RealtimeService.ts` — Supabase Realtime channels |
| EventBus (cross-store) | `src/state/EventBus.ts` — `orderPlaced`, `orderStatusChanged`, `driverAssigned`, `cartUpdated` |
| Error boundary | `src/components/ErrorBoundary.tsx` |
| Theme system | `src/theme/theme.ts` — colors, spacing, radii, shadows, typography |
| Loyalty program | `src/state/LoyaltyStore.ts`, `src/models/Loyalty.ts`, `src/screens/Customer/LoyaltyScreen.tsx` |
| Referral program | `src/state/ReferralStore.ts`, `src/screens/Customer/ReferralScreen.tsx` |
| Group ordering | `src/state/GroupOrderStore.ts`, `src/screens/Customer/GroupOrderScreen.tsx` ⚠️ real-time sync between members not verified |
| Scheduled orders | `src/state/ScheduleOrderStore.ts`, `src/screens/Customer/ScheduleOrderScreen.tsx` |
| Notifications | `src/state/NotificationStore.ts`, `src/screens/Customer/NotificationsScreen.tsx` |

---

## 3. Data Models

### AppUser (`src/models/AppUser.ts`)
`id`, `name`, `email`, `phone`, `role` (customer|admin|driver), `avatarUrl`, `address` (DeliveryAddress | null), `foodMemory` (FoodMemory), `createdAt`

### MenuItem (`src/models/MenuItem.ts`)
`id`, `name`, `description`, `price`, `imageUrl`, `category`, `tags[]`, `calories`, `prepTimeMinutes`, `rating`, `reviewCount`, `isAvailable`, `isLimitedTime`, `limitedTimeEnd`, `modifierGroups[]` (ModifierGroup → ModifierOption[]), `nutritionInfo` (calories, protein, carbs, fat, fiber, sugar), `ingredients[]`, `allergens[]`

### Order (`src/models/Order.ts`)
`id`, `customerId`, `customerName`, `items[]` (CartItem[]), `status` (OrderStatus: PLACED|ACCEPTED|PREPARING|READY|PICKED_UP|ON_THE_WAY|DELIVERED|CANCELED), `timeline[]` (OrderTimelineEvent), `subtotal`, `tax`, `deliveryFee`, `tip`, `total`, `deliveryAddress`, `deliveryNotes`, `promoCode`, `promoDiscount`, `assignedDriverId`, `driverName`, `createdAt`

### CartItem (`src/models/Cart.ts`)
`id`, `menuItem` (MenuItem), `quantity`, `selectedModifiers` (Record<string, string[]>), `specialInstructions`

### FoodMemory (`src/models/FoodMemory.ts`)
`dietaryRestrictions[]`, `dislikedIngredients[]`, `spiceLevel` (none|mild|medium|hot|extraHot), `defaultDrink`, `commonNotes`, `preferredCuisines[]`

### VoiceAction (`src/models/VoiceActions.ts`)
Discriminated union: `add_to_cart` | `remove_from_cart` | `update_quantity` | `set_item_note` | `clear_cart` | `view_cart` | `apply_promo` | `set_delivery_notes` | `confirm_order` | `set_address` | `none`

### DB Models (`src/models/SupabaseModels.ts`)
`DBProfile`, `DBCategory`, `DBMenuItem`, `DBModifierGroup`, `DBModifierOption`, `DBItemModifierGroup`, `DBOrder`, `DBOrderLine`, `DBOrderStatusEvent`, `DBDriverStatus`, `DBAddress`, `AddressSnapshotJSON`, `NutritionInfoJSON`, `FoodMemoryJSON`, `CreateOrderItemJSON`, `CreateOrderModifierJSON`

---

## 4. API Surface

### Supabase Tables (queried via `.from()`)
- **profiles** — CRUD for user profiles (RLS: own row)
- **categories** — read all (public)
- **menu_items** — read all with joins to modifier_groups/options
- **modifier_groups**, **modifier_options**, **item_modifier_groups** — read via menu_items join
- **orders** — read (filtered by user_id or role), realtime subscription
- **order_lines** — created via `create_order` RPC
- **order_status_events** — read for timeline, realtime INSERT subscription
- **driver_status** — read/update online status (drivers only)
- **addresses** — CRUD user addresses
- **loyalty_profiles**, **order_feedback**, **order_incidents**, **scheduled_orders**, **group_orders**, **group_order_members**, **kitchen_queue** — extended feature tables

### Supabase RPCs
- `create_order(p_user_id, p_customer_name, p_items, p_address, p_notes, p_promo_code, p_subtotal, p_delivery_fee, p_tax, p_discount, p_tip, p_total, p_payment_method, p_delivery_method)` → returns order UUID
  - Note: `p_payment_method` is a string (`'card'|'cash'`) only — no payment gateway is integrated
- `update_order_status(p_order_id, p_new_status, p_note, p_changed_by, p_changed_by_role)` → void
- `assign_driver(p_order_id, p_driver_id)` → void
- `driver_accept_order(p_order_id, p_driver_id, p_driver_name)` → void

### External APIs
- **Pollinations Chat** — `POST https://text.pollinations.ai/openai` (OpenAI-compatible chat completions)
- **Pollinations STT** — `POST {VOICE_STT_URL}` with audio blob for transcription
- **Pollinations TTS** — `GET https://text.pollinations.ai/audio/{text}?voice=nova` (native), browser SpeechSynthesis (web)

---

## 5. User Flows

### Customer Order Flow (Touch)
```
Login → Home → Browse/Search → Item Detail → Add to Cart → Cart → Checkout → Place Order → Track Order → Rate/Report
```
`LoginScreen` → `AuthStore.signIn()` → `app/index.tsx` redirect → `CustomerHomeScreen` → `MenuItemDetailScreen` → `CartStore.addItem()` → `CartScreen` → `CheckoutScreen` → `DataStore.placeOrderViaSupabase()` → `OrderTrackingScreen`

### Customer Order Flow (Voice)
```
Home → Voice Call → Speak → STT → AI Response → Parse Action → Execute (add to cart) → TTS → Loop → Confirm Order
```
`CustomerHomeScreen` quick action → `VoiceCallScreen` → `VoiceCallStore.startCall()` → `AudioService.startRecording()` → silence → `stopRecordingAndTranscribe()` → `VoiceAIService.chat()` → parse `|||ACTION:{...}|||` → `executeAction()` → `CartStore` mutation → `AudioService.playTTS()` → auto-listen loop

### Driver Delivery Flow
```
Login → Available Orders → Accept → Active Delivery → Update Status → Mark Delivered
```
`DriverAvailableScreen` → `OrderService.driverAcceptOrder()` → `DriverActiveScreen` → status updates via `DataStore.updateOrderStatus()` → `DELIVERED`

### Admin Flow
```
Login → Dashboard → Orders/Menu/Dispatch/Users/Incidents/Settings
```
Tab navigation: `AdminDashboardScreen` → `AdminOrdersScreen` (manage orders) → `AdminDispatchScreen` (assign drivers) → `AdminMenuScreen` (edit items)

---

## 6. External Integrations

| Integration | Usage | Config |
|------------|-------|--------|
| **Supabase** | Auth, PostgreSQL, Realtime, Storage | `SUPABASE_URL`, `SUPABASE_ANON_KEY` in `.env` → `src/config/Config.ts` |
| **Pollinations API** | LLM chat completions, Speech-to-Text | `VOICE_CHAT_URL`, `VOICE_STT_URL` in `.env`; free tier, no API key required |
| **Browser SpeechRecognition** | STT on web platform | Built-in Web API, no config |
| **Browser SpeechSynthesis** | TTS on web platform (via expo-speech) | Built-in Web API, no config |
| **expo-speech** | TTS on native platforms | Bundled with Expo |
| **expo-av** | Audio recording on native platforms | Bundled with Expo |
| **AsyncStorage** | Local persistence (auth session, food memory, loyalty) | `@react-native-async-storage/async-storage` |

---

## 7. Incomplete / Stubbed Features

| Feature | Status | Detail |
|---------|--------|--------|
| **Forgot password / reset flow** | Not built | No `resetPasswordForEmail()` call in `AuthService` |
| **Social login (Google, Apple)** | Not built | No OAuth providers configured |
| **Payment gateway** | UI shell only | `paymentMethod` is a string (`'card'|'cash'`); no Stripe/payment SDK |
| **Cart persistence** | Not built | `CartStore` is in-memory Zustand; no AsyncStorage save/restore |
| **Push notifications** | Not built | `NotificationStore` is in-memory; no `expo-notifications` integration |
| **Referral backend** | UI shell only | `ReferralStore` stores locally; no backend referral code tracking |
| **Scheduled order execution** | UI only | `ScheduleOrderStore` saves schedule; no background job triggers orders |
| **Group order realtime sync** | Partial | `GroupOrderStore` exists; real-time sync between members not verified |
| **Driver heat map** | Mock data | `DriverHeatMapScreen` renders hardcoded zones; no real demand data |
| **Offline mode** | Not built | Zero caching, no queued actions, no optimistic updates |
| **Voice AI text-only fallback** | Partial | If voice APIs fail, error is shown but no automatic switch to text-only mode |
| **Admin screens deep functionality** | Screens exist | Screens render but detailed CRUD operations not fully audited |
| **Real-time demand data** | Not built | Heat map and Popular Now use mock data |
| **Database migration tooling** | Not built | SQL files exist in `supabase/` but no Supabase CLI migration versioning |
| **Popular Now / demand data** | Mock only | `src/mocks/deals.ts` — hardcoded items, no real analytics or popularity tracking backend |
| **Chat message persistence** | Unverified | `MessageStore.ts` / `ChatScreen.tsx` — unclear if messages persist to Supabase or are in-memory only; needs audit |

---

## 8. Assumptions & Constraints

### Assumptions
1. Single restaurant model (not a marketplace)
2. Delivery area is geographically limited
3. Pollinations API free tier remains available for MVP
4. Menu is admin-managed, not self-serve by restaurants
5. USD only, no multi-currency support

### Constraints
1. **No payment processing** — Stripe/gateway required before charging real money
2. **Voice AI has no SLA** — Pollinations free tier can rate-limit or go down
3. **No push notifications** — Updates only visible while app is open
4. **English-only UI** — Voice AI supports Arabic, but UI text is English only
5. **No CI/CD pipeline** — No automated lint, type-check, or test gates
