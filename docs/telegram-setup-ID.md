# Menghubungkan Centrum ke Telegram (Owner & Staff)

Panduan ini untuk pemilik venue dan staf — tidak butuh latar belakang
teknis. Semua selesai dalam sekitar **10 menit** dan cukup sekali.

---

## Ini untuk apa?

Website manajemen venue kamu (booking, pembayaran, laporan) juga bisa
dipakai lewat Telegram. Kamu dan staf bisa cek jadwal, catat booking, atau
lihat pemasukan hari ini cukup dengan chat ke bot.

## Yang kamu butuhkan

- Akun Telegram (gratis, di HP atau komputer).
- Orang yang menyiapkan website kamu memberi bot-nya, ATAU kamu buat
  sendiri lewat langkah 1 di bawah.

## Kalau bot-nya sudah dibuatkan untuk kamu

1. Buka Telegram, cari bot sesuai username (kami kirimkan username-nya).
2. Tekan **Start**.
3. Kirim pesan seperti `halo` — bot harusnya menjawab.
4. Selesai. Bot siap dipakai.

## Kalau kamu ingin membuat bot sendiri (hanya kalau diminta)

1. Buka Telegram, cari **@BotFather** (centang biru).
2. Tekan Start, lalu kirim `/newbot`.
3. Beri nama (contoh: `Centrum Owner`).
4. Beri username yang diakhiri `bot` (contoh: `centrum_owner_bot`).
5. BotFather mengirim **token** — kode panjang seperti `123456789:AAH...`.
6. Salin token dan berikan ke pengelola backend AgentsProxy. Token
   **tidak** disimpan di frontend — jangan menempelkannya ke halaman
   pengaturan atau file repo.
7. Kirim pesan ke bot itu dan tekan **Start**.

## Beri akses ke orang yang tepat (penting untuk pertanyaan uang)

- Bot **Owner** bisa menjawab soal uang dan laporan.
- Bot **Staff** membantu soal jadwal dan pemasukan harian.
- Hanya chat yang ada di **daftar izin** yang boleh memakai bot Owner/Staff.
  Yang lain ditolak dengan sopan. Tambahkan chat ID di halaman pengaturan.

### Cara mencari chat ID Telegram kamu

1. Buka Telegram, cari **@userinfobot**.
2. Tekan Start. Bot menjawab dengan angka — itu chat ID kamu.
3. Salin angka itu ke daftar izin.

## Contoh yang bisa dilakukan bot

- `jam kosong besok jam 19?` → menampilkan slot kosong
- `catat booking Lapangan 1 besok 19-20 atas nama Budi` → booking tercatat
- `berapa pemasukan hari ini?` → menampilkan pemasukan hari ini
- `buatkan laporan excel bulan ini` → mengirim file Excel

## Kalau ada masalah

| Masalah | Yang harus dilakukan |
| --- | --- |
| Bot tidak menjawab | Pastikan bot sudah di-Start. Coba lagi 1 menit kemudian. |
| "Kamu tidak diizinkan" | Chat ID kamu belum masuk daftar izin. Minta owner menambahkannya. |
| Jawaban salah | Ketik `mulai ulang` untuk mereset percakapan, lalu tanya lagi. |
| Bot mati total | Hubungi pengelola website kamu (ini tidak bisa diperbaiki sendiri). |

## Pengingat keamanan

- **Token itu seperti kunci.** Jangan pernah membagikannya ke siapa pun
  selain orang yang menyiapkan website kamu. Kalau curiga bocor: di
  @BotFather tekan `/revoke`, pilih bot — kunci lama langsung mati dan
  dibuat kunci baru. Berikan token baru ke pengelola backend.
- Pertanyaan uang hanya dijawab lewat bot Owner, dan hanya untuk chat yang
  kamu izinkan.

---
*Ada pertanyaan? Tanyakan ke orang yang menyiapkan website kamu.*
