-- Shop-wide internal notes / memo board
create table public.shop_notes (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  author_id uuid references auth.users(id),
  author_name text,
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index on public.shop_notes (created_at desc);
create index on public.shop_notes (is_resolved, created_at desc);

-- RLS: barber/admin can read and write
alter table public.shop_notes enable row level security;

create policy barber_read_shop_notes on public.shop_notes
  for select using (public.is_barber());

create policy barber_insert_shop_notes on public.shop_notes
  for insert with check (public.is_barber());

create policy barber_update_shop_notes on public.shop_notes
  for update using (public.is_barber())
  with check (public.is_barber());
