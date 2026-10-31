# Contributing

Terima kasih sudah membantu. Repository ini adalah aplikasi produksi, jadi utamakan perubahan kecil yang teruji.

## Sebelum Mulai

- Node.js 20.9+ (disarankan 22 LTS) dan npm 10+.
- Salin `.env.local.example` menjadi `.env.local` dan isi nilainya. Jangan pernah commit `.env.local`.
- Backend AgentsProxy harus berjalan untuk pengujian manual.

## Alur Kerja

```bash
git switch -c feat/nama-singkat
npm install
npm run check        # typecheck + lint + test
npm run build        # pastikan production build lolos
```

Lalu buka Pull Request ke `main`. CI wajib hijau.

## Aturan Perubahan

- **Jangan** menambahkan secret, token, password, dump database, atau file `.env` ke repo.
- **Jangan** menambahkan `NEXT_PUBLIC_*` untuk nilai rahasia — nilai itu masuk ke bundle browser.
- Pertahankan pemisahan `owner` / `pegawai` di server, bukan hanya di UI.
- Validasi input di boundary (server action / route handler); jangan percaya data dari browser.
- Gunakan `proxyFetch` untuk panggilan backend baru agar timeout, auth header, dan error mapping konsisten.
- Tambahkan unit test untuk logika baru di `tests/`.
- Jangan mengubah `public/sw.js` tanpa menaikkan versi `CACHE`.

## Gaya Kode

- TypeScript strict; hindari `any` baru.
- Ikuti pola file di sekitarnya (naming, komponen, error state).
- Komentar sebaiknya menjelaskan **mengapa**, bukan mengulang kode.
- `npm run lint` harus selesai tanpa warning (`--max-warnings=0`).

## Commit & PR

- Commit message singkat, imperatif, boleh prefix (`fix:`, `feat:`, `chore:`, `docs:`).
- Satu PR = satu tujuan.
- Sertakan langkah verifikasi di deskripsi PR (test/build/manual).
- Untuk perubahan UI, sertakan screenshot sebelum/sesudah bila relevan.

## Melaporkan Masalah Keamanan

Jangan buka issue publik. Ikuti [SECURITY.md](SECURITY.md).
