export type UserRole = "owner" | "pegawai";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "no_show";
export type BookingSource = "whatsapp" | "walk_in";
export type PaymentMethod = "cash" | "qris";
export type PaymentStatus = "unpaid" | "partial" | "paid";
export type SeriesStatus = "active" | "paused" | "ended";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Court {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface PricingRule {
  id: string;
  valid_from: string;
  open_time: string;
  close_time: string;
  day_start: string;
  day_end: string;
  price_day: number;
  price_evening: number;
  is_active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  no_show_count: number;
  notes: string | null;
  created_at: string;
}

export interface RecurringSeries {
  id: string;
  court_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string | null;
  status: SeriesStatus;
  created_by: string | null;
  created_at: string;
}

export interface Booking {
  id: string;
  court_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  source: BookingSource;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  recurring_series_id: string | null;
  computed_price: number;
  override_price: number | null;
  payment_status: PaymentStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  amount: number;
  method: PaymentMethod;
  paid_at: string;
  recorded_by: string | null;
  note: string | null;
}

export interface CourtBlock {
  id: string;
  court_id: string | null;
  block_date: string;
  start_time: string;
  end_time: string;
  reason: string;
  created_by: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  note: string | null;
  spent_at: string;
  created_by: string | null;
  created_at: string;
}

/** Row returned by public.get_day_busy(p_date) */
export interface DayBusyInterval {
  court_id: string;
  court_name: string;
  start_time: string;
  end_time: string;
  kind: "booked" | "blocked";
}

/** Row returned by public.get_pricing_for(p_date) */
export interface DayPricing {
  open_time: string;
  close_time: string;
  day_start: string;
  day_end: string;
  price_day: number;
  price_evening: number;
}
