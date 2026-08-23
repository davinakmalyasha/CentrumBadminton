"use client";

import { useActionState } from "react";
import {
  createPricingRule,
  createStaff,
  upsertCourt,
  type ActionState,
} from "@/app/app/(protected)/actions";

const initial: ActionState = { error: null };

const field =
  "w-full rounded-xl border border-sky-brand-200 bg-white px-3 py-2.5 text-sm text-navy-900 focus:border-sky-brand-400 focus:outline-none";
const label =
  "mb-1 block text-xs font-bold uppercase tracking-wide text-navy-700/60";

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
          <p className="mt-1 text-[10px] font-semibold text-emerald-600">✅ Lapangan ditambahkan</p>
        )}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-accent-500 px-4 py-2.5 text-xs font-black text-white transition hover:bg-accent-600 disabled:opacity-50"
      >
        ＋
      </button>
    </form>
  );
}

export function RenameCourtForm({
  courtId,
  name,
}: {
  courtId: string;
  name: string;
}) {
  const [, formAction, pending] = useActionState(upsertCourt, initial);

  return (
    <form action={formAction} className="flex flex-1 items-center gap-1.5">
      <input type="hidden" name="court_id" value={courtId} />
      <input type="hidden" name="sort_order" value={0} />
      <input
        name="name"
        defaultValue={name}
        required
        className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-bold text-navy-900 hover:border-sky-brand-200 focus:border-sky-brand-400 focus:bg-white focus:outline-none"
      />
      <button
        type="submit"
        disabled={pending}
        title="Simpan nama"
        className="text-[11px] font-bold text-sky-brand-600 opacity-0 transition group-hover:opacity-100"
      >
        {pending ? "…" : "💾"}
      </button>
    </form>
  );
}

export function PricingRuleForm({ nextMonth }: { nextMonth: string }) {
  const [state, formAction, pending] = useActionState(createPricingRule, initial);

  return (
    <form action={formAction} className="space-y-3 rounded-xl border border-dashed border-accent-400/60 bg-accent-500/5 p-3">
      <div className="grid grid-cols-3 gap-2">
        <div>
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
      <p className="text-[10px] font-medium text-navy-700/50">
        Batas jam mengikuti standar 07–23, batas malam 17.00. Aturan lama otomatis
        digantikan sejak tanggal tersebut.
      </p>
      {state.error && <p className="text-xs font-semibold text-red-500">⚠️ {state.error}</p>}
      {state.ok && <p className="text-xs font-semibold text-emerald-600">✅ Aturan tersimpan</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-navy-800 py-2 text-xs font-black text-white transition hover:bg-navy-700 disabled:opacity-50"
      >
        {pending ? "Menyimpan…" : "💰 Simpan Aturan Harga Baru"}
      </button>
    </form>
  );
}

export function NewStaffForm() {
  const [state, formAction, pending] = useActionState(createStaff, initial);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-xl border border-dashed border-sky-brand-400/60 bg-sky-brand-400/5 p-3"
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
        <p className="text-xs font-semibold text-red-500">⚠️ {state.error}</p>
      )}
      {state.ok && (
        <p className="text-xs font-semibold text-emerald-600">
          ✅ Akun pegawai dibuat — bagikan email &amp; password ke staf.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-navy-800 py-2 text-xs font-black text-white transition hover:bg-navy-700 disabled:opacity-50"
      >
        {pending ? "Membuat akun…" : "👥 Buat Akun Pegawai"}
      </button>
    </form>
  );
}
