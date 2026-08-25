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
