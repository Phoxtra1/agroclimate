# AGTrans Module (Transport & Logistics)

## Overview
The AGTrans module integrates logistics and transport request workflows into AgroClimate. It connects suppliers (farmers/cooperatives) directly to a network of verified transport drivers, ensuring seamless tracking and fair pricing.

## Key Features
- **Supplier Transport Requests:** Farmers can broadcast requests from MarketLink -> AGTrans tab. 
- **Driver Workspace:** A dedicated portal (`/agtrans-partner`) for drivers to view available loads, accept trips, and receive optimized routing.
- **AI Tracking & Routing:** Powered by `agtrans-ai-advisor`, the system tracks location, provides route optimizations, and monitors for route deviations to prevent theft or delays.
- **Admin Control Panel:** Admins can verify new driver licenses and handle any disputed trips or delivery issues.

## Data Structures
- `transport_requests`: Stores trip requirements, pricing, pickup/dropoff, status (`pending`, `accepted`, `in_transit`, `delivered`, `disputed`), and driver assignment.
- `agtrans_drivers`: Driver profiles storing vehicle type, verification status, rating, and total trips.

## Edge Functions
- `agtrans-broadcast`: Alerts available, verified drivers in the region about newly posted transport requests.
- `agtrans-ai-advisor`: Tracks GPS pings, identifies route deviations, and recommends traffic/climate-optimized routes.
