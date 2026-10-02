"use client";

import { useActionState } from "react";
import { Plus, Save, Users, Wallet } from "lucide-react";
import {
  applyVenueHours,
  createPricingRule,
  createStaff,
  upsertCourt,
  type ActionState,
} from "@/app/app/(protected)/actions";

const initial: ActionState = { error: null };

const field =
  "w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const label =
  "mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

export function NewCourtForm() {
  const [state, formAction, pending] = useActionState(upsertCourt, initial);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="court_id" value="" />
      <input type="hidden" name="sort_order" value={9} />
      <div className="flex-1">
        <label htmlFor="ncname" className={label}>
          Tambah lapangan baru
        </label>
        <input id="ncname" name="name" required placeholder="cth. Lapangan 3 (VIP)" className={field} />
        {state.error && (
          <p className="mt-1 text-[10px] font-semibold text-red-500">{state.error}</p>
        )}
        {state.ok && (
          <p className="mt-1 text-[10px] font-semibold text-emerald-600">Lapangan ditambahkan</p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="manager-tap min-h-[44px] rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-black text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}

export function RenameCourtForm({
  courtId,
  name,
  sortOrder,
}: {
  courtId: string;
  name: string;
  sortOrder: number;
}) {
  // The action state was discarded, so a failed rename reported nothing:
  // the input reverted and the row looked untouched, indistinguishable
  // from a page that simply had not revalidated yet.
  const [state, formAction, pending] = useActionState(upsertCourt, initial);

  return (
    <form action={formAction} className="flex flex-1 flex-col items-start gap-1">
      <div className="flex w-full items-center gap-1.5">
        <input type="hidden" name="court_id" value={courtId} />
        {/* Preserve the court's position — renaming must not reorder it */}
        <input type="hidden" name="sort_order" value={sortOrder} />
        <input
          name="name"
          defaultValue={name}
          required
          aria-label={`Nama lapangan (${name})`}
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-bold text-zinc-900 hover:border-zinc-200 focus:border-zinc-500 focus:bg-white focus:outline-none dark:text-zinc-50 dark:hover:border-zinc-700 dark:focus:bg-zinc-800"
        />
        <button
          type="submit"
          disabled={pending}
          title="Simpan nama"
          aria-label={`Simpan nama lapangan ${name}`}
          className="manager-tap text-[11px] font-bold text-zinc-600 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 dark:text-zinc-300"
        >
          {pending ? "…" : <Save className="h-3.5 w-3.5" />}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-[10px] font-semibold text-red-500 dark:text-red-400">
          {state.error}
        </p>
      )}
    </form>
  );
}

/**
 * Venue opening hours — the single owner control.
 *
 * These used to be two independent settings with two different defaults
 * (facilities 06:00-22:00, pricing rules 07:00-23:00). The booking form
 * offers its slots from the pricing rule while the backend enforces the
 * facility hours, so a 22:30 slot could be quoted, priced, and then
 * refused at insert. Editing one table just moved the disagreement into
 * the other, so this writes both.
 */
export function VenueHoursFields({
  openTime,
  closeTime,
}: {
  openTime: string;
  closeTime: string;
}) {
  const [state, formAction, pending] = useActionState(applyVenueHours, initial);

  return (
    <form
      action={formAction}
      className="mb-3 space-y-3 rounded-xl border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800"
    >
      <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200">
        Jam operasional
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="vh-open" className={label}>
            Buka
          </label>
          <input
            id="vh-open"
            name="open_time"
            type="time"
            defaultValue={openTime}
            required
            className={field}
          />
        </div>
        <div>
          <label htmlFor="vh-close" className={label}>
            Tutup
          </label>
          <input
            id="vh-close"
            name="close_time"
            type="time"
            defaultValue={closeTime}
            required
            className={field}
          />
        </div>
      </div>
      <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
        Berlaku untuk semua lapangan sekaligus, supaya tidak ada slot yang bisa
        dipilih tapi ditolak saat disimpan.
      </p>
      {state.error && (
        <p role="alert" className="text-xs font-semibold text-red-500 dark:text-red-400">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          Jam operasional tersimpan
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="manager-tap inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-900 py-2 text-xs font-black text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? "Menyimpan…" : "Simpan Jam Operasional"}
      </button>
    </form>
  );
}

export function PricingRuleForm({ nextMonth }: { nextMonth: string }) {
  const [state, formAction, pending] = useActionState(createPricingRule, initial);

  return (
      <form action={formAction} className="space-y-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="pvf" className={label}>
            Berlaku dari
          </label>
          <input
            id="pvf"
            type="date"
            name="valid_from"
            defaultValue={`${nextMonth}-01`}
            required
            className={field}
          />
        </div>
        <div>
          <label htmlFor="ppd" className={label}>
            Harga siang
          </label>
          <input id="ppd" name="price_day" inputMode="numeric" placeholder="40000" required className={field} />
        </div>
        <div>
          <label htmlFor="ppe" className={label}>
            Harga malam
          </label>
          <input id="ppe" name="price_evening" inputMode="numeric" placeholder="50000" required className={field} />
        </div>
      </div>
      <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
        Aturan baru berlaku sejak tanggal tersebut, dan menggantikan yang lama. Jam
        buka/tutup mengikuti <span className="font-semibold">Jam Operasional</span>{" "}
        di atas.
      </p>
      {state.error && <p className="text-xs font-semibold text-red-500">{state.error}</p>}
      {state.ok && <p className="text-xs font-semibold text-emerald-600">Aturan tersimpan</p>}
      <button
        type="submit"
        disabled={pending}
        className="manager-tap inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-900 py-2 text-xs font-black text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? (
          "Menyimpan…"
        ) : (
          <>
            <Wallet className="h-3.5 w-3.5" />
            Simpan Aturan Harga Baru
          </>
        )}
      </button>
    </form>
  );
}

export function NewStaffForm() {
  const [state, formAction, pending] = useActionState(createStaff, initial);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="sfname" className={label}>
            Nama lengkap
          </label>
          <input id="sfname" name="full_name" required placeholder="cth. Rizky" className={field} />
        </div>
        <div>
          <label htmlFor="sfphone" className={label}>
            No. WhatsApp
          </label>
          <input id="sfphone" name="phone" inputMode="numeric" placeholder="0812…" className={field} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="sfemail" className={label}>
            Email login
          </label>
          <input id="sfemail" type="email" name="email" required placeholder="pegawai@centrum.id" className={field} />
        </div>
        <div>
          <label htmlFor="sfpass" className={label}>
            Password (min. 8)
          </label>
          <input id="sfpass" type="text" name="password" required minLength={8} autoComplete="off" className={field} />
        </div>
      </div>
      {state.error && (
        <p className="text-xs font-semibold text-red-500">{state.error}</p>
      )}
      {state.ok && (
        <p className="text-xs font-semibold text-emerald-600">
          Akun pegawai dibuat — bagikan email &amp; password ke staf.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="manager-tap inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-zinc-900 py-2 text-xs font-black text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? (
          "Membuat akun…"
        ) : (
          <>
            <Users className="h-3.5 w-3.5" />
            Buat Akun Pegawai
          </>
        )}
      </button>
    </form>
  );
}
