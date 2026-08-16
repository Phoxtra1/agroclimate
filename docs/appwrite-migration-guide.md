# Migrating the Agyenkwa backend from Lovable Cloud (Supabase) to Appwrite

Version: AGY V1.4 · Generated automatically from the live schema.

This guide is a complete, step-by-step transfer plan: service mapping, collection
and attribute definitions, permissions, storage buckets, functions, realtime, and
a data migration script.

---

## 1. Service mapping

| Current (Supabase) | Appwrite equivalent | Notes |
|---|---|---|
| Postgres tables (`public`) | Database → Collections | One collection per table, `id` becomes `$id` |
| Row Level Security policies | Collection + Document permissions, or Function-enforced | Appwrite has no SQL predicates; ownership rules move to document-level permissions |
| `auth.users` | Appwrite Account / Users | Keep the same UUIDs where possible |
| `user_roles` + `has_role()` | Appwrite Teams (`admin`, `moderator`, `handler`, `buyer`, `driver`) | Team membership replaces the roles table |
| Edge Functions (Deno) | Appwrite Functions (Node 20 / Deno runtime) | Same handler code, different entrypoint signature |
| Storage buckets | Appwrite Storage buckets | Private buckets use file-level read permissions |
| Realtime (`postgres_changes`) | Appwrite Realtime channels (`databases.*.collections.*.documents`) | Subscription code changes, semantics identical |
| Postgres triggers (`updated_at`) | Appwrite `$updatedAt` (built in) | Drop the trigger functions |
| `admin_overview_stats()` RPC | Appwrite Function `admin-overview-stats` | Uses the server SDK with an API key to bypass permissions |

---

## 2. Prerequisites

```bash
npm i -g appwrite-cli
appwrite login
appwrite init project        # creates appwrite.json
```

Create one database, `agyenkwa`, and record its ID.

Environment variables to add to the frontend:

```
VITE_APPWRITE_ENDPOINT=https://<host>/v1
VITE_APPWRITE_PROJECT_ID=<project id>
VITE_APPWRITE_DATABASE_ID=agyenkwa
```

---

## 3. Global conventions

- Every collection keeps a `user_id` (String 36) attribute, even where document
  permissions already scope access — reports and functions rely on it.
- `created_at` / `updated_at` are dropped in favour of Appwrite's built-in
  `$createdAt` / `$updatedAt`, but are listed below so historical values can be
  imported into optional shadow attributes if exact timestamps matter.
- Postgres `jsonb` becomes a `String` attribute holding serialised JSON
  (size 65535) unless the shape is fixed, in which case use nested attributes.
- Postgres arrays (`text[]`) become Appwrite array attributes (`array: true`).
- Enums (`app_role`) become Appwrite Enum attributes with the same values:
  `admin, moderator, user, handler, buyer, driver`.

### Default permission recipes

| Pattern | Collection permission | Document permission |
|---|---|---|
| Private per-user data (harvests, inventory, drones, missions) | `create("users")` | `read/update/delete(user:<uid>)` |
| Two-party data (messages, negotiations, agreements, transport requests) | `create("users")` | `read/update(user:<buyer>)`, `read/update(user:<supplier>)` |
| Public catalogue (farmer_inputs, buyer_orders, price_intelligence) | `read("users")`, `create("users")` | `update/delete(user:<owner>)` |
| Admin-only (system_settings, ai_usage_logs, disaster_alerts writes) | `read/create/update/delete(team:admin)` | inherited |

Isolation rule: never grant `read("any")` or `read("users")` on
`market_messages`, `agtrans_*`, `handler_*`, `profiles` contact fields,
`user_alerts`, `user_preferences`, or `user_subscriptions`.

---

## 4. Collections and attributes

Each heading is a collection ID (identical to the current table name). `$id`
replaces the `id` column, so `id` is omitted from the attribute lists.

### `activity`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | No |
| action | String(10000) | Yes |
| metadata | String(65535) (JSON) | No |
| created_at | Datetime | Yes |

### `agreements`

| Attribute | Type | Required |
|---|---|---|
| negotiation_id | String(36) | Yes |
| listing_id | String(36) | No |
| order_id | String(36) | No |
| buyer_id | String(36) | Yes |
| supplier_id | String(36) | Yes |
| buyer_name | String(10000) | No |
| supplier_name | String(10000) | No |
| product | String(10000) | No |
| agreed_price | Float | Yes |
| agreed_quantity | Float | Yes |
| unit | String(10000) | Yes |
| delivery_terms | String(10000) | No |
| negotiation_summary | String(10000) | No |
| agreement_status | String(10000) | Yes |
| created_at | Datetime | Yes |

### `agtrans_drivers`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| full_name | String(10000) | Yes |
| phone | String(10000) | Yes |
| region | String(10000) | No |
| district | String(10000) | No |
| vehicle_type | String(10000) | Yes |
| plate_number | String(10000) | Yes |
| vehicle_capacity_kg | Float | No |
| route_coverage | String[] (array) | No |
| preferred_corridors | String[] (array) | No |
| license_url | String(10000) | No |
| license_class | String(10000) | No |
| availability_status | String(10000) | Yes |
| verification_status | String(10000) | Yes |
| reliability_score | Float | No |
| completed_deliveries | Integer | No |
| late_deliveries | Integer | No |
| cancellations | Integer | No |
| disputes | Integer | No |
| notes | String(10000) | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |
| cancelled_trips | Integer | No |
| approval_status | String(10000) | Yes |
| rejection_reason | String(10000) | No |
| admin_suspended | Boolean | Yes |
| insurance_status | String(10000) | No |
| roadworthiness_status | String(10000) | No |
| cargo_categories | String[] (array) | No |
| rate_information | String(10000) | No |
| vehicle_images | String[] (array) | No |
| current_location | String(65535) (JSON) | No |
| driver_photo_url | String(10000) | No |
| driver_rating | Float | Yes |
| rating_count | Integer | Yes |
| vehicle_features | String[] (array) | Yes |
| cargo_types_accepted | String[] (array) | Yes |
| current_location_text | String(10000) | No |
| pickup_area | String(10000) | No |
| destination | String(10000) | No |
| planned_route | String(10000) | No |
| departure_date | Datetime | No |
| departure_time | String(10000) | No |
| estimated_arrival | String(10000) | No |
| route_flexibility | String(10000) | No |
| pricing_type | String(10000) | Yes |
| suggested_fee | Float | No |
| offer_notes | String(10000) | No |
| special_cargo_instructions | String(10000) | No |
| offer_status | String(10000) | Yes |
| remaining_capacity | Float | Yes |

### `agtrans_ratings`

| Attribute | Type | Required |
|---|---|---|
| request_id | String(36) | Yes |
| driver_id | String(36) | Yes |
| rater_id | String(36) | Yes |
| rater_role | String(10000) | Yes |
| score | Integer | Yes |
| comment | String(10000) | No |
| created_at | Datetime | Yes |

### `agtrans_requests`

| Attribute | Type | Required |
|---|---|---|
| supplier_id | String(36) | Yes |
| buyer_id | String(36) | No |
| agreement_id | String(36) | No |
| tracking_code | String(10000) | Yes |
| pickup_location | String(10000) | Yes |
| pickup_lat | Float | No |
| pickup_lon | Float | No |
| delivery_location | String(10000) | Yes |
| delivery_lat | Float | No |
| delivery_lon | Float | No |
| product_type | String(10000) | Yes |
| quantity | Float | Yes |
| unit | String(10000) | Yes |
| preferred_pickup_at | Datetime | No |
| urgency | String(10000) | Yes |
| status | String(10000) | Yes |
| driver_id | String(36) | No |
| estimated_price | Float | No |
| notes | String(10000) | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |
| marketplace_order_id | String(36) | No |
| transport_offer_id | String(36) | No |
| request_type | String(10000) | No |
| cargo_weight | Float | No |
| cargo_types | String[] (array) | No |
| cargo_features | String[] (array) | No |
| supplier_offer_price | Float | No |
| driver_counter_price | Float | No |
| agreed_fee | Float | No |
| agreement_timestamp | Datetime | No |
| negotiation_status | String(10000) | No |
| rejection_reason | String(10000) | No |
| counter_note | String(10000) | No |

### `agtrans_tracking_events`

| Attribute | Type | Required |
|---|---|---|
| request_id | String(36) | Yes |
| driver_id | String(36) | No |
| event_type | String(10000) | Yes |
| status | String(10000) | No |
| lat | Float | No |
| lon | Float | No |
| note | String(10000) | No |
| created_at | Datetime | Yes |

### `ai_usage_logs`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | No |
| model | String(10000) | Yes |
| action | String(10000) | Yes |
| latency_ms | Integer | No |
| ok | Boolean | Yes |
| error | String(10000) | No |
| created_at | Datetime | Yes |

### `alert_logs`

| Attribute | Type | Required |
|---|---|---|
| alert_id | String(36) | No |
| user_id | String(36) | No |
| alert_type | String(10000) | No |
| severity | String(10000) | No |
| delivered | Boolean | Yes |
| opened | Boolean | Yes |
| delivered_at | Datetime | Yes |
| opened_at | Datetime | No |
| created_at | Datetime | Yes |

### `buyer_orders`

| Attribute | Type | Required |
|---|---|---|
| buyer_id | String(36) | Yes |
| buyer_name | String(10000) | No |
| crop_name | String(10000) | Yes |
| region | String(10000) | No |
| quantity_needed | Float | Yes |
| unit | String(10000) | Yes |
| target_price | Float | Yes |
| delivery_start | Datetime | No |
| delivery_end | Datetime | No |
| status | String(10000) | Yes |
| notes | String(10000) | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |
| quality | String(10000) | No |
| grade | String(10000) | No |
| moisture | String(10000) | No |
| contact_email | String(10000) | No |
| contact_phone | String(10000) | No |
| price_label | String(10000) | No |
| order_status | String(10000) | No |
| negotiation_status | String(10000) | No |

### `delivery_jobs`

| Attribute | Type | Required |
|---|---|---|
| supplier_id | String(36) | Yes |
| buyer_id | String(36) | No |
| driver_id | String(36) | Yes |
| request_id | String(36) | No |
| agreement_id | String(36) | No |
| transport_agreement_id | String(36) | No |
| transport_fee | Float | No |
| product | String(10000) | Yes |
| quantity | Float | Yes |
| pickup_location | String(10000) | Yes |
| destination | String(10000) | Yes |
| driver_name | String(10000) | No |
| vehicle_type | String(10000) | No |
| plate_number | String(10000) | No |
| status | String(10000) | Yes |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `disaster_alerts`

| Attribute | Type | Required |
|---|---|---|
| title | String(10000) | Yes |
| description | String(10000) | No |
| severity | String(10000) | Yes |
| alert_type | String(10000) | Yes |
| affected_regions | String[] (array) | No |
| active | Boolean | Yes |
| created_by | String(36) | No |
| created_at | Datetime | Yes |
| expires_at | Datetime | No |

### `drone_ai_detections`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| mission_id | String(36) | No |
| media_id | String(36) | No |
| category | String(10000) | Yes |
| observation | String(10000) | Yes |
| risk_score | Float | No |
| recommended_action | String(10000) | No |
| bounding_box | String(65535) (JSON) | No |
| captured_at | Datetime | Yes |
| created_at | Datetime | Yes |

### `drone_media`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| mission_id | String(36) | No |
| drone_id | String(36) | No |
| media_type | String(10000) | Yes |
| storage_path | String(10000) | Yes |
| captured_at | Datetime | Yes |
| metadata | String(65535) (JSON) | No |
| archived | Boolean | Yes |
| created_at | Datetime | Yes |

### `drone_missions`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| mission_type | String(10000) | Yes |
| target_lat | Float | No |
| target_lon | Float | No |
| target_location | String(10000) | No |
| planned_date | Datetime | No |
| drone_type | String(10000) | No |
| altitude_m | Float | No |
| status | String(10000) | Yes |
| advisory_result | String(10000) | No |
| notes | String(10000) | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |
| drone_id | String(36) | No |
| name | String(10000) | No |
| area_polygon | String(65535) (JSON) | No |
| speed_ms | Float | No |
| route_pattern | String(10000) | No |
| camera_settings | String(65535) (JSON) | No |
| started_at | Datetime | No |
| completed_at | Datetime | No |
| estimated_battery_pct | Float | No |
| estimated_duration_min | Float | No |
| estimated_coverage_ha | Float | No |
| autonomous | Boolean | No |
| success | Boolean | No |

### `drone_telemetry_logs`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| mission_id | String(36) | No |
| drone_id | String(36) | No |
| captured_at | Datetime | Yes |
| lat | Float | No |
| lng | Float | No |
| altitude_m | Float | No |
| ground_speed_ms | Float | No |
| vertical_speed_ms | Float | No |
| heading | Float | No |
| battery_pct | Float | No |
| signal_strength | Float | No |
| gps_accuracy_m | Float | No |
| payload | String(65535) (JSON) | No |

### `drones`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| name | String(10000) | Yes |
| model | String(10000) | No |
| protocol | String(10000) | Yes |
| firmware | String(10000) | No |
| serial | String(10000) | No |
| paired_at | Datetime | No |
| last_seen_at | Datetime | No |
| last_battery_pct | Float | No |
| status | String(10000) | Yes |
| metadata | String(65535) (JSON) | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |
| aircraft_type | String(10000) | Yes |
| manufacturer | String(10000) | No |
| operator | String(10000) | No |
| home_base | String(10000) | No |
| last_handshake_at | Datetime | No |

### `farm_qr_codes`

| Attribute | Type | Required |
|---|---|---|
| farmer_id | String(36) | Yes |
| farm_name | String(10000) | Yes |
| farm_location | String(10000) | No |
| qr_code_data | String(10000) | Yes |
| created_at | Datetime | Yes |

### `farmer_crops`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| crop_name | String(10000) | Yes |
| created_at | Datetime | Yes |

### `farmer_inputs`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| crop_name | String(10000) | Yes |
| region | String(10000) | No |
| expected_quantity | Float | Yes |
| unit | String(10000) | Yes |
| harvest_start | Datetime | No |
| harvest_end | Datetime | No |
| risk_level | String(10000) | Yes |
| status | String(10000) | Yes |
| notes | String(10000) | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |
| image_url | String(10000) | No |
| category | String(10000) | No |
| quality_grade | String(10000) | No |
| suggested_price | Float | No |
| delivery_timeline | String(10000) | No |
| contact_email | String(10000) | No |
| contact_phone | String(10000) | No |
| verified | Boolean | No |
| price_label | String(10000) | No |
| owner_id | String(36) | No |
| estimated_price | Float | No |
| demand_level | String(10000) | No |
| listing_status | String(10000) | No |

### `fish_ponds`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| name | String(10000) | Yes |
| species | String(10000) | Yes |
| stock_count | Integer | No |
| pond_size_sqm | Float | No |
| water_temp | Float | No |
| ph_level | Float | No |
| dissolved_oxygen | Float | No |
| last_feeding | Datetime | No |
| feeding_schedule | String(10000) | No |
| notes | String(10000) | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `fleet_alert_thresholds`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | No |
| is_default | Boolean | Yes |
| battery_warning_pct | Float | Yes |
| battery_critical_pct | Float | Yes |
| signal_warning_pct | Float | Yes |
| signal_critical_pct | Float | Yes |
| stale_timeout_sec | Integer | Yes |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `handler_issues`

| Attribute | Type | Required |
|---|---|---|
| handler_id | String(36) | Yes |
| farmer_id | String(36) | Yes |
| issue_type | String(10000) | Yes |
| description | String(10000) | No |
| photo_url | String(10000) | No |
| gps_lat | Float | No |
| gps_lon | Float | No |
| status | String(10000) | Yes |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `handler_tasks`

| Attribute | Type | Required |
|---|---|---|
| farmer_id | String(36) | Yes |
| handler_id | String(36) | Yes |
| title | String(10000) | Yes |
| description | String(10000) | No |
| field_location | String(10000) | No |
| deadline | Datetime | No |
| evidence_required | Boolean | No |
| status | String(10000) | Yes |
| quantity_label | String(10000) | No |
| quantity_expected | Float | No |
| quantity_completed | Float | No |
| completed_at | Datetime | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `handlers`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| farmer_id | String(36) | Yes |
| handler_name | String(10000) | Yes |
| handler_type | String(10000) | Yes |
| assigned_farm | String(10000) | No |
| status | String(10000) | Yes |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `harvest_losses`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| crop_name | String(10000) | Yes |
| quantity_lost | Float | Yes |
| unit | String(10000) | Yes |
| loss_reason | String(10000) | Yes |
| season | String(10000) | No |
| farm_plot | String(10000) | No |
| notes | String(10000) | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `harvest_records`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| crop_name | String(10000) | Yes |
| quantity | Float | Yes |
| unit | String(10000) | Yes |
| quality_grade | String(10000) | No |
| season | String(10000) | No |
| farm_plot | String(10000) | No |
| harvest_date | Datetime | No |
| notes | String(10000) | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `inventory_items`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| item_name | String(10000) | Yes |
| item_type | String(10000) | Yes |
| quantity | Float | Yes |
| unit | String(10000) | Yes |
| price_per_unit | Float | Yes |
| crop_name | String(10000) | No |
| season | String(10000) | No |
| farm_plot | String(10000) | No |
| notes | String(10000) | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `labor_records`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| task_description | String(10000) | Yes |
| worker_count | Integer | No |
| days_worked | Float | Yes |
| cost_per_day | Float | Yes |
| crop_name | String(10000) | No |
| season | String(10000) | No |
| farm_plot | String(10000) | No |
| notes | String(10000) | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `land_costs`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| land_description | String(10000) | Yes |
| size_acres | Float | Yes |
| cost_type | String(10000) | Yes |
| cost_amount | Float | Yes |
| season | String(10000) | No |
| farm_plot | String(10000) | No |
| notes | String(10000) | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `market_contracts`

| Attribute | Type | Required |
|---|---|---|
| farmer_id | String(36) | Yes |
| buyer_id | String(36) | Yes |
| farmer_input_id | String(36) | No |
| buyer_order_id | String(36) | No |
| crop_name | String(10000) | Yes |
| quantity | Float | Yes |
| unit | String(10000) | Yes |
| locked_price | Float | Yes |
| delivery_start | Datetime | No |
| delivery_end | Datetime | No |
| state | String(10000) | Yes |
| logistics_status | String(10000) | Yes |
| notes | String(10000) | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `market_messages`

| Attribute | Type | Required |
|---|---|---|
| thread_key | String(10000) | Yes |
| sender_id | String(36) | Yes |
| recipient_id | String(36) | Yes |
| related_supply_id | String(36) | No |
| related_order_id | String(36) | No |
| body | String(10000) | Yes |
| read_at | Datetime | No |
| created_at | Datetime | Yes |

### `market_presence`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| last_seen | Datetime | Yes |
| display_name | String(10000) | No |

### `negotiations`

| Attribute | Type | Required |
|---|---|---|
| listing_id | String(36) | No |
| order_id | String(36) | No |
| buyer_id | String(36) | Yes |
| supplier_id | String(36) | Yes |
| status | String(10000) | Yes |
| agreed_price | Float | No |
| agreed_quantity | Float | No |
| unit | String(10000) | No |
| last_message_at | Datetime | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `post_harvest_entries`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| crop_name | String(10000) | Yes |
| quantity | Float | Yes |
| unit | String(10000) | Yes |
| harvest_date | Datetime | Yes |
| storage_location | String(10000) | No |
| storage_method | String(10000) | No |
| notes | String(10000) | No |
| photos | String[] (array) | No |
| risk_override | String(10000) | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `price_intelligence`

| Attribute | Type | Required |
|---|---|---|
| crop_name | String(10000) | Yes |
| region | String(10000) | No |
| current_price | Float | Yes |
| suggested_price | Float | Yes |
| trend | String(10000) | Yes |
| unit | String(10000) | Yes |
| updated_by | String(36) | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `profiles`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| display_name | String(10000) | No |
| phone | String(10000) | No |
| farm_size | String(10000) | No |
| preferred_language | String(10000) | No |
| region | String(10000) | No |
| district | String(10000) | No |
| community | String(10000) | No |
| country | String(10000) | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |
| farmer_type | String(10000) | No |
| drone_ownership | Boolean | No |
| drone_type | String(10000) | No |
| avatar_url | String(10000) | No |
| bio | String(10000) | No |

### `sales_records`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| crop_name | String(10000) | Yes |
| quantity_sold | Float | Yes |
| unit | String(10000) | Yes |
| price_per_unit | Float | Yes |
| buyer_name | String(10000) | No |
| season | String(10000) | No |
| farm_plot | String(10000) | No |
| sale_date | Datetime | No |
| notes | String(10000) | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `support_tickets`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| subject | String(10000) | Yes |
| description | String(10000) | Yes |
| category | String(10000) | Yes |
| status | String(10000) | Yes |
| priority | String(10000) | Yes |
| location | String(10000) | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `system_settings`

| Attribute | Type | Required |
|---|---|---|
| key | String(10000) | Yes |
| value | String(65535) (JSON) | Yes |
| updated_by | String(36) | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `task_evidence`

| Attribute | Type | Required |
|---|---|---|
| task_id | String(36) | Yes |
| handler_id | String(36) | Yes |
| evidence_type | String(10000) | Yes |
| file_url | String(10000) | No |
| notes | String(10000) | No |
| gps_lat | Float | No |
| gps_lon | Float | No |
| device_id | String(10000) | No |
| created_at | Datetime | Yes |

### `tracking_sessions`

| Attribute | Type | Required |
|---|---|---|
| delivery_job_id | String(36) | Yes |
| driver_id | String(36) | Yes |
| driver_name | String(10000) | No |
| vehicle_type | String(10000) | No |
| plate_number | String(10000) | No |
| pickup_location | String(10000) | No |
| destination | String(10000) | No |
| route | String(65535) (JSON) | No |
| eta | String(10000) | No |
| distance_m | Float | No |
| current_lat | Float | No |
| current_lon | Float | No |
| speed_kn | Float | No |
| heading | Float | No |
| status | String(10000) | Yes |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `transport_agreements`

| Attribute | Type | Required |
|---|---|---|
| request_id | String(36) | No |
| supplier_id | String(36) | Yes |
| buyer_id | String(36) | No |
| driver_id | String(36) | Yes |
| marketplace_order_id | String(36) | No |
| agreed_fee | Float | Yes |
| agreement_timestamp | Datetime | Yes |
| delivery_status | String(10000) | Yes |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `transport_notifications`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| type | String(10000) | Yes |
| title | String(10000) | Yes |
| message | String(10000) | Yes |
| data | String(65535) (JSON) | No |
| is_read | Boolean | Yes |
| created_at | Datetime | Yes |

### `user_alert_events`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| alert_id | String(10000) | Yes |
| alert_type | String(10000) | No |
| severity | String(10000) | No |
| event | String(10000) | Yes |
| created_at | Datetime | Yes |

### `user_alerts`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| alert_id | String(10000) | Yes |
| is_read | Boolean | Yes |
| is_dismissed | Boolean | Yes |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `user_preferences`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| prefs | String(65535) (JSON) | Yes |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `user_roles`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| role | Enum | Yes |
| created_at | Datetime | Yes |

### `user_subscriptions`

| Attribute | Type | Required |
|---|---|---|
| user_id | String(36) | Yes |
| plan | String(10000) | Yes |
| status | String(10000) | Yes |
| paystack_reference | String(10000) | No |
| amount_usd | Float | No |
| currency | String(10000) | No |
| amount_local | Float | No |
| activated_at | Datetime | No |
| expires_at | Datetime | No |
| created_at | Datetime | Yes |
| updated_at | Datetime | Yes |

### `work_sessions`

| Attribute | Type | Required |
|---|---|---|
| handler_id | String(36) | Yes |
| farm_qr_id | String(36) | No |
| clock_in | Datetime | Yes |
| clock_out | Datetime | No |
| gps_lat | Float | No |
| gps_lon | Float | No |
| created_at | Datetime | Yes |

---

## 5. Indexes to create

| Collection | Index | Type | Attributes |
|---|---|---|---|
| market_messages | idx_thread | key | thread_key, $createdAt |
| market_messages | idx_recipient | key | recipient_id, read_at |
| agtrans_drivers | idx_user | unique | user_id |
| agtrans_drivers | idx_approval | key | approval_status |
| agtrans_requests | idx_supplier | key | supplier_id |
| agtrans_requests | idx_driver | key | driver_id, status |
| farmer_inputs | idx_crop_region | key | crop_name, region |
| buyer_orders | idx_status | key | status |
| profiles | idx_user | unique | user_id |
| user_roles | idx_user_role | unique | user_id, role |
| harvest_records / inventory_items / sales_records / labor_records / land_costs | idx_user | key | user_id |
| disaster_alerts | idx_active | key | active, $createdAt |

---

## 6. Storage buckets

| Bucket | Appwrite settings |
|---|---|
| `agtrans-licenses` | Private. Max 10 MB. Allowed: jpg, jpeg, png, webp, pdf. File permission `read(user:<owner>)` + `read(team:admin)`. Admins open documents via a Function that issues a short-lived view URL — never a public URL. |
| `drone-media` | Private. Owner + admin read. |
| `handler-evidence` | Public read, authenticated create. |
| `harvest-photos` | Public read, authenticated create. |
| `supply-images` | Public read, authenticated create. |

---

## 7. Functions to port

| Current Edge Function | Appwrite Function | Secrets |
|---|---|---|
| admin-agtrans-drivers | admin-agtrans-drivers | APPWRITE_API_KEY, SMS key |
| send-sms | send-sms | AFRICASTALKING_API_KEY |
| weather / weather-proxy / weather-sms-alerts | same names | OPENWEATHERMAP_API_KEY, TOMORROW_IO_API_KEY |
| dipa-ai / dipa-vision / dipa-flight-ops / dipa-intelligence / dipa-route-generator | same names | AI provider key |
| agro-recommendation, crop-advisory, drone-advisory | same names | AI provider key |
| paystack-init / paystack-verify | same names | PAYSTACK_SECRET_KEY |
| aih-gateway, agtrans-broadcast, agtrans-ai-advisor, create-handler | same names | APPWRITE_API_KEY |
| `admin_overview_stats` (SQL) | admin-overview-stats (new) | APPWRITE_API_KEY |

Handler shape change:

```js
// Appwrite Node function
export default async ({ req, res, log }) => {
  const body = JSON.parse(req.bodyRaw || "{}");
  // ...same logic as the Deno handler
  return res.json({ ok: true });
};
```

Admin authorisation inside functions: verify the JWT with
`new Client().setJWT(req.headers['x-appwrite-user-jwt'])` and check the caller is
in the `admin` team before performing privileged reads or writes.

---

## 8. Realtime mapping

```ts
// Before (Supabase)
supabase.channel('x').on('postgres_changes',
  { event: '*', schema: 'public', table: 'agtrans_drivers' }, handler).subscribe();

// After (Appwrite)
client.subscribe(
  `databases.${DB}.collections.agtrans_drivers.documents`,
  handler,
);
```

Collections that must stay realtime for the app to behave correctly:
`agtrans_drivers`, `agtrans_requests`, `agtrans_tracking_events`,
`transport_notifications`, `transport_agreements`, `delivery_jobs`,
`tracking_sessions`, `market_messages`, `market_presence`, `market_contracts`,
`farmer_inputs`, `buyer_orders`, `price_intelligence`, `disaster_alerts`,
`profiles`, `activity`, `handlers`, `farm_qr_codes`, `user_alert_events`,
`user_subscriptions`.

---

## 9. Data migration

1. Export every table to JSON:

```bash
psql -At -c "select json_agg(t) from public.<table> t" > <table>.json
```

2. Import with the Node server SDK, preserving IDs and applying per-document
   permissions:

```js
import { Client, Databases, Permission, Role, ID } from 'node-appwrite';
const db = new Databases(new Client()
  .setEndpoint(process.env.ENDPOINT).setProject(process.env.PROJECT).setKey(process.env.API_KEY));

for (const row of rows) {
  const { id, created_at, updated_at, ...data } = row;
  await db.createDocument(DB, COLLECTION, id ?? ID.unique(), data, [
    Permission.read(Role.user(row.user_id)),
    Permission.update(Role.user(row.user_id)),
    Permission.delete(Role.user(row.user_id)),
  ]);
}
```

3. Users: export `auth.users` (id, email, phone, metadata) and create them with
   `users.create(id, email, phone, hash, name)`. Supabase bcrypt hashes can be
   imported with `users.createBcryptUser()` so passwords keep working.
4. Roles: for each `user_roles` row, add the user to the matching Appwrite team.
5. Storage: download each object and re-upload with `storage.createFile()`,
   then rewrite the stored path in `license_url`, `image_url`, `photos`, and
   `vehicle_images` fields.

---

## 10. Frontend switch-over

- Replace `src/integrations/supabase/client.ts` with an Appwrite client module
  exporting `account`, `databases`, `storage`, `functions`.
- Map calls:
  `.from(t).select()` → `databases.listDocuments(DB, t, [Query...])`,
  `.insert()` → `createDocument`, `.update().eq()` → `updateDocument`,
  `.delete().eq()` → `deleteDocument`, `.rpc()`/`functions.invoke()` →
  `functions.createExecution`.
- Auth: `signUp/signInWithPassword` → `account.create` / `account.createEmailPasswordSession`;
  `onAuthStateChange` → poll `account.get()` on mount plus session events.
- Keep the thread-key isolation logic in `src/hooks/useMarketChat.ts` unchanged;
  it works identically with Appwrite queries.

---

## 11. Cut-over checklist

- [ ] All collections, attributes, and indexes created
- [ ] Permission recipes applied and verified with a non-owner account
- [ ] Users and password hashes imported; teams populated
- [ ] Storage files copied and URLs rewritten
- [ ] Functions deployed with secrets bound
- [ ] Realtime subscriptions verified on driver approvals and chat
- [ ] Admin overview aggregates match direct counts
- [ ] Read-only freeze on the old backend, final delta import, DNS/env swap
