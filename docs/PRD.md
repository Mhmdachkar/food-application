# SmartFood Delivery App — Product Requirements Document (PRD)

> **Product Name:** SmartFood
> **Version:** 1.0.0
> **Last Updated:** 2025-05-05
> **Status:** MVP — Pre-Launch

---

## 1. Product Vision

SmartFood is an AI-powered food delivery platform that lets customers order via natural voice conversation, track deliveries in real time, and enjoy personalized food recommendations — while giving drivers and restaurant admins the tools they need to fulfill orders efficiently.

### Core Differentiator

**Voice-first ordering:** Customers can speak naturally to "Sara," a bilingual AI assistant, to browse the menu, get food suggestions based on mood, add items to cart, and complete orders — all hands-free.

---

## 2. Target Users

### 2.1 Customer

- **Primary persona:** Urban professional (25–40) ordering food delivery 3–5× per week
- **Key needs:** Speed, convenience, personalized recommendations, dietary safety
- **Voice AI user:** Wants a faster, hands-free ordering experience (driving, cooking, multitasking)

### 2.2 Driver

- **Primary persona:** Gig worker managing multiple deliveries
- **Key needs:** Clear order queue, navigation, earnings visibility, demand heat maps

### 2.3 Admin (Restaurant)

- **Primary persona:** Restaurant manager overseeing menu, orders, and incidents
- **Key needs:** Order dashboard, menu management, dispatch control, incident resolution

---

## 3. User Roles & Permissions

| Capability | Customer | Driver | Admin |
|-----------|----------|--------|-------|
| Browse menu & place orders | ✅ | ❌ | ❌ |
| Voice AI ordering | ✅ | ❌ | ❌ |
| Track own orders | ✅ | ❌ | ❌ |
| View/accept available deliveries | ❌ | ✅ | ❌ |
| Update delivery status & ETA | ❌ | ✅ | ❌ |
| View earnings & ratings | ❌ | ✅ | ❌ |
| Manage menu items | ❌ | ❌ | ✅ |
| Assign orders to drivers | ❌ | ❌ | ✅ |
| View all orders & analytics | ❌ | ❌ | ✅ |
| Handle incidents | ❌ | ❌ | ✅ |
| Chat (order-specific) | ✅ | ✅ | ❌ |

---

## 4. Feature Requirements

### 4.1 Authentication (All Roles)

| Requirement | Priority | Status |
|-------------|----------|--------|
| Email/password signup with role selection | P0 | ✅ Done |
| Email/password login | P0 | ✅ Done |
| Session persistence across app restarts | P0 | ✅ Done |
| Role-based navigation on login | P0 | ✅ Done |
| Quick-access demo login (dev only) | P2 | ✅ Done |
| Sign out with confirmation | P1 | ✅ Done |
| Forgot password / reset flow | P1 | ❌ Not built |
| Social login (Google, Apple) | P2 | ❌ Not built |

### 4.2 Customer — Menu & Browsing

| Requirement | Priority | Status |
|-------------|----------|--------|
| Home screen with category grid (8 categories) | P0 | ✅ Done |
| Top-rated items grid (2-column FlatList) | P0 | ✅ Done |
| Search bar with scored keyword matching | P0 | ✅ Done |
| Menu item detail with modifiers, allergens, nutrition | P0 | ✅ Done |
| Flash deals with countdown timers | P1 | ✅ Done |
| Top picks carousel | P1 | ✅ Done |
| Recently viewed items row | P1 | ✅ Done |
| Popular Now badges (orders in last hour) | P1 | ✅ Done |
| Favorite/unfavorite items | P1 | ✅ Done |
| Category browsing screen | P0 | ✅ Done |
| Dietary profile filtering | P1 | ✅ Done |

### 4.3 Customer — Cart & Checkout

| Requirement | Priority | Status |
|-------------|----------|--------|
| Add items with quantity, modifiers, special instructions | P0 | ✅ Done |
| Cart screen with quantity adjustment and removal | P0 | ✅ Done |
| Promo code entry and discount application | P0 | ✅ Done |
| Free delivery progress bar (threshold: $30) | P1 | ✅ Done |
| Upsell suggestions based on cart contents | P1 | ✅ Done |
| Savings summary card | P1 | ✅ Done |
| Order summary with subtotal, tax, delivery fee, tip, total | P0 | ✅ Done |
| Delivery / Pickup toggle | P0 | ✅ Done |
| Address selection | P0 | ✅ Done |
| Payment method selection (card / cash) | P0 | ✅ Done (UI only) |
| Tip selector (0%, 5%, 10%, custom) | P1 | ✅ Done |
| Schedule order for later (time slots) | P1 | ✅ Done |
| Delivery notes with quick templates | P1 | ✅ Done |
| Place order via Supabase RPC | P0 | ✅ Done |
| Cart persistence across app restart | P1 | ❌ Not built |
| Real payment gateway integration (Stripe) | P0 (launch) | ❌ Not built |

### 4.4 Customer — Orders & Tracking

| Requirement | Priority | Status |
|-------------|----------|--------|
| Orders list with Active / Past tabs | P0 | ✅ Done |
| Order detail with expandable items, timeline, address | P0 | ✅ Done |
| Real-time order tracking with progress stepper | P0 | ✅ Done |
| Driver info card with call & message buttons | P0 | ✅ Done |
| ETA display from driver updates | P0 | ✅ Done |
| Cancel order (PLACED/ACCEPTED only) with reason | P0 | ✅ Done |
| Reorder from past delivery | P1 | ✅ Done |
| Rate order (food + driver rating) | P1 | ✅ Done |
| Report issue on order | P1 | ✅ Done |
| Kitchen queue position view (PREPARING status) | P2 | ✅ Done |

### 4.5 Customer — Profile & Settings

| Requirement | Priority | Status |
|-------------|----------|--------|
| Profile card with avatar, name, email, phone | P0 | ✅ Done |
| Food preferences summary (dietary, allergies, cuisines) | P1 | ✅ Done |
| Dietary profile editor | P1 | ✅ Done |
| Saved addresses management | P1 | ✅ Done |
| Payment methods management | P1 | ✅ Done (UI shell) |
| Notifications screen | P1 | ✅ Done |
| Loyalty program (points, tiers, streaks, perks) | P1 | ✅ Done |
| Help & support screen | P2 | ✅ Done |
| Referral program | P2 | ✅ Done (UI shell) |

### 4.6 Customer — Voice AI

| Requirement | Priority | Status |
|-------------|----------|--------|
| Text-based AI food assistant (VoiceAIScreen) | P0 | ✅ Done |
| Mood-based quick suggestion chips | P1 | ✅ Done |
| Menu item suggestions from AI response | P0 | ✅ Done |
| Add AI-suggested items to cart | P0 | ✅ Done |
| Voice call mode with live recording | P0 | ✅ Done |
| Speech-to-text (Web: SpeechRecognition, Native: Pollinations) | P0 | ✅ Done |
| Text-to-speech for AI responses | P1 | ✅ Done |
| Action parsing from AI (add_to_cart, remove, etc.) | P0 | ✅ Done |
| Fuzzy menu item matching (Levenshtein distance) | P1 | ✅ Done |
| Silence detection (3-tier: metering/timer/hard cap) | P1 | ✅ Done |
| Live call UI with pulsing orb and captions | P1 | ✅ Done |
| Text/manual chat mode fallback | P1 | ✅ Done |
| Mute, speaker, TTS toggle controls | P1 | ✅ Done |
| Debug overlay for state inspection | P2 | ✅ Done |
| Food memory context injection into AI prompts | P1 | ✅ Done |
| Bilingual support (English/Arabic) | P2 | ✅ Done (via Sara persona) |
| Fallback to text-only if voice APIs fail | P1 | ❌ Partial |

### 4.7 Driver

| Requirement | Priority | Status |
|-------------|----------|--------|
| Online/offline toggle with status update | P0 | ✅ Done |
| Available orders list with accept button | P0 | ✅ Done |
| Active delivery with step-by-step progress | P0 | ✅ Done |
| Update delivery ETA with modal | P0 | ✅ Done |
| Mark order as picked up / delivered | P0 | ✅ Done |
| Delivery proof notes before marking delivered | P1 | ✅ Done |
| Call / message / navigate to customer | P0 | ✅ Done |
| Earnings dashboard with time filters | P0 | ✅ Done |
| Weekly earnings chart | P1 | ✅ Done |
| Rating breakdown and recent reviews | P1 | ✅ Done |
| Delivery history with detail modal | P1 | ✅ Done |
| Driver profile with stats | P0 | ✅ Done |
| Heat map with demand zones | P2 | ✅ Done (mock data) |
| Chat with customer per order | P0 | ✅ Done |
| Real demand data for heat map | P2 | ❌ Not built |

### 4.8 Admin

| Requirement | Priority | Status |
|-------------|----------|--------|
| Dashboard with order analytics | P0 | ✅ Screen exists |
| Dispatch system for order assignment | P0 | ✅ Screen exists |
| Menu management (add/edit items) | P0 | ✅ Screen exists |
| Orders management | P0 | ✅ Screen exists |
| User management | P1 | ✅ Screen exists |
| Incident management | P1 | ✅ Screen exists |
| Messages | P2 | ✅ Screen exists |
| Settings | P2 | ✅ Screen exists |

> **Note:** Admin screens were not deeply audited in this pass. They exist as functional screens but detailed feature verification is pending.

### 4.9 Shared / Cross-Cutting

| Requirement | Priority | Status |
|-------------|----------|--------|
| Order-specific chat between customer & driver | P0 | ✅ Done |
| Read receipts in chat | P1 | ✅ Done |
| System messages (ETA/status updates) in chat | P1 | ✅ Done |
| Real-time order updates via Supabase Realtime | P0 | ✅ Done |
| EventBus for cross-store communication | P1 | ✅ Done |
| Error boundary component | P1 | ✅ Done |
| Theme system with design tokens | P1 | ✅ Done |
| Safe area handling | P0 | ✅ Done |
| Keyboard avoidance on input screens | P0 | ✅ Done |

---

## 5. Technical Architecture

### 5.1 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React Native 0.81.5 (Expo SDK 54) |
| **Language** | TypeScript (strict) |
| **Routing** | Expo Router v6 (file-based) |
| **State** | Zustand v5 (16 stores) |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| **Voice AI** | Pollinations API (free tier) — chat, STT, TTS |
| **Audio** | expo-av (recording), expo-speech (native TTS) |
| **Icons** | @expo/vector-icons (Ionicons) |
| **Styling** | React Native StyleSheet + custom theme tokens |

### 5.2 Data Flow

```
User Action → Screen Component → Zustand Store → Service Layer → Supabase
                                      ↓
                                  EventBus (cross-store notifications)
                                      ↓
                              Other Stores react to events
```

### 5.3 Voice AI Flow

```
User speaks → AudioService.startRecording()
           → AudioService.stopRecording() → audio blob
           → VoiceAIService.transcribe(audio) → text
           → VoiceAIService.chat(text, menuContext, foodMemory) → AI response
           → Parse |||ACTION:{...}||| blocks
           → Execute actions (CartStore.addItem, etc.)
           → VoiceAIService.speak(response) → TTS playback
           → Loop (listening → processing → speaking)
```

### 5.4 Database Schema (16 tables)

**Core:** profiles, categories, menu_items, modifier_groups, modifier_options, item_modifier_groups, orders, order_lines, order_status_events, driver_status, addresses

**Extended:** loyalty_profiles, order_feedback, order_incidents, scheduled_orders, group_orders, group_order_members, kitchen_queue

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Metric | Target | Current |
|--------|--------|---------|
| App cold start | < 3s | ⚠️ Not measured |
| Menu load time | < 1s | ⚠️ Loads all items at once |
| Voice AI round-trip (STT→LLM→TTS) | < 5s | ⚠️ Depends on Pollinations latency |
| Order placement | < 2s | ✅ Single RPC call |

### 6.2 Reliability

| Metric | Target | Current |
|--------|--------|---------|
| Offline data access | Cached menu + orders | ❌ No offline support |
| Order placement retry | Auto-retry with idempotency | ❌ No retry/idempotency |
| Realtime reconnection | Auto-reconnect on network change | ❌ No reconnection logic |
| Crash rate | < 0.1% | ⚠️ No crash reporting configured |

### 6.3 Security

| Metric | Target | Current |
|--------|--------|---------|
| Server-side price validation | All order totals verified | ❌ Client-trusted totals |
| Input sanitization | All user text sanitized | ❌ Raw input passed through |
| RLS enforcement | Row-level security on all tables | ✅ Enabled |
| API key protection | Environment variables only | ✅ .env, gitignored |
| Demo credentials in prod | Disabled | ❌ No environment guard |

---

## 7. Success Metrics (Post-Launch)

| Metric | Definition | Target |
|--------|-----------|--------|
| **Order Completion Rate** | Orders placed / sessions started | > 60% |
| **Voice Order Adoption** | Orders placed via voice / total orders | > 15% |
| **Average Order Value** | Total revenue / total orders | > $25 |
| **Driver Acceptance Time** | Time from order placed to driver accepts | < 3 min |
| **Delivery Time** | Time from order placed to delivered | < 45 min |
| **Customer Retention** | % customers ordering again within 30 days | > 40% |
| **App Crash Rate** | Crashes / sessions | < 0.1% |
| **Voice AI Accuracy** | Correct item added / voice commands issued | > 85% |

---

## 8. Roadmap

### Phase 1 — MVP Hardening (Current → Launch)

- [ ] Server-side price validation
- [ ] Real payment integration (Stripe)
- [ ] Cart persistence (AsyncStorage)
- [ ] Order idempotency
- [ ] Remove demo credentials from production builds
- [ ] Push notifications (expo-notifications)
- [ ] Unit tests for core flows
- [ ] Crash reporting (Sentry)

### Phase 2 — Beta Polish

- [ ] Offline mode with cached data
- [ ] Real-time demand data for driver heat map
- [ ] Background job for scheduled orders
- [ ] Complete admin screen audit and polish
- [ ] Referral system backend integration
- [ ] Menu pagination for large catalogs
- [ ] Image caching and progressive loading

### Phase 3 — Growth Features

- [ ] Social login (Google, Apple)
- [ ] Multiple restaurant/store support
- [ ] Driver location tracking on map
- [ ] Customer live order map view
- [ ] AI-powered reorder suggestions
- [ ] Multi-language UI (beyond voice AI bilingual)
- [ ] A/B testing framework
- [ ] Analytics dashboard (Mixpanel/Amplitude)

---

## 9. Assumptions & Constraints

### Assumptions

1. Single restaurant/store model (no marketplace)
2. Delivery area is limited (no long-distance shipping)
3. Pollinations API remains available on free tier for MVP
4. Supabase free/pro tier is sufficient for initial user base
5. Menu items are managed by admin, not self-serve by restaurants

### Constraints

1. **No payment processing** — Stripe integration required before charging real money
2. **Voice AI dependency** — Pollinations free tier has no SLA
3. **No push notifications** — Real-time updates only work while app is open
4. **Single currency** — USD only, no multi-currency support
5. **No localization** — English UI only (voice AI supports Arabic)

---

## 10. Glossary

| Term | Definition |
|------|-----------|
| **RLS** | Row-Level Security — Supabase/PostgreSQL feature restricting data access per user |
| **RPC** | Remote Procedure Call — Supabase server-side functions |
| **STT** | Speech-to-Text |
| **TTS** | Text-to-Speech |
| **LLM** | Large Language Model (Pollinations chat API) |
| **Zustand** | Lightweight React state management library |
| **EventBus** | Pub/sub pattern for cross-store communication |
| **Sara** | AI assistant persona name (friendly, bilingual, short responses) |
| **Expo Router** | File-based navigation for React Native (similar to Next.js) |

---

*This PRD reflects the current state of the SmartFood app as of the latest code audit. It serves as the source of truth for feature scope, technical architecture, and launch readiness.*
