-- ============================================================
-- RLS VERIFICATION SCRIPT
-- Run in Supabase SQL Editor to verify policies are correct
-- Expected results are in comments after each query
-- ============================================================

-- 1. Test anon can read active services
-- EXPECTED: 5 rows (all services)
set role anon;
select count(*) as anon_services from public.services;

-- 2. Test anon CANNOT read customers
-- EXPECTED: 0 rows (RLS blocks)
select count(*) as anon_customers from public.customers;

-- 3. Test anon can read active barbers
-- EXPECTED: 3 rows
select count(*) as anon_barbers from public.barbers;

-- 4. Test anon can read settings
-- EXPECTED: 16 rows
select count(*) as anon_settings from public.settings;

-- 5. Test anon can read barber_hours
-- EXPECTED: rows for all barber working schedules
select count(*) as anon_hours from public.barber_hours;

-- 6. Test anon can read holidays
-- EXPECTED: 0 rows (none seeded, but access allowed)
select count(*) as anon_holidays from public.holidays;

-- 7. Test anon CANNOT read SMS templates
-- EXPECTED: 0 rows (RLS blocks)
select count(*) as anon_sms_templates from public.sms_templates;

-- 8. Test anon CANNOT read audit log
-- EXPECTED: 0 rows (RLS blocks)
select count(*) as anon_audit from public.audit_log;

-- 9. Test anon CANNOT read bookings
-- EXPECTED: 0 rows (RLS blocks)
select count(*) as anon_bookings from public.bookings;

-- Reset role
reset role;

-- 10. Verify exclusion constraint setup
-- EXPECTED: constraint 'no_overlap_per_barber' exists
select conname from pg_constraint where conname = 'no_overlap_per_barber';
