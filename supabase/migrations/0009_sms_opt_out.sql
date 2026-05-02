-- Customer-level opt-out: when true, NO transactional SMS is sent for any
-- booking by this customer. Set via admin UI when the customer calls in
-- to request opt-out.
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS sms_opt_out boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS sms_opt_out_at timestamptz,
ADD COLUMN IF NOT EXISTS sms_opt_out_reason text;

COMMENT ON COLUMN public.customers.sms_opt_out IS
  'When true, customer has opted out of all transactional SMS (booking confirmation + reminder). Set via admin UI when customer calls in to request opt-out.';

-- Per-booking flag: barber can disable SMS for a single booking when
-- creating it on the customer's behalf.
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS send_sms boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.bookings.send_sms IS
  'When false, no booking confirmation or 24h reminder SMS is sent for this booking. Set by admin via Opret booking checkbox. Customer-level customers.sms_opt_out also forces this to false at booking creation time.';

-- Update create_booking RPC: accept p_send_sms parameter and store
-- bookings.send_sms = p_send_sms AND NOT customer.sms_opt_out so that
-- customer-level opt-out always wins over per-booking flag.
CREATE OR REPLACE FUNCTION public.create_booking(
  p_phone text,
  p_full_name text,
  p_email text,
  p_notes text,
  p_barber_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_marketing_opt_in boolean DEFAULT false,
  p_send_sms boolean DEFAULT true
) RETURNS TABLE(booking_id uuid, short_code text, cancel_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_customer_id uuid;
  v_customer_opt_out boolean;
  v_service record;
  v_booking record;
  v_effective_send_sms boolean;
begin
  v_customer_id := public.resolve_customer(p_phone, p_full_name, p_email, p_marketing_opt_in);

  select sms_opt_out into v_customer_opt_out
  from public.customers
  where id = v_customer_id;

  v_effective_send_sms := coalesce(p_send_sms, true) and not coalesce(v_customer_opt_out, false);

  select * into v_service from public.services where id = p_service_id and is_active;
  if not found then raise exception 'service_not_found'; end if;

  insert into public.bookings (customer_id, barber_id, service_id, starts_at, ends_at,
                               duration_minutes, price_ore, customer_notes, source, send_sms)
  values (v_customer_id, p_barber_id, p_service_id,
          p_starts_at, p_starts_at + (v_service.duration_minutes || ' minutes')::interval,
          v_service.duration_minutes, v_service.price_ore, nullif(p_notes,''), 'web',
          v_effective_send_sms)
  returning id, bookings.short_code, bookings.cancel_token into v_booking;

  return query select v_booking.id, v_booking.short_code, v_booking.cancel_token;
exception
  when exclusion_violation then raise exception 'slot_taken';
end $function$;

-- Re-grant: anon + authenticated keep execute privilege on the new signature.
REVOKE ALL ON FUNCTION public.create_booking(text,text,text,text,uuid,uuid,timestamptz,boolean,boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.create_booking(text,text,text,text,uuid,uuid,timestamptz,boolean,boolean) TO anon, authenticated;
