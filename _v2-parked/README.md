# V2 Parked Code

This folder contains components, hooks, and utilities removed from V1 to keep the booking system clean and focused. All code here is **functional** and was working when parked. Do not modify these files — they exist as a snapshot for V2 reactivation.

## What's here

### oekonomi-and-ai/
The full Økonomi page (14 sections) and the two AI-driven features that wrapped it.

- **OekonomiPage** — comprehensive financial dashboard with KPIs, forecasting, revenue chart, per-barber leaderboard, per-service breakdown, payment splits, missed revenue, customer insights, hourly heatmap, Moms (VAT) calculator with PDF export, CSV exports, custom alerts, and Z-rapport.
- **BusinessOverview** — AI-generated narrative business summary with stats pills and "Sidst opdateret" timestamp. Calls the `generate-business-overview` Edge Function.
- **Customer AI profiles** — automatic profile generation triggered after every "Hvad blev lavet?" note save. Calls the `generate-customer-profile` Edge Function.

## Reactivation for V2

The full reactivation guide lives outside this repo at:
`C:\Pouret Digital 101\agency\v2-roadmap\economy-system-v2.md`

For a quick local rebuild within this repo:

1. Move files back from `_v2-parked/oekonomi-and-ai/*` to their original paths (the original paths are documented at the top of each file as a comment, or can be inferred from the folder structure).
2. Add the route back to `src/App.tsx`:
   ```tsx
   import OekonomiPage from './pages/admin/OekonomiPage'
   <Route path="/admin/oekonomi" element={<ProtectedRoute><OekonomiPage /></ProtectedRoute>} />
   ```
3. Add the sidebar entry back to AdminLayout (Økonomi between Overblik and Opret booking, with TrendingUp icon).
4. Reinstate the AI-profile section in `src/pages/admin/CustomersPage.tsx` (look for the "Sidste klip" section that replaced it — replace it back with the AI-profil fetch + display).
5. Reinstate the `BusinessOverview` import in `src/pages/admin/InsightsPage.tsx` (Overblik) — wherever the simple V1 version is, swap it back.
6. Reinstate the `generate-customer-profile` invocation after note save in `src/pages/admin/BookingDetailPage.tsx` and `src/pages/admin/CustomersPage.tsx`.

## Edge Functions

The two Edge Functions remain deployed in Supabase and idle — nothing calls them in V1. They will reactivate automatically when V2 caller code is added back.

- `generate-customer-profile` (project fzcwnkmeftoigkhjhcvs)
- `generate-business-overview` (project fzcwnkmeftoigkhjhcvs)

## Database

The Supabase tables `customer_ai_profiles`, `business_overviews`, `alert_rules`, and `alert_triggers` remain in place. They sit empty/unused in V1.

## Migrations

The migrations that created these tables are intact and applied. No rollback needed for V1 — the tables just go unused.
