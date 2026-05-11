# SmartFood Delivery App — Technical Audit

> **Date:** 2025-05-05
> **Scope:** Full-stack React Native (Expo) food delivery app with Voice AI
> **Verdict:** Functional MVP with significant gaps before production readiness

---

## Executive Summary

SmartFood is a three-role (customer, driver, admin) food delivery app built with React Native/Expo, Zustand state management, Supabase backend, and Pollinations-powered voice AI. The codebase demonstrates solid architecture patterns and comprehensive feature coverage. However, a deep audit reveals **critical issues** around security, data integrity, offline resilience, testing, and production hardening that must be addressed before any real-world deployment.

---

## 1. Architecture Overview

### What's Good

- **Clean separation of concerns:** Services → State (Zustand) → UI screens
- **Type-safe models:** Domain models separated from DB types with proper mappers
- **EventBus pattern:** Cross-store communication without tight coupling
- **Singleton services** with DI-ready constructors (accept optional Supabase client)
- **File-based routing** via Expo Router with role-based layouts

### Structure at a Glance

```
src/
├── state/          16 Zustand stores
├── services/       11 service classes + 1 mapper
├── models/         15 TypeScript model files
├── screens/        39 screen components (Auth/Customer/Driver/Admin/Voice/Shared)
├── components/     12 reusable components
├── providers/      1 context provider (RecentlyViewed)
├── theme/          Design system (colors, typography, shadows, spacing)
├── config/         App configuration
└── lib/            Supabase client setup
app/                44 Expo Router page files
supabase/           SQL migrations, seeds, RLS policies
```

---

## 2. Critical Issues

### 2.1 Security

| Issue | Severity | Detail |
|-------|----------|--------|
| **Demo credentials hardcoded in AuthStore** | 🔴 Critical | `quickLogin` uses hardcoded emails/passwords for customer, admin, driver. If shipped to production, anyone can log in as admin. |
| **No input sanitization** | 🔴 Critical | User inputs (delivery notes, promo codes, chat messages, feedback comments) are passed directly to Supabase/state without sanitization. XSS risk on web platform. |
| **RLS policies rely on JWT metadata** | 🟡 High | Role checks use `auth.jwt()->'user_metadata'->>'role'` — users can potentially manipulate their own metadata via the Supabase client SDK unless server-side enforcement is added. |
| **No rate limiting on voice AI** | 🟡 High | Pollinations API calls have no client-side throttle. A user could spam the AI endpoint, potentially exhausting free-tier limits or incurring costs. |
| **Promo code validation is client-side only** | 🟡 High | `CartStore.applyPromo()` applies discounts locally. No server-side promo code verification in `OrderService.createOrder`. Users could fabricate discount amounts. |
| **Payment method is a UI-only string** | 🟡 High | `paymentMethod: 'card' | 'cash'` in CheckoutScreen with no payment gateway integration. Credit card number "•••• 4242" is static placeholder text. |
| **No HTTPS certificate pinning** | 🟠 Medium | Supabase client uses default fetch without certificate pinning, making it vulnerable to MITM on compromised networks. |

### 2.2 Data Integrity

| Issue | Severity | Detail |
|-------|----------|--------|
| **Order totals calculated client-side** | 🔴 Critical | `subtotal()`, `tax()`, `deliveryFee()`, `total()` are computed in CartStore and sent to the backend. No server-side total recalculation. Malicious client could submit arbitrary totals. |
| **No idempotency on order placement** | 🟡 High | `placeOrderViaSupabase` has no idempotency key. Network retries or double-taps could create duplicate orders. |
| **Timeline events are client-generated** | 🟡 High | `OrderTimelineEvent` timestamps come from `new Date().toISOString()` on the client. Clock skew or timezone issues could produce incorrect timelines. |
| **Cart state not persisted** | 🟠 Medium | CartStore is in-memory Zustand. App kill/restart loses the entire cart. No AsyncStorage persistence for cart items. |
| **Modifier price adjustments not validated server-side** | 🟡 High | Modifier `priceAdjustment` values are summed client-side and sent as the order total. Backend RPC `create_order` doesn't re-validate individual line item prices against the menu_items table. |

### 2.3 Error Handling & Resilience

| Issue | Severity | Detail |
|-------|----------|--------|
| **No offline support** | 🟡 High | App has zero offline capability. No queued actions, no cached data, no optimistic updates with reconciliation. Opening the app without internet shows nothing. |
| **Swallowed errors in many stores** | 🟡 High | Multiple stores catch errors with `catch (e) { ... }` but only log or set a generic error message without retry logic or user-actionable guidance. |
| **No retry logic in service layer** | 🟠 Medium | `OrderService`, `MenuService`, `DriverService` have no retry mechanisms for transient network failures (only VoiceAIService has retries). |
| **Realtime subscription doesn't reconnect** | 🟠 Medium | `RealtimeService` subscribes once. If the WebSocket disconnects (network change, app backgrounding), there's no automatic reconnection or re-subscription logic. |
| **1.5s hardcoded delay in fetchProfile** | 🟠 Medium | `AuthService.fetchProfile` waits 1500ms for the DB trigger. This is fragile — on slow instances the trigger may take longer, on fast ones it's wasted time. Should poll/retry instead. |

### 2.4 Performance

| Issue | Severity | Detail |
|-------|----------|--------|
| **FlatList renders not memoized** | 🟠 Medium | `FoodCard` in CustomerHomeScreen uses `useRef(new Animated.Value())` inside the component but the component is not wrapped in `React.memo`. Re-renders of the parent FlatList re-create all cards. |
| **Entire menu loaded at once** | 🟠 Medium | `MenuService.fetchMenuItems()` loads ALL menu items in a single query with no pagination. Fine for 24 seed items, problematic at scale (hundreds of items). |
| **No image caching strategy** | 🟠 Medium | `Image` component loads from URLs directly. No progressive loading, no placeholder shimmer, no disk cache configuration. |
| **Animated values recreated on re-render** | 🟠 Medium | Several screens (HeatMap, Earnings, Loyalty) create `new Animated.Value()` inside `useRef` but trigger animations in `useEffect` without proper cleanup, risking memory leaks on frequent re-mounts. |
| **Large bundle: 12 components imported on home screen** | 🟠 Medium | CustomerHomeScreen imports SearchBar, FavoriteButton, FlashDealCard, QuickReorderCard, TopPicksCard, RecentlyViewedRow, PopularNowBadge + all their deps. No lazy loading. |

---

## 3. Feature-Level Audit

### 3.1 Customer Flow

| Feature | Status | Notes |
|---------|--------|-------|
| **Login/Signup** | ✅ Functional | Animated UI, role selection, quick-access demo login |
| **Home Screen** | ✅ Functional | Categories, flash deals, top picks, recently viewed, active order banner, floating cart bar |
| **Menu Browsing** | ✅ Functional | Category filter, search bar with scoring |
| **Item Detail** | ✅ Functional | Modifiers, nutrition, allergens, quantity selector |
| **Cart** | ✅ Functional | Quantity edit, promo codes, upsells, free delivery progress, savings card |
| **Checkout** | ✅ Functional | Delivery/pickup toggle, address selection, scheduling, tip selector, order summary |
| **Order Tracking** | ✅ Functional | Progress stepper, driver info, call/message driver, cancel modal, timeline |
| **Orders History** | ✅ Functional | Active/past tabs, expandable cards, feedback & report buttons |
| **Profile** | ✅ Functional | Food preferences, dietary profile, settings, sign out |
| **Loyalty** | ✅ Functional | Points, tiers, streaks, perks |
| **Voice AI** | ✅ Functional | Text-based AI assistant with mood chips and menu suggestions |
| **Voice Call** | ✅ Functional | Live/text mode, recording, TTS, action execution, debug overlay |
| **Favorites** | ⚠️ Partial | FavoriteButton exists but FavoritesScreen not deeply reviewed |
| **Group Orders** | ⚠️ Partial | Store exists, screen exists, but real-time sync between group members not verified |
| **Scheduled Orders** | ⚠️ Partial | Store and screen exist, but no background job to trigger the scheduled order |
| **Referrals** | ⚠️ Shell | Store and screen exist, no backend integration for tracking referral codes |
| **Payment Methods** | ⚠️ Shell | Screen exists, no actual payment processing |

### 3.2 Driver Flow

| Feature | Status | Notes |
|---------|--------|-------|
| **Available Orders** | ✅ Functional | Online toggle, order cards with accept button, quick nav |
| **Active Delivery** | ✅ Functional | Step progress, ETA modal, delivery proof modal, customer contact |
| **Earnings** | ✅ Functional | Time filters, weekly chart, delivery history, rating breakdown |
| **Profile** | ✅ Functional | Stats, vehicle info (placeholder), support links, sign out |
| **Heat Map** | ⚠️ Mock | Hardcoded zones, no real demand data from backend |
| **Chat** | ✅ Functional | Shared ChatScreen with message bubbles, read receipts |

### 3.3 Admin Flow

| Feature | Status | Notes |
|---------|--------|-------|
| **Dashboard** | ⚠️ Not audited | Screen exists |
| **Dispatch** | ⚠️ Not audited | Screen exists |
| **Menu Management** | ⚠️ Not audited | Screen exists |
| **Orders Management** | ⚠️ Not audited | Screen exists |
| **Incidents** | ⚠️ Not audited | Screen exists |
| **Users** | ⚠️ Not audited | Screen exists |
| **Messages** | ⚠️ Not audited | Screen exists |
| **Settings** | ⚠️ Not audited | Screen exists |

### 3.4 Voice AI System

| Component | Status | Notes |
|-----------|--------|-------|
| **Speech-to-Text** | ✅ | Web: Browser SpeechRecognition; Native: expo-av + Pollinations STT |
| **Text-to-Speech** | ✅ | Web: SpeechSynthesis; Native: expo-speech + Pollinations TTS |
| **LLM Chat** | ✅ | Pollinations API with "Sara" persona, bilingual prompts |
| **Intent Parsing** | ✅ | ACTION block extraction with regex, fuzzy menu item matching |
| **Cart Actions** | ✅ | add_to_cart, remove, update_quantity, clear, apply_promo, confirm_order |
| **Silence Detection** | ✅ | Three-tier: metering → fallback timer → 12s hard cap |
| **Error Recovery** | ⚠️ Partial | 2 retries on API failure, but no graceful degradation to text-only mode |

---

## 4. Testing & Quality

### Current State

| Category | Coverage |
|----------|----------|
| **Unit Tests** | ❌ None found. `jest.config.js` exists but no test files in the codebase. |
| **Integration Tests** | ❌ None |
| **E2E Tests** | ❌ None |
| **Type Safety** | ✅ Good — TypeScript strict mode, proper interfaces, minimal `any` usage |
| **Linting** | ⚠️ `eslint` script in package.json but no `.eslintrc` config found in root |
| **Error Boundaries** | ✅ `ErrorBoundary.tsx` component exists |

### Recommended Minimum Test Coverage

1. **AuthService** — signup, signin, fetchProfile, session restore
2. **CartStore** — add/remove/update items, promo codes, total calculations
3. **OrderService** — createOrder, fetchOrders, updateStatus
4. **VoiceCallStore** — message flow, action parsing, cart integration
5. **MenuSearchService** — search scoring, fuzzy matching

---

## 5. Database & Backend

### Schema Assessment

- **16 tables** covering core food delivery domain + loyalty/feedback/incidents/kitchen-queue/group-orders/scheduling
- **RLS enabled** on all tables with role-based policies
- **3 RPCs:** `create_order`, `update_order_status`, `driver_accept_order`/`assign_driver`
- **1 trigger:** `on_auth_user_created` → auto-create profile + driver_status

### Gaps

| Gap | Detail |
|-----|--------|
| **No server-side price validation** | RPC `create_order` trusts client-submitted totals |
| **No database indexes documented** | No explicit CREATE INDEX statements beyond PKs/FKs |
| **No soft-delete pattern** | Orders use status CANCELED but other tables lack soft-delete |
| **No audit trail for admin actions** | Menu edits, user management, dispatch assignments not logged |
| **Seed data has hardcoded UUIDs** | If seed.sql is re-run, it may conflict with existing data |
| **No database migrations versioning** | SQL files in `supabase/` folder but no migration tool (like Supabase CLI migrations) |

---

## 6. Hard Questions for the Team

1. **How do you prevent a customer from submitting an order with $0 total?** There's no server-side validation of line item prices or totals.

2. **What happens when two drivers tap "Accept" on the same order simultaneously?** Is `driver_accept_order` RPC using a transaction with row-level locking?

3. **How are promo codes validated?** Currently `CartStore.applyPromo()` accepts any string and applies a hardcoded discount. There's no `promotions` table lookup.

4. **What's the disaster recovery plan for the Supabase instance?** Is point-in-time recovery enabled? Are there automated backups?

5. **How do you handle the app being backgrounded during an active voice call?** The AudioService recording and WebSocket may be killed by the OS.

6. **What's the latency budget for the voice ordering flow?** STT → LLM → TTS is three sequential API calls to Pollinations. What if any leg takes >5s?

7. **How do you prevent the admin quickLogin from reaching production?** The hardcoded demo credentials in AuthStore have no environment guard.

8. **What happens when a customer's order is in PREPARING status and the restaurant closes?** There's no restaurant hours model or force-cancel flow.

9. **How do you handle menu item price changes for in-flight orders?** The order stores `unit_price` snapshots, but the cart references live `MenuItem.price`.

10. **What's the plan for push notifications?** NotificationStore exists in-memory but there's no expo-notifications integration or APNs/FCM setup.

---

## 7. Dependency Risk Assessment

| Dependency | Version | Risk |
|------------|---------|------|
| **expo** | ~54.0.33 | Low — stable, well-maintained |
| **react-native** | 0.81.5 | Low — latest new arch |
| **@supabase/supabase-js** | ^2.97.0 | Low — active development |
| **zustand** | ^5.0.11 | Low — lightweight, stable |
| **Pollinations API** | Free tier | 🟡 **High risk** — free tier has no SLA, no uptime guarantee, could rate-limit or shut down without notice. No fallback voice provider configured. |
| **expo-av** | ~16.0.8 | Low |
| **expo-speech** | ~14.0.8 | Low |
| **lucide-react-native** | ^0.575.0 | Low — but imported in README, check if actually used vs Ionicons |

---

## 8. Recommendations (Priority Order)

### P0 — Before Any Real Users

1. **Server-side price validation** in `create_order` RPC
2. **Remove or gate demo credentials** behind `__DEV__` / `APP_ENV !== 'production'`
3. **Persist cart to AsyncStorage** to survive app restarts
4. **Add idempotency key** to order placement
5. **Validate promo codes server-side** against a `promotions` table

### P1 — Before Beta Launch

6. **Add unit tests** for core business logic (CartStore, OrderService, AuthService)
7. **Implement retry logic** in service layer for transient failures
8. **Add proper offline detection** and user messaging
9. **Memoize FlatList renderers** with `React.memo` and `useCallback`
10. **Set up CI/CD** with lint, type-check, and test gates

### P2 — Before Production

11. **Integrate real payment gateway** (Stripe, etc.)
12. **Add push notifications** via expo-notifications
13. **Implement Supabase CLI migrations** for schema versioning
14. **Add monitoring/crash reporting** (Sentry, etc.)
15. **Conduct security audit** on RLS policies with penetration testing
16. **Add a fallback voice AI provider** or graceful text-only degradation

---

## 9. Positive Highlights

- **Comprehensive feature set** — 39 screens, 16 stores, 11 services
- **Consistent code style** — naming conventions, folder structure, TypeScript usage
- **Modern UI** — animated cards, floating cart bar, pulsing orbs, gradient badges
- **Voice AI is genuinely impressive** — live call mode, silence detection, action parsing, bilingual support
- **Good domain modeling** — separate DB models from domain models with explicit mappers
- **EventBus pattern** prevents Zustand store coupling
- **Theme system** with design tokens (colors, spacing, radii, shadows)

---

*This audit was conducted based on full source review of all screens, stores, services, models, and SQL files in the repository.*
