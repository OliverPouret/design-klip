-- ============================================================
-- RLS helper functions
-- ============================================================
create or replace function public.current_role() returns text
language sql stable as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role'),
    case when auth.uid() is null then 'anon' else 'authenticated' end
  );
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable as $$ select public.current_role() = 'super_admin' $$;

create or replace function public.is_barber() returns boolean
language sql stable as $$ select public.current_role() in ('barber','super_admin') $$;

create or replace function public.current_barber_id() returns uuid
language sql stable as $$
  select id from public.barbers where user_id = auth.uid() limit 1
$$;

-- ============================================================
-- Phone-resolves-customer function
-- Called during booking to find or create a customer by phone
-- ============================================================
create or replace function public.resolve_customer(
  p_phone text,
  p_full_name text,
  p_email text default null,
  p_marketing_opt_in boolean default false
) returns uuid language plpgsql security definer as $$
declare
  v_normalised text;
  v_id uuid;
begin
  -- Normalise: strip spaces/dashes, add +45 if 8-digit Danish number
  v_normalised := regexp_replace(p_phone, '\s|-', '', 'g');
  if v_normalised !~ '^\+' then
    if length(v_normalised) = 8 then
      v_normalised := '+45' || v_normalised;
    end if;
  end if;

  insert into public.customers (phone_e164, full_name, email, marketing_opt_in)
  values (v_normalised, p_full_name, nullif(p_email,''), p_marketing_opt_in)
  on conflict (phone_e164) do update
    set full_name = coalesce(public.customers.full_name, excluded.full_name),
        email = coalesce(public.customers.email, excluded.email),
        updated_at = now()
  returning id into v_id;

  return v_id;
end $$;

-- ============================================================
-- Booking stats trigger (keeps customer.total_bookings and last_booking_at updated)
-- ============================================================
create or replace function public.bump_customer_stats()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT' and new.status in ('confirmed','pending')) then
    update public.customers
      set total_bookings = total_bookings + 1,
          last_booking_at = greatest(coalesce(last_booking_at, '-infinity'), new.starts_at)
      where id = new.customer_id;
  end if;
  return new;
end $$;
create trigger bookings_bump_customer
after insert on public.bookings
for each row execute function public.bump_customer_stats();

-- ============================================================
-- Create booking atomically (anon-safe RPC)
-- Resolves customer, validates service, inserts booking
-- Returns booking_id, short_code, cancel_token
-- ============================================================
create or replace function public.create_booking(
  p_phone text, p_full_name text, p_email text, p_notes text,
  p_barber_id uuid, p_service_id uuid, p_starts_at timestamptz,
  p_marketing_opt_in boolean default false
) returns table(booking_id uuid, short_code text, cancel_token uuid)
language plpgsql security definer set search_path = public as $$
declare v_customer_id uuid; v_service record; v_booking record;
begin
  v_customer_id := public.resolve_customer(p_phone, p_full_name, p_email, p_marketing_opt_in);
  select * into v_service from public.services where id = p_service_id and is_active;
  if not found then raise exception 'service_not_found'; end if;

  insert into public.bookings (customer_id, barber_id, service_id, starts_at, ends_at,
                               duration_minutes, price_ore, customer_notes, source)
  values (v_customer_id, p_barber_id, p_service_id,
          p_starts_at, p_starts_at + (v_service.duration_minutes || ' minutes')::interval,
          v_service.duration_minutes, v_service.price_ore, nullif(p_notes,''), 'web')
  returning id, bookings.short_code, bookings.cancel_token into v_booking;

  return query select v_booking.id, v_booking.short_code, v_booking.cancel_token;
exception
  when exclusion_violation then raise exception 'slot_taken';
end $$;
revoke all on function public.create_booking(text,text,text,text,uuid,uuid,timestamptz,boolean) from public;
grant execute on function public.create_booking(text,text,text,text,uuid,uuid,timestamptz,boolean) to anon, authenticated;

-- ============================================================
-- Cancel booking by token (anon-safe RPC)
-- ============================================================
create or replace function public.cancel_booking_by_token(p_token uuid)
returns table(ok boolean) language plpgsql security definer as $$
begin
  update public.bookings
     set status = 'cancelled', cancelled_at = now(), cancelled_by = 'customer'
   where cancel_token = p_token and status in ('confirmed','pending');
  return query select found;
end $$;
grant execute on function public.cancel_booking_by_token(uuid) to anon, authenticated;

-- ============================================================
-- Audit log trigger (generic — attach to any editable table)
-- ============================================================
create or replace function public.audit_change()
returns trigger language plpgsql security definer as $$
begin
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, before, after)
  values (auth.uid(), public.current_role(),
          tg_op || '.' || tg_table_name, tg_table_name,
          coalesce(new.id, old.id),
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

-- Attach audit triggers to editable tables
create trigger audit_services after insert or update or delete on public.services for each row execute function public.audit_change();
create trigger audit_barbers after insert or update or delete on public.barbers for each row execute function public.audit_change();
create trigger audit_settings after insert or update or delete on public.settings for each row execute function public.audit_change();
create trigger audit_sms_templates after insert or update or delete on public.sms_templates for each row execute function public.audit_change();
create trigger audit_gallery after insert or update or delete on public.gallery_images for each row execute function public.audit_change();
create trigger audit_holidays after insert or update or delete on public.holidays for each row execute function public.audit_change();
create trigger audit_time_off after insert or update or delete on public.time_off for each row execute function public.audit_change();
