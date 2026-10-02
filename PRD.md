# PRD — Reseller Komisi Berjenjang

## Ringkasan
Sistem reseller dengan komisi berjenjang: setiap reseller punya upline
(membentuk pohon jaringan), transaksi penjualan reseller otomatis memicu
perhitungan komisi multi-level ke upline hingga N level, dikelompokkan per
periode bulanan yang bisa dibayar & dikunci.

## Stack
Next.js 14 + TypeScript + Prisma 5.22 + SQLite + Tailwind CSS, App Router.

## Model Data

- **Reseller**: `nama`, `kode` (unik), `kontak` (opsional), `uplineId`
  (self-relation nullable; NULL = root). Level = kedalaman dari root
  (root = level 0, dihitung dinamis).
- **KomisiConfig**: `level` (1-based, unik), `persen`. Contoh default:
  level 1 = 10%, level 2 = 5%, level 3 = 2%. Komisi hanya dihitung
  sampai level tertinggi yang terkonfigurasi.
- **Transaksi**: `resellerId`, `nominal`, `tanggal` (TEXT `YYYY-MM-DD`),
  `periode` (TEXT `YYYY-MM` turunan dari tanggal). Dibuat per penjualan
  oleh seorang reseller (downline).
- **KomisiLedger**: `resellerId` (penerima), `transaksiId`, `level`
  (1..N dari penerima relatif ke penjual), `nominal`, `periode`,
  `status` (`MENUNGGU` → `DIBAYAR`).
- **PeriodeKomisi**: `periode` (unik `YYYY-MM`), `status`
  (`TERBUKA` / `LUNAS`), `lockedAt`. Dibuat otomatis saat transaksi
  pertama di periode itu masuk.

## Aturan Bisnis

1. **Pencegahan siklus**: saat menambah/mengubah upline, calon upline
   tidak boleh dirinya sendiri maupun descendant-nya (dicek dengan
   `WITH RECURSIVE`). Pelanggaran → 422 `"siklus terdeteksi"`.
2. **Komisi otomatis**: saat transaksi dibuat, untuk tiap level i = 1..N
   ambil upline ke-i dari penjual; jika ada dan `KomisiConfig` level i
   ada, buat baris ledger `nominal × persen/100` (dibulatkan 2 desimal)
   dengan penerima = upline tersebut.
3. **Edit/hapus transaksi**: tulis ulang ledger transaksi itu; dilarang
   bila periodenya sudah `LUNAS` → 409.
4. **Hapus reseller**: dilarang bila masih punya downline atau transaksi
   → 409.
5. **Bayar & lock periode**: aksi bayar menandai semua ledger periode
   `MENUNGGU` → `DIBAYAR` dan periode → `LUNAS`. Setelah `LUNAS`,
   transaksi & ledger periode itu immutable (edit/delete → 409).
6. **Laporan jaringan**: `WITH RECURSIVE` (SQLite) dari root (atau semua
   root), mengembalikan pohon: tiap node berisi kedalaman (level),
   total omzet (sum transaksi sendiri), total komisi diterima, dan
   anak-anaknya.

## API

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET/POST | `/api/reseller` | list + tambah |
| GET/PUT/DELETE | `/api/reseller/[id]` | detail/ubah/hapus (siklus → 422) |
| GET/PUT | `/api/komisi-config` | baca/ubah persentase per level |
| GET/POST | `/api/transaksi` | list + catat (picu komisi otomatis) |
| GET/PUT/DELETE | `/api/transaksi/[id]` | detail/ubah/hapus (locked → 409) |
| GET | `/api/ledger?periode=YYYY-MM` | ledger komisi per periode |
| GET/POST | `/api/periode` | list/buat periode |
| POST | `/api/periode/[periode]/bayar` | bayar & lock periode |
| GET | `/api/laporan/jaringan?rootId=` | pohon jaringan (recursive CTE) |

## UI (Bahasa Indonesia)

- `/` dashboard: ringkasan (jumlah reseller, omzet bulan berjalan,
  komisi menunggu dibayar, daftar periode).
- `/reseller`: pohon/daftar jaringan, form tambah + pilih upline.
- `/transaksi`: catat transaksi, riwayat transaksi.
- `/komisi`: ledger per periode, tombol "Bayar & Kunci Periode",
  form konfigurasi persentase.
- `/laporan`: pohon jaringan per root + omzet & komisi per node.

## Seed
Struktur 3 level (1 root, 2 anak, 3 cucu + 1 cicit), konfigurasi
10%/5%/2%, beberapa transaksi di periode `2026-09` (**LUNAS**) dan
`2026-10` (**TERBUKA**).

## Testing
`npm run build` wajib lolos. curl: siklus upline ditolak (422),
komisi multi-level terhitung benar, CTE recursive jalan, periode
locked immutable (409), error cases 400/404.
