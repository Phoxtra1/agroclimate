## AGTrans — Agricultural Transport & Logistics Layer

Build AGTrans as an integrated logistics layer inside AgroClimate. Two faces: a **Transport Request** tab inside Market Link (supplier-side) and a dedicated **AGTrans Partner** workspace (driver-side). Admin gets an AGTrans control panel. AI hooks reuse the existing `OdenehoProvider` abstraction.

---

### 1. Database (single migration)

New tables (all with proper GRANTs + RLS):

- `agtrans_drivers` — driver profile linked to `auth.users`
  - fields: full_name, phone, region, district, vehicle_type, plate_number, vehicle_capacity_kg, route_coverage (text[]), preferred_corridors (text[]), license_url, license_class, availability_status (`available|busy|offline`), verification_status (`pending|verified|suspended|rejected`), reliability_score (numeric), completed_deliveries, late_deliveries, cancellations, disputes
- `agtrans_requests` — supplier transport requests
  - fields: supplier_id, agreement_id (nullable link to existing `agreements`), pickup_location, pickup_lat/lon, delivery_location, delivery_lat/lon, product_type, quantity, unit, preferred_pickup_at, urgency (`standard|urgent|cold_chain`), status (10 states from spec), driver_id (nullable), buyer_id (nullable for visibility), tracking_code (unique short code), notes, estimated_price
- `agtrans_request_offers` — driver responses & broadcast layer
  - fields: request_id, driver_id, action (`notified|accepted|rejected`), notification_layer (`nearby|district|regional|national`), responded_at
- `agtrans_tracking_events` — checkpoint & GPS history
  - fields: request_id, driver_id, event_type (`status_change|gps_ping|checkpoint|note`), status, lat, lon, note
- `agtrans_ratings` — supplier/buyer ratings of driver
  - fields: request_id, driver_id, rater_id, rater_role (`supplier|buyer`), score (1-5), comment
- New `app_role` value: `driver` (added via ALTER TYPE)
- Storage bucket: `agtrans-licenses` (private)

RLS summary:
- Drivers manage their own driver profile; admins manage all; verified driver lookups visible to suppliers via security-definer function
- Suppliers manage own requests; assigned driver can read & update status; buyer (if linked) can read; admins all
- Offers: driver sees their own, supplier sees offers on own requests, admin all
- Tracking events: driver inserts for assigned trips, supplier/buyer/admin read
- Ratings: rater creates own; driver and admin read

### 2. Edge functions

- `agtrans-broadcast` — given a request_id, picks drivers by route corridor + region, inserts offers in layered fashion (nearby → district → regional → national) with time gates. Invoked on request creation and via cron-style retry from client polling.
- `agtrans-ai-advisor` — uses Lovable AI Gateway (`google/gemini-2.5-flash`) via existing `OdenehoProvider` pattern; returns route risk, ETA estimate, driver-match recommendation, spoilage risk. Reuses `src/lib/aiProviders`.

### 3. Frontend — Supplier face (inside Market Link)

- Extend `src/components/market/MarketplaceLayout.tsx` panel: add **AGTrans** tab after Prices.
- New page `src/pages/marketplace/MarketplaceAGTrans.tsx` titled **"Transport Request"**:
  - List of user's transport requests with status badges + copy tracking code button
  - "New Transport Request" dialog (pickup, destination, product, qty, pickup time, urgency, optional link to existing agreement/order)
  - Detail drawer: live status, driver card (when matched), AI advisory card, tracking timeline, delivery confirmation action
  - Realtime subscription on `agtrans_requests` + `agtrans_tracking_events`

### 4. Frontend — Driver face (AGTrans Partner)

- **Auth integration**: extend existing signup form (`src/pages/Index.tsx` or wherever auth lives) — add **Account Type** dropdown: `Farmer | Buyer | Driver`. On driver signup, route to `/agtrans-partner/onboarding`.
- New layout `src/components/AgTransPartnerLayout.tsx` (mirrors AppLayout styling)
- New pages:
  - `/agtrans-partner/onboarding` — "Join Agro-Logistics Network" multi-step form (profile, vehicle, corridors, license upload). Creates `agtrans_drivers` row in `pending` status.
  - `/agtrans-partner/pending` — verification waiting screen
  - `/agtrans-partner` — driver dashboard: Available Requests, Assigned Trips, Trip History, Earnings stub, Availability toggle, Notification Center
  - `/agtrans-partner/trip/:id` — pickup/delivery details, cargo info, status update buttons (Picked → In Transit → Near Destination → Delivered), GPS ping via `navigator.geolocation`, navigation hand-off (Google Maps link), copy tracking ID

### 5. Frontend — Buyer visibility

- Add **"Track Delivery"** card on buyer order detail (existing `MarketplaceOrderListing` / order pages) showing read-only status timeline + ETA. No control actions.

### 6. Frontend — Admin

- Add `AGTrans` nav item in admin sidebar
- New page `src/pages/admin/AGTransPanel.tsx` with tabs:
  - Driver Approvals (verify/reject/suspend, view license)
  - Live Deliveries (filterable list, status, route)
  - Disputes (low-rating + flagged requests)
  - Analytics (counts, avg delivery time, reliability distribution) — simple cards initially

### 7. Routing & access control

- Update `src/App.tsx` with new routes
- Route guard hook `useRequireRole(role)` — drivers blocked from `/dashboard`, redirected to `/agtrans-partner`; farmers blocked from partner UI
- Use existing `has_role` SQL function pattern (extend `app_role` enum)

### 8. Reusable utilities

- `src/components/CopyButton.tsx` — universal copy button with toast confirmation (used on tracking codes, driver IDs, request refs)
- `src/lib/agtrans/statusFlow.ts` — central status enum, colors, allowed transitions, labels
- `src/lib/agtrans/notificationLayers.ts` — broadcast layer logic constants
- `src/hooks/useAgTransRequests.ts`, `useAgTransDriverProfile.ts`, `useAgTransTrip.ts` — data hooks with realtime
- AI: extend `OdenehoProvider` interface with `generateLogisticsAdvisory(request, driver?)` returning `{ etaMinutes, routeRisk, recommendation, spoilageRisk }`. Implement in `lovableProvider.ts` via existing edge function pattern.

### 9. AGNav placeholder

- Scaffolds-only: `src/lib/agnav/waterTransport.ts` with type stubs and TODO comments. No UI yet — architecture-ready only as spec requests.

### 10. Memory

Save new memory file `mem://features/agtrans` describing the architecture so future sessions don't break it.

---

### Out of scope for MVP (noted in code)

- Real-time GPS streaming (uses periodic pings via tracking events)
- Payments / pay-as-you-go billing (admin tracking column only)
- Twilio SMS driver dispatch (uses in-app notifications via existing `user_alerts`)
- Full cold-chain sensor integration (urgency flag only)
- AGNav UI (architecture stubs only)

These are wired so they can be added later without rework.
