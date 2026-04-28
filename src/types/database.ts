export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type CancelledBy = 'customer' | 'barber' | 'admin' | 'system';
export type BookingSource = 'web' | 'walkin' | 'phone';

export interface Barber {
  id: string;
  slug: string;
  display_name: string;
  bio: string | null;
  photo_url: string | null;
  profile_color: string;
  user_id: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  slug: string;
  name_da: string;
  name_en: string | null;
  description_da: string | null;
  description_en: string | null;
  duration_minutes: number;
  price_ore: number;
  category: string | null;
  photo_url: string | null;
  requires_deposit: boolean;
  deposit_ore: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface BarberService {
  barber_id: string;
  service_id: string;
}

export interface BarberHours {
  id: string;
  barber_id: string;
  isoweekday: number;
  opens_at: string | null;
  closes_at: string | null;
}

export interface TimeOff {
  id: string;
  barber_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  is_all_day: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Holiday {
  id: string;
  closed_date: string;
  label: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  phone_e164: string;
  full_name: string;
  email: string | null;
  marketing_opt_in: boolean;
  notes_summary: string | null;
  total_bookings: number;
  last_booking_at: string | null;
  created_at: string;
  updated_at: string;
  anonymized_at: string | null;
}

export interface CustomerNote {
  id: string;
  customer_id: string;
  author_id: string | null;
  body: string;
  tags: string[];
  created_at: string;
}

export interface NoteTag {
  id: string;
  label: string;
  display_order: number;
}

export interface Booking {
  id: string;
  short_code: string;
  customer_id: string;
  barber_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  price_ore: number;
  status: BookingStatus;
  customer_notes: string | null;
  cancel_token: string;
  cancelled_at: string | null;
  cancelled_by: CancelledBy | null;
  cancellation_reason: string | null;
  reminder_sent_at: string | null;
  confirmation_sent_at: string | null;
  source: BookingSource;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  key: string;
  value: unknown;
  updated_at: string;
  updated_by: string | null;
}

export interface GalleryImage {
  id: string;
  storage_path: string;
  url: string;
  caption_da: string | null;
  caption_en: string | null;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  display_order: number;
  is_published: boolean;
  uploaded_by: string | null;
  consent_record_id: string | null;
  created_at: string;
}

export interface SmsTemplate {
  id: string;
  name_da: string;
  body_da: string;
  body_en: string | null;
  enabled: boolean;
  updated_at: string;
  updated_by: string | null;
}

export interface SmsLog {
  id: string;
  booking_id: string | null;
  customer_id: string | null;
  template_id: string | null;
  to_phone: string;
  body: string;
  provider: string;
  provider_message_id: string | null;
  status: string;
  error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: unknown | null;
  after: unknown | null;
  ip: string | null;
  created_at: string;
}

// Utility: format øre to DKK string
export function formatDKK(ore: number): string {
  return `${(ore / 100).toFixed(0)} kr`;
}

// Utility: format price with decimals if needed
export function formatDKKFull(ore: number): string {
  const dkk = ore / 100;
  return dkk % 1 === 0 ? `${dkk.toFixed(0)} kr` : `${dkk.toFixed(2)} kr`;
}
