# AgroClimate Appwrite Self-Host Migration Guide

## 1. Core setup

- Create an Appwrite project for AgroClimate.
- Enable email/password authentication.
- Create one storage bucket for handler evidence uploads.
- Create one messaging integration for SMS or push if needed.

## 2. Collections and attributes

### profiles
- user_id: string
- display_name: string
- phone: string
- country: string
- region: string
- district: string
- community: string
- preferred_language: string
- farm_size: string
- farmer_type: string
- drone_ownership: boolean
- drone_type: string

### user_roles
- user_id: string
- role: string

Allowed values:
- admin
- moderator
- user
- handler

### disaster_alerts
- title: string
- description: string
- severity: string
- alert_type: string
- affected_regions: string[]
- active: boolean
- expires_at: datetime
- created_by: string

### user_alerts
- user_id: string
- alert_id: string
- is_read: boolean
- is_dismissed: boolean

### farmer_crops
- user_id: string
- crop_name: string

### fish_ponds
- user_id: string
- name: string
- species: string
- pond_size_sqm: number
- stock_count: number
- water_temp: number
- ph_level: number
- dissolved_oxygen: number
- feeding_schedule: string
- last_feeding: datetime
- notes: string

### inventory_items
- user_id: string
- item_name: string
- item_type: string
- quantity: number
- unit: string
- price_per_unit: number
- crop_name: string
- farm_plot: string
- season: string
- notes: string

### harvest_records
- user_id: string
- crop_name: string
- quantity: number
- unit: string
- harvest_date: datetime
- quality_grade: string
- farm_plot: string
- season: string
- notes: string

### harvest_losses
- user_id: string
- crop_name: string
- quantity_lost: number
- unit: string
- loss_reason: string
- farm_plot: string
- season: string
- notes: string

### sales_records
- user_id: string
- crop_name: string
- quantity_sold: number
- unit: string
- price_per_unit: number
- buyer_name: string
- sale_date: datetime
- farm_plot: string
- season: string
- notes: string

### labor_records
- user_id: string
- task_description: string
- days_worked: number
- worker_count: number
- cost_per_day: number
- crop_name: string
- farm_plot: string
- season: string
- notes: string

### land_costs
- user_id: string
- land_description: string
- size_acres: number
- cost_amount: number
- cost_type: string
- farm_plot: string
- season: string
- notes: string

### support_tickets
- user_id: string
- subject: string
- description: string
- category: string
- priority: string
- status: string
- location: string

### handlers
- user_id: string
- farmer_id: string
- handler_name: string
- handler_type: string
- assigned_farm: string
- status: string

Allowed handler_type values:
- labourer
- supervisor

### handler_tasks
- farmer_id: string
- handler_id: string
- title: string
- description: string
- field_location: string
- deadline: datetime
- evidence_required: boolean
- quantity_label: string
- quantity_expected: number
- quantity_completed: number
- status: string
- completed_at: datetime

### work_sessions
- handler_id: string
- farm_qr_id: string
- clock_in: datetime
- clock_out: datetime
- gps_lat: number
- gps_lon: number

### task_evidence
- task_id: string
- handler_id: string
- evidence_type: string
- file_url: string
- notes: string
- device_id: string
- gps_lat: number
- gps_lon: number

### handler_issues
- handler_id: string
- farmer_id: string
- issue_type: string
- description: string
- status: string
- photo_url: string
- gps_lat: number
- gps_lon: number

### farm_qr_codes
- farmer_id: string
- farm_name: string
- farm_location: string
- qr_code_data: string

### drone_missions
- user_id: string
- mission_type: string
- target_location: string
- target_lat: number
- target_lon: number
- planned_date: datetime
- drone_type: string
- altitude_m: number
- status: string
- advisory_result: string
- notes: string

## 3. Permissions model

- profiles: each signed-in user can read and update only their own profile.
- user_roles: user reads their own role, only admins manage roles.
- alerts state: each user manages only their own read and dismiss state.
- handlers: farmer manages their own handlers, handler reads only their own handler record.
- handler_tasks: farmer manages tasks they created, assigned handler can read and update assigned tasks.
- work_sessions, evidence, issues: handler manages own activity records, farmer reads records for handlers they own.
- disaster_alerts: active alerts readable by signed-in users, only admins or backend workers publish alerts.

## 4. Backend functions to recreate

- create-handler: create auth account, assign handler role, create handler profile.
- weather: fetch live weather and daily forecast.
- weather-sms-alerts: evaluate critical conditions and send SMS alerts.
- crop-advisory: generate crop guidance.
- odeneho-ai: AI advisory and research responses.
- send-sms: single-message delivery helper.

## 5. Storage

- Bucket name: handler-evidence
- Store files by path pattern: `{handlerId}/{taskId}/{timestamp_filename}`
- Keep read access limited to owning handler and related farmer workflows.

## 6. Indexing recommendations

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

## 7. Migration order

1. Create auth users.
2. Create profiles.
3. Create user_roles.
4. Create operational collections.
5. Create indexes.
6. Apply document permissions.
7. Rebuild backend functions.
8. Migrate storage objects.
9. Run end-to-end tests for login, handlers, alerts, weather, and evidence uploads.