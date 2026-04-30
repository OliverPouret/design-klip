-- Custom alert rules + their triggered events.
-- Rules are evaluated by a future scheduled function (out of scope for this migration).
-- The /admin/oekonomi page reads alert_triggers WHERE acknowledged=false to show a banner.

CREATE TABLE IF NOT EXISTS public.alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric text NOT NULL CHECK (metric IN ('daily_revenue', 'no_shows_week', 'rebooking_rate', 'occupancy')),
  operator text NOT NULL CHECK (operator IN ('lt', 'gt')),
  threshold numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alert_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.alert_rules(id) ON DELETE CASCADE,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  value_at_trigger numeric NOT NULL,
  acknowledged boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_alert_triggers_rule_id ON public.alert_triggers(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_triggers_unack ON public.alert_triggers(acknowledged) WHERE acknowledged = false;

ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read alert_rules" ON public.alert_rules FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write alert_rules" ON public.alert_rules FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated read alert_triggers" ON public.alert_triggers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated write alert_triggers" ON public.alert_triggers FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
