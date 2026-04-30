-- Link customer_notes rows to a specific booking (for "Hvad blev lavet?" notes
-- that should appear in the booking's Historik row, not in general Kundenoter).
ALTER TABLE public.customer_notes
ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_notes_booking_id
ON public.customer_notes(booking_id);

-- Backfill existing klip-tagged notes: link each one to the most recent
-- completed booking for that customer made within 48 hours before the note.
UPDATE public.customer_notes cn
SET booking_id = (
  SELECT b.id
  FROM public.bookings b
  WHERE b.customer_id = cn.customer_id
    AND b.status = 'completed'
    AND b.starts_at <= cn.created_at
    AND b.starts_at >= cn.created_at - interval '48 hours'
  ORDER BY b.starts_at DESC
  LIMIT 1
)
WHERE 'klip' = ANY(cn.tags)
  AND cn.booking_id IS NULL;
