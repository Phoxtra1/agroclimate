# AgroClimate Appwrite Self-Host Migration Guide

## 1. Core setup

- Create an Appwrite project for AgroClimate.
- Enable email/password authentication.
- Create one storage bucket for handler evidence uploads.
- Create one messaging integration for SMS or push if needed.

## 2. Collections and attributes

### profiles
- user_id: string (required, indexed)
- display_name: string
- phone: string
- country: string (default: "Ghana")
- region: string
- district: string
- community: string
- preferred_language: string (default: "en")
- farm_size: string
- farmer_type: string (default: "smallholder")
- drone_ownership: boolean (default: false)
- drone_type: string

### user_roles
- user_id: string (required, indexed)
- role: string (required)

Allowed values:
- admin
- moderator
- user
- handler

### disaster_alerts
- title: string (required)
- description: string
- severity: string (default: "warning")
- alert_type: string (required)
- affected_regions: string[] (array)
- active: boolean (default: true)
- expires_at: datetime
- created_by: string

### user_alerts
- user_id: string (required, indexed)
- alert_id: string (required)
- is_read: boolean (default: false)
- is_dismissed: boolean (default: false)

### farmer_crops
- user_id: string (required, indexed)
- crop_name: string (required)

### fish_ponds
- user_id: string (required, indexed)
- name: string (required)
- species: string (required)
- pond_size_sqm: number
- stock_count: number (default: 0)
- water_temp: number
- ph_level: number
- dissolved_oxygen: number
- feeding_schedule: string (default: "twice_daily")
- last_feeding: datetime
- notes: string

### inventory_items
- user_id: string (required, indexed)
- item_name: string (required)
- item_type: string (required)
- quantity: number (default: 0)
- unit: string (default: "kg")
- price_per_unit: number (default: 0)
- crop_name: string
- farm_plot: string
- season: string
- notes: string

### harvest_records
- user_id: string (required, indexed)
- crop_name: string (required)
- quantity: number (default: 0)
- unit: string (default: "kg")
- harvest_date: datetime
- quality_grade: string
- farm_plot: string
- season: string
- notes: string

### harvest_losses
- user_id: string (required, indexed)
- crop_name: string (required)
- quantity_lost: number (default: 0)
- unit: string (default: "kg")
- loss_reason: string (default: "spoilage")
- farm_plot: string
- season: string
- notes: string

### sales_records
- user_id: string (required, indexed)
- crop_name: string (required)
- quantity_sold: number (default: 0)
- unit: string (default: "kg")
- price_per_unit: number (default: 0)
- buyer_name: string
- sale_date: datetime
- farm_plot: string
- season: string
- notes: string

### labor_records
- user_id: string (required, indexed)
- task_description: string (required)
- days_worked: number (default: 1)
- worker_count: number (default: 1)
- cost_per_day: number (default: 0)
- crop_name: string
- farm_plot: string
- season: string
- notes: string

### land_costs
- user_id: string (required, indexed)
- land_description: string (required)
- size_acres: number (default: 0)
- cost_amount: number (default: 0)
- cost_type: string (default: "rent")
- farm_plot: string
- season: string
- notes: string

### support_tickets
- user_id: string (required, indexed)
- subject: string (required)
- description: string (required)
- category: string (default: "general")
- priority: string (default: "normal")
- status: string (default: "open")
- location: string

### handlers
- user_id: string (required, indexed)
- farmer_id: string (required, indexed)
- handler_name: string (required)
- handler_type: string (default: "labourer")
- assigned_farm: string
- status: string (default: "active")

Allowed handler_type values:
- labourer
- supervisor

### handler_tasks
- farmer_id: string (required, indexed)
- handler_id: string (required, indexed)
- title: string (required)
- description: string
- field_location: string
- deadline: datetime
- evidence_required: boolean (default: false)
- quantity_label: string
- quantity_expected: number
- quantity_completed: number
- status: string (default: "pending")
- completed_at: datetime

### work_sessions
- handler_id: string (required, indexed)
- farm_qr_id: string
- clock_in: datetime (required)
- clock_out: datetime
- gps_lat: number
- gps_lon: number

### task_evidence
- task_id: string (required, indexed)
- handler_id: string (required, indexed)
- evidence_type: string (default: "photo")
- file_url: string
- notes: string
- device_id: string
- gps_lat: number
- gps_lon: number

### handler_issues
- handler_id: string (required, indexed)
- farmer_id: string (required, indexed)
- issue_type: string (required)
- description: string
- status: string (default: "open")
- photo_url: string
- gps_lat: number
- gps_lon: number

### farm_qr_codes
- farmer_id: string (required, indexed)
- farm_name: string (required)
- farm_location: string
- qr_code_data: string (required)

### drone_missions
- user_id: string (required, indexed)
- mission_type: string (default: "monitoring")
- target_location: string
- target_lat: number
- target_lon: number
- planned_date: datetime
- drone_type: string
- altitude_m: number
- status: string (default: "planned")
- advisory_result: string
- notes: string

## 3. Permissions model

- **profiles**: each signed-in user can read and update only their own profile. Admins can read/update all.
- **user_roles**: user reads their own role, only admins manage roles.
- **user_alerts**: each user manages (read, create, update, delete) only their own alert states.
- **disaster_alerts**: active alerts readable by all signed-in users, only admins publish alerts.
- **handlers**: farmer manages their own handlers, handler reads only their own handler record. Admins can view all.
- **handler_tasks**: farmer manages tasks they created, assigned handler can read and update assigned tasks.
- **work_sessions, task_evidence, handler_issues**: handler manages own records, farmer reads records for handlers they own. Admins can view all.
- **farm_qr_codes**: farmer manages own QR codes, all authenticated users can read (for scanning).
- **All other tables** (farmer_crops, fish_ponds, inventory_items, harvest_records, harvest_losses, sales_records, labor_records, land_costs): user can only CRUD their own records.
- **support_tickets**: user can create and view own tickets, admins can view and update all.

## 4. Alert architecture

The system generates alerts from multiple domains based on real-time weather:
- **Weather**: rain, heat, wind, dry spells
- **Crops**: fungal disease risk, wilt stress, planting conditions
- **Livestock**: heat stress, shelter advisories
- **Aquaculture**: pond temperature, overflow risk
- **Environment**: bush fire risk, drought
- **Flight**: no-fly zone precautions

Alert delivery channels:
- **Dashboard**: real-time cards with mark-read, dismiss, and delete actions
- **Browser notifications**: prompted on first visit, sent for critical (danger) alerts
- **SMS**: triggered for critical weather via weather-sms-alerts backend function to all users with phone numbers

Alert IDs are deterministic (prefix + location + date) ensuring stable read/dismiss states across sessions.

## 5. Backend functions to recreate

- **create-handler**: create auth account, assign handler role, create handler profile, auto-cleanup on failure.
- **weather**: fetch live weather and daily forecast from Tomorrow.io.
- **weather-sms-alerts**: evaluate critical conditions and send SMS alerts to users with phone numbers, with 6-hour deduplication.
- **crop-advisory**: generate crop guidance using AI.
- **dipa-ai**: AI advisory and research responses.
- **send-sms**: single-message delivery helper.
- **drone-advisory**: flight condition analysis.

## 6. Storage

- Bucket name: handler-evidence
- Store files by path pattern: `{handlerId}/{taskId}/{timestamp_filename}`
- Keep read access limited to owning handler and related farmer workflows.

## 7. Indexing recommendations

- profiles.user_id
- user_roles.user_id
- handlers.farmer_id
- handlers.user_id
- handler_tasks.farmer_id
- handler_tasks.handler_id
- work_sessions.handler_id
- task_evidence.task_id
- task_evidence.handler_id
- handler_issues.handler_id
- handler_issues.farmer_id
- disaster_alerts.active
- user_alerts.user_id
- user_alerts.alert_id
- drone_missions.user_id

## 8. Migration order

1. Create auth users.
2. Create profiles.
3. Create user_roles.
4. Create operational collections (handlers, handler_tasks, etc.).
5. Create alert collections (disaster_alerts, user_alerts).
6. Create inventory/business collections.
7. Create indexes.
8. Apply document permissions.
9. Rebuild backend functions.
10. Migrate storage objects.
11. Run end-to-end tests for login, handlers, alerts, weather, and evidence uploads.
