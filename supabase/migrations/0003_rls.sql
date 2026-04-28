-- ============================================================
-- Row-Level Security policies
-- Three roles: anon (booking flow), barber (own schedule), super_admin (everything)
-- ============================================================

-- Enable RLS on all tables
alter table public.barbers          enable row level security;
alter table public.services         enable row level security;
alter table public.barber_services  enable row level security;
alter table public.barber_hours     enable row level security;
alter table public.time_off         enable row level security;
alter table public.holidays         enable row level security;
alter table public.customers        enable row level security;
alter table public.customer_notes   enable row level security;
alter table public.note_tags        enable row level security;
alter table public.bookings         enable row level security;
alter table public.settings         enable row level security;
alter table public.gallery_images   enable row level security;
alter table public.sms_templates    enable row level security;
alter table public.sms_log          enable row level security;
alter table public.audit_log        enable row level security;

-- BARBERS: public read active, admin write
create policy public_read_barbers on public.barbers for select using (is_active = true);
create policy admin_write_barbers on public.barbers for all using (public.is_super_admin()) with check (public.is_super_admin());

-- SERVICES: public read active, admin write
create policy public_read_services on public.services for select using (is_active = true);
create policy admin_write_services on public.services for all using (public.is_super_admin()) with check (public.is_super_admin());

-- BARBER_SERVICES: public read, admin write
create policy public_read_bs on public.barber_services for select using (true);
create policy admin_write_bs on public.barber_services for all using (public.is_super_admin()) with check (public.is_super_admin());

-- BARBER_HOURS: public read (for availability), admin write
create policy public_read_hours on public.barber_hours for select using (true);
create policy admin_write_hours on public.barber_hours for all using (public.is_super_admin()) with check (public.is_super_admin());

-- HOLIDAYS: public read (for availability), admin write
create policy public_read_holidays on public.holidays for select using (true);
create policy admin_write_holidays on public.holidays for all using (public.is_super_admin()) with check (public.is_super_admin());

-- TIME_OFF: public read (for availability), barber/admin write
create policy public_read_timeoff on public.time_off for select using (true);
create policy barber_write_timeoff on public.time_off for all
  using (public.is_super_admin() or barber_id = public.current_barber_id())
  with check (public.is_super_admin() or barber_id = public.current_barber_id());

-- SETTINGS: public read, admin write
create policy public_read_settings on public.settings for select using (true);
create policy admin_write_settings on public.settings for all using (public.is_super_admin()) with check (public.is_super_admin());

-- GALLERY: public read published, admin write
create policy public_read_gallery on public.gallery_images for select using (is_published = true);
create policy admin_write_gallery on public.gallery_images for all using (public.is_super_admin()) with check (public.is_super_admin());

-- SMS_TEMPLATES: barber/admin read, admin write
create policy admin_read_sms_tpl on public.sms_templates for select using (public.is_barber());
create policy admin_write_sms_tpl on public.sms_templates for all using (public.is_super_admin()) with check (public.is_super_admin());

-- CUSTOMERS: barber/admin read, admin write (anon NEVER reads)
create policy barber_read_customers on public.customers for select using (public.is_barber());
create policy admin_write_customers on public.customers for all using (public.is_super_admin()) with check (public.is_super_admin());

-- CUSTOMER_NOTES: barber/admin read, barber/admin insert (own), author/admin update
create policy barber_read_notes on public.customer_notes for select using (public.is_barber());
create policy barber_insert_notes on public.customer_notes for insert with check (public.is_barber() and author_id = auth.uid());
create policy author_update_notes on public.customer_notes for update
  using (public.is_super_admin() or author_id = auth.uid())
  with check (public.is_super_admin() or author_id = auth.uid());

-- NOTE_TAGS: public read, admin write
create policy public_read_tags on public.note_tags for select using (true);
create policy admin_write_tags on public.note_tags for all using (public.is_super_admin()) with check (public.is_super_admin());

-- BOOKINGS: barber/admin read, barber/admin update own, admin insert
-- Anon creates bookings ONLY via the create_booking RPC (SECURITY DEFINER bypasses RLS)
create policy barber_read_bookings on public.bookings for select using (public.is_barber());
create policy barber_update_bookings on public.bookings for update
  using (public.is_super_admin() or barber_id = public.current_barber_id())
  with check (public.is_super_admin() or barber_id = public.current_barber_id());
create policy admin_insert_bookings on public.bookings for insert with check (public.is_super_admin());

-- SMS_LOG: barber/admin read only (system writes via service role)
create policy barber_read_smslog on public.sms_log for select using (public.is_barber());

-- AUDIT_LOG: super-admin read only (system writes via service role)
create policy admin_read_audit on public.audit_log for select using (public.is_super_admin());
