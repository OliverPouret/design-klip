-- ============================================================
-- Design Klip — Full database schema
-- Run this in Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "btree_gist";

-- ============================================================
-- Generic updated_at trigger
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ============================================================
-- BARBERS
-- ============================================================
create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  display_name text not null,
  bio text,
  photo_url text,
  profile_color text default '#B08A3E',
  user_id uuid unique references auth.users(id) on delete set null,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger barbers_updated before update on public.barbers
  for each row execute function public.set_updated_at();

-- ============================================================
-- SERVICES
-- ============================================================
create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_da text not null,
  name_en text,
  description_da text,
  description_en text,
  duration_minutes int not null check (duration_minutes between 5 and 240),
  price_ore int not null check (price_ore >= 0),
  category text,
  photo_url text,
  requires_deposit boolean not null default false,
  deposit_ore int default 0,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger services_updated before update on public.services
  for each row execute function public.set_updated_at();

-- ============================================================
-- BARBER <> SERVICE many-to-many
-- ============================================================
create table public.barber_services (
  barber_id uuid not null references public.barbers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (barber_id, service_id)
);
create index on public.barber_services (service_id);

-- ============================================================
-- BARBER WORKING HOURS (recurring, per weekday)
-- isoweekday: 1=Monday … 7=Sunday
-- ============================================================
create table public.barber_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  isoweekday smallint not null check (isoweekday between 1 and 7),
  opens_at time,
  closes_at time,
  unique (barber_id, isoweekday),
  check ((opens_at is null and closes_at is null)
      or (opens_at is not null and closes_at is not null and closes_at > opens_at))
);

-- ============================================================
-- TIME OFF (one-off blocks: sick, vacation, blocked slot)
-- ============================================================
create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid references public.barbers(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  reason text,
  is_all_day boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on public.time_off (barber_id, starts_at, ends_at);

-- ============================================================
-- HOLIDAYS (shop-wide closures, full days)
-- ============================================================
create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  closed_date date not null unique,
  label text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null unique,
  full_name text not null,
  email citext,
  marketing_opt_in boolean not null default false,
  notes_summary text,
  total_bookings int not null default 0,
  last_booking_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  anonymized_at timestamptz
);
create index on public.customers (last_booking_at desc);
create trigger customers_updated before update on public.customers
  for each row execute function public.set_updated_at();

-- ============================================================
-- CUSTOMER NOTES (internal CRM, threaded)
-- ============================================================
create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  author_id uuid references auth.users(id),
  body text not null,
  tags text[] default '{}',
  created_at timestamptz not null default now()
);
create index on public.customer_notes (customer_id, created_at desc);

-- ============================================================
-- NOTE TAG TEMPLATES
-- ============================================================
create table public.note_tags (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  display_order int not null default 0
);

-- ============================================================
-- BOOKINGS
-- ============================================================
create type booking_status as enum
  ('pending','confirmed','completed','cancelled','no_show');

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  short_code text unique not null
    default upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
  customer_id uuid not null references public.customers(id) on delete restrict,
  barber_id uuid not null references public.barbers(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  duration_minutes int not null,
  price_ore int not null,
  status booking_status not null default 'confirmed',
  customer_notes text,
  cancel_token uuid not null default gen_random_uuid() unique,
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by in ('customer','barber','admin','system')),
  cancellation_reason text,
  reminder_sent_at timestamptz,
  confirmation_sent_at timestamptz,
  source text default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.bookings (barber_id, starts_at);
create index on public.bookings (customer_id, starts_at desc);
create index on public.bookings (starts_at) where status in ('confirmed','pending');
create index on public.bookings (cancel_token);

-- Anti-double-booking: no two confirmed/pending bookings can overlap for same barber
alter table public.bookings
  add constraint no_overlap_per_barber
  exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending','confirmed'));

create trigger bookings_updated before update on public.bookings
  for each row execute function public.set_updated_at();

-- ============================================================
-- SETTINGS (CMS key/value store)
-- ============================================================
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- ============================================================
-- GALLERY IMAGES
-- ============================================================
create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  url text not null,
  caption_da text,
  caption_en text,
  alt_text text,
  width int,
  height int,
  display_order int not null default 0,
  is_published boolean not null default true,
  uploaded_by uuid references auth.users(id),
  consent_record_id uuid,
  created_at timestamptz not null default now()
);
create index on public.gallery_images (display_order) where is_published;

-- ============================================================
-- SMS TEMPLATES
-- ============================================================
create table public.sms_templates (
  id text primary key,
  name_da text not null,
  body_da text not null,
  body_en text,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- ============================================================
-- SMS LOG
-- ============================================================
create table public.sms_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  template_id text references public.sms_templates(id),
  to_phone text not null,
  body text not null,
  provider text not null default 'gatewayapi',
  provider_message_id text,
  status text default 'queued',
  error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.sms_log (booking_id);
create index on public.sms_log (created_at desc);

-- ============================================================
-- AUDIT LOG
-- ============================================================
create table public.audit_log (
  id bigserial primary key,
  actor_id uuid references auth.users(id),
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip inet,
  created_at timestamptz not null default now()
);
create index on public.audit_log (entity_type, entity_id);
create index on public.audit_log (created_at desc);
