-- ============================================================
-- Design Klip — Seed data
-- Run AFTER the three migration files
-- ============================================================

-- SERVICES (prices in øre: 200 DKK = 20000)
insert into public.services (slug, name_da, description_da, duration_minutes, price_ore, category, display_order) values
  ('herreklip',      'Herreklip',         'Klip, vask og styling.',                          30, 20000, 'hair',  1),
  ('borneklip',      'Børneklip',         'Til børn under 12 år.',                           20, 17000, 'hair',  2),
  ('maskineklip',    'Maskineklip',       'Kun maskine, ingen saks.',                        15, 15000, 'hair',  3),
  ('skaeg',          'Skæg',              'Trimning og formning af skæg.',                   15, 10000, 'beard', 4),
  ('herreklip-skaeg','Herreklip + skæg',  'Klip og skæg i én omgang.',                       45, 30000, 'combo', 5);

-- BARBERS
insert into public.barbers (slug, display_name, bio, profile_color, display_order) values
  ('hamada',   'Hamada',   'Ejer af Design Klip. Klipper herrer og børn.',     '#B08A3E', 1),
  ('wissam',   'Wissam',   'Fades og skæg er hans spidskompetence.',           '#8C6A28', 2),
  ('mohammed', 'Mohammed', 'Klipper alt fra klassisk til moderne.',            '#6B5B45', 3);

-- ALL BARBERS PERFORM ALL SERVICES
insert into public.barber_services (barber_id, service_id)
select b.id, s.id
from public.barbers b cross join public.services s;

-- BARBER WORKING HOURS
-- Hamada: Mon-Fri 9-17, Sat 9-14, off Wednesday and Sunday
-- Wissam: Mon-Fri 9-17, Sat 9-14, off Monday and Sunday
-- Mohammed: Mon-Fri 9-17, Sat 9-14, off Tuesday and Sunday
insert into public.barber_hours (barber_id, isoweekday, opens_at, closes_at)
select b.id, d.dow, d.opens, d.closes
from public.barbers b
cross join (values
  (1, '09:00'::time, '17:00'::time),  -- Monday
  (2, '09:00'::time, '17:00'::time),  -- Tuesday
  (3, '09:00'::time, '17:00'::time),  -- Wednesday
  (4, '09:00'::time, '17:00'::time),  -- Thursday
  (5, '09:00'::time, '17:00'::time),  -- Friday
  (6, '09:00'::time, '14:00'::time),  -- Saturday
  (7, null, null)                       -- Sunday (closed)
) as d(dow, opens, closes)
where not (
  (b.slug = 'hamada'   and d.dow = 3) or  -- Hamada off Wednesday
  (b.slug = 'wissam'   and d.dow = 1) or  -- Wissam off Monday
  (b.slug = 'mohammed' and d.dow = 2)     -- Mohammed off Tuesday
);

-- SETTINGS (CMS key-value store)
insert into public.settings (key, value) values
  ('booking_window_days',     '365'::jsonb),
  ('reminder_hours_before',   '24'::jsonb),
  ('deposits_enabled',        'false'::jsonb),
  ('shop_name',               '"Design Klip"'::jsonb),
  ('shop_phone',              '"+4546359348"'::jsonb),
  ('shop_address',            '{"street":"Holbækvej 39","city":"Roskilde","zip":"4000","country":"DK"}'::jsonb),
  ('shop_cvr',                '"XXXXXXXX"'::jsonb),
  ('shop_email',              '"kontakt@designklip.dk"'::jsonb),
  ('socials',                 '{"instagram":"https://www.instagram.com/design_klip/","facebook":"","google_maps":""}'::jsonb),
  ('opening_hours_display',   '{"mon":"09:00–17:00","tue":"09:00–17:00","wed":"09:00–17:00","thu":"09:00–17:00","fri":"09:00–17:00","sat":"09:00–14:00","sun":"Lukket"}'::jsonb),
  ('hero_headline_da',        '"DESIGN KLIP"'::jsonb),
  ('hero_subhead_da',         '"Barbershop i Roskilde"'::jsonb),
  ('hero_image_url',          '""'::jsonb),
  ('about_markdown_da',       '""'::jsonb),
  ('cancellation_policy_da',  '"Du kan afbestille via linket i din SMS."'::jsonb),
  ('footer_text_da',          '""'::jsonb);

-- SMS TEMPLATES
insert into public.sms_templates (id, name_da, body_da, body_en) values
  ('confirmation',
   'Bekræftelse',
   'Hej {customer_name}. Du har fået en tid hos {barber_name} ({service}) d. {date} kl. {time}. Vi holder til på {address}. Afbestil her: {cancel_link} – {shop_name}',
   'Hi {customer_name}. Your appointment with {barber_name} ({service}) is confirmed on {date} at {time}. {address}. Cancel: {cancel_link} – {shop_name}'),
  ('reminder_24h',
   'Påmindelse',
   'Husk din tid i morgen kl. {time} hos {barber_name}. {address}. Kan du ikke komme? Afbestil her: {cancel_link} – {shop_name}',
   'Reminder: tomorrow at {time} with {barber_name}. {address}. Cancel: {cancel_link} – {shop_name}'),
  ('cancellation_customer',
   'Afbestilling',
   'Din tid d. {date} kl. {time} hos {barber_name} er afbestilt. Du er altid velkommen igen: {rebook_link} – {shop_name}',
   'Your appointment on {date} at {time} with {barber_name} has been cancelled. Book again: {rebook_link} – {shop_name}'),
  ('cancelled_by_shop',
   'Aflysning fra salon',
   'Vi er desværre nødt til at aflyse din tid d. {date} kl. {time}. Beklager ulejligheden. Book en ny tid her: {rebook_link} – {shop_name}',
   'We unfortunately have to cancel your appointment on {date} at {time}. Rebook here: {rebook_link} – {shop_name}'),
  ('reschedule',
   'Flyttet tid',
   'Din tid er blevet flyttet til d. {date} kl. {time} hos {barber_name}. Ring til os på {shop_phone} hvis det ikke passer. Afbestil: {cancel_link} – {shop_name}',
   'Your appointment has been moved to {date} at {time} with {barber_name}. Call {shop_phone} if that does not work. Cancel: {cancel_link} – {shop_name}');

-- NOTE TAG TEMPLATES
-- Table exists but no tags seeded — Hamada adds his own from the admin if he wants them.
