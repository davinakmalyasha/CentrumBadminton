// Booking status sets, in one place.
//
// WHY THIS FILE EXISTS: the proxy's bookings list DEFAULTS to
// `status=confirmed` when no `?status=` is supplied
// (AgentsProxy bookings list handler). A confirmed-only default is
// right for a revenue ledger and wrong for a schedule grid, a payment
// reminder, or any "act on this booking" lookup — a staff member
// confirming a WhatsApp `pending` booking, or extending a
// `checked_in` one, needs that row to come back at all.
//
// The connector used to accept `.eq("status", …)` and then drop it on
// the floor, so every read silently returned confirmed-only no matter
// what the caller asked for. `.in("status", …)` now maps to the proxy's
// CSV status param, and these sets make the intent explicit at the
// call site instead of relying on a default that is wrong most of the
// time.
//
// The lifecycle itself is enforced server-side: pending → confirmed →
// checked_in → completed, with cancelled / no_show as exits. RLS and
// the transition guard are the boundary; these lists only say which
// statuses a screen wants to SEE.

/** Every status a booking can be in. */
export const ALL_BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
] as const;

/**
 * Statuses a schedule / timeline should show. Cancelled is excluded
 * because a cancelled slot is free again and should not paint the grid
 * as busy — but `no_show` IS shown, since the court really was used.
 */
export const VISIBLE_ON_SCHEDULE = [
  "pending",
  "confirmed",
  "checked_in",
  "completed",
  "no_show",
] as const;

/** Statuses that represent a court currently in play. */
export const LIVE_ON_COURT = ["confirmed", "checked_in"] as const;

/**
 * Statuses that actually hold the court, used for overlap checks when
 * extending a booking. `cancelled` and `no_show` are excluded because
 * those slots are free again — a cancelled slot can be rebooked, which
 * is why the DB exclusion constraint ignores them too.
 */
export const OCCUPIES_COURT = ["pending", "confirmed", "checked_in", "completed"] as const;

/**
 * Statuses a booking can still be transitioned FROM. Used by the
 * action handlers that look a booking up before mutating it: if the
 * row is missing from the result the transition silently no-ops, which
 * is how "confirm" quietly did nothing for a pending booking.
 */
export const MUTABLE_BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "no_show",
] as const;
