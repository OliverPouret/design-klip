-- Overblik dashboard RPCs.
-- One round-trip per data slice; aggregation runs in Postgres instead of
-- pulling every booking row to the client. Salon timezone is hardcoded to
-- Europe/Copenhagen for the availability math (single-tz salon).
--
-- Status semantics:
--   * Counts / revenue / avg-ticket: confirmed + completed + pending
--     (excludes cancelled and no_show — these did not earn revenue).
--   * Booked minutes (occupancy numerator): confirmed + completed + pending
--     + no_show. A no-show still occupied the slot.
--   * Available minutes (occupancy denominator): sum over (active barber,
--     day) of (closes_at - opens_at) from barber_hours, minus shop holidays
--     and minus overlapping time_off blocks.

create or replace function public.get_overview_kpis(
  p_start_date date,
  p_end_date date,
  p_barber_id uuid default null
) returns table (
  bookings_count int,
  revenue_ore bigint,
  avg_ticket_ore int,
  booked_minutes int,
  available_minutes int,
  prev_bookings_count int,
  prev_revenue_ore bigint,
  prev_avg_ticket_ore int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_days int := (p_end_date - p_start_date) + 1;
  v_prev_start date := p_start_date - v_window_days;
  v_prev_end date := p_start_date - 1;
begin
  if not public.is_barber() then
    raise exception 'forbidden';
  end if;

  return query
  with curr_revenue as (
    select
      count(*)::int as cnt,
      coalesce(sum(b.price_ore), 0)::bigint as rev
    from public.bookings b
    where b.starts_at::date between p_start_date and p_end_date
      and b.status in ('confirmed','completed','pending')
      and (p_barber_id is null or b.barber_id = p_barber_id)
  ),
  prev_revenue as (
    select
      count(*)::int as cnt,
      coalesce(sum(b.price_ore), 0)::bigint as rev
    from public.bookings b
    where b.starts_at::date between v_prev_start and v_prev_end
      and b.status in ('confirmed','completed','pending')
      and (p_barber_id is null or b.barber_id = p_barber_id)
  ),
  occupancy as (
    select coalesce(sum(b.duration_minutes), 0)::int as booked_min
    from public.bookings b
    where b.starts_at::date between p_start_date and p_end_date
      and b.status in ('confirmed','completed','no_show','pending')
      and (p_barber_id is null or b.barber_id = p_barber_id)
  ),
  day_grid as (
    select gs.d::date as day
    from generate_series(p_start_date, p_end_date, interval '1 day') as gs(d)
  ),
  barber_pool as (
    select id
    from public.barbers
    where is_active = true
      and (p_barber_id is null or id = p_barber_id)
  ),
  day_window as (
    select
      d.day,
      bp.id as barber_id,
      case
        when h.opens_at is null or h.closes_at is null then null
        when exists (select 1 from public.holidays where closed_date = d.day) then null
        else tstzrange(
          ((d.day::text || ' ' || h.opens_at::text)::timestamp at time zone 'Europe/Copenhagen'),
          ((d.day::text || ' ' || h.closes_at::text)::timestamp at time zone 'Europe/Copenhagen'),
          '[)'
        )
      end as window
    from day_grid d
    cross join barber_pool bp
    left join public.barber_hours h
      on h.barber_id = bp.id
     and h.isoweekday = extract(isodow from d.day)::smallint
  ),
  day_avail as (
    select
      dw.day,
      dw.barber_id,
      case
        when dw.window is null then 0
        else (extract(epoch from (upper(dw.window) - lower(dw.window))) / 60)::int
      end as base_min,
      coalesce((
        select sum(
          extract(epoch from (
            least(upper(dw.window), t.ends_at) - greatest(lower(dw.window), t.starts_at)
          )) / 60
        )::int
        from public.time_off t
        where dw.window is not null
          and (t.barber_id is null or t.barber_id = dw.barber_id)
          and tstzrange(t.starts_at, t.ends_at, '[)') && dw.window
      ), 0) as time_off_min
    from day_window dw
  ),
  availability as (
    select coalesce(sum(greatest(0, base_min - time_off_min)), 0)::int as avail_min
    from day_avail
  )
  select
    c.cnt,
    c.rev,
    case when c.cnt > 0 then (c.rev / c.cnt)::int else 0 end,
    occupancy.booked_min,
    availability.avail_min,
    p.cnt,
    p.rev,
    case when p.cnt > 0 then (p.rev / p.cnt)::int else 0 end
  from curr_revenue c, prev_revenue p, occupancy, availability;
end;
$$;

grant execute on function public.get_overview_kpis(date, date, uuid) to authenticated;


-- Per-day revenue series for the chart. Returns one row per calendar day in
-- the range (zero-filled) so the chart axis is never sparse.
create or replace function public.get_revenue_by_day(
  p_start_date date,
  p_end_date date,
  p_barber_id uuid default null
) returns table (
  day date,
  revenue_ore bigint,
  bookings_count int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_barber() then
    raise exception 'forbidden';
  end if;

  return query
  select
    g.d::date,
    coalesce(sum(b.price_ore), 0)::bigint,
    coalesce(count(b.id), 0)::int
  from generate_series(p_start_date, p_end_date, interval '1 day') as g(d)
  left join public.bookings b
    on b.starts_at::date = g.d::date
    and b.status in ('confirmed','completed','pending')
    and (p_barber_id is null or b.barber_id = p_barber_id)
  group by g.d
  order by g.d;
end;
$$;

grant execute on function public.get_revenue_by_day(date, date, uuid) to authenticated;


-- Busiest barbers in the period. Always returns every active barber (left
-- join) so the comparison rail keeps showing all three even if one had zero
-- bookings. Intentionally NOT filterable by barber — this is the comparison
-- view, not the filtered metric.
create or replace function public.get_busiest_barbers(
  p_start_date date,
  p_end_date date
) returns table (
  barber_id uuid,
  display_name text,
  profile_color text,
  bookings_count int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_barber() then
    raise exception 'forbidden';
  end if;

  return query
  select
    br.id,
    br.display_name,
    br.profile_color,
    coalesce(count(b.id) filter (
      where b.starts_at::date between p_start_date and p_end_date
        and b.status in ('confirmed','completed','pending')
    ), 0)::int as bookings_count
  from public.barbers br
  left join public.bookings b on b.barber_id = br.id
  where br.is_active = true
  group by br.id, br.display_name, br.profile_color, br.display_order
  order by bookings_count desc, br.display_order asc;
end;
$$;

grant execute on function public.get_busiest_barbers(date, date) to authenticated;


-- Top services in the period. Filterable by barber (e.g. "Hamadas mest
-- bookede services"). Returns at most p_limit rows.
create or replace function public.get_top_services(
  p_start_date date,
  p_end_date date,
  p_barber_id uuid default null,
  p_limit int default 3
) returns table (
  service_id uuid,
  name_da text,
  bookings_count int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_barber() then
    raise exception 'forbidden';
  end if;

  return query
  select
    s.id,
    s.name_da,
    count(b.id)::int as bookings_count
  from public.services s
  inner join public.bookings b on b.service_id = s.id
  where b.starts_at::date between p_start_date and p_end_date
    and b.status in ('confirmed','completed','pending')
    and (p_barber_id is null or b.barber_id = p_barber_id)
  group by s.id, s.name_da
  order by bookings_count desc
  limit p_limit;
end;
$$;

grant execute on function public.get_top_services(date, date, uuid, int) to authenticated;
