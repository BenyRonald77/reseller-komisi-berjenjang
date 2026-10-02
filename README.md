# Reseller Komisi Berjenjang

Sistem reseller dengan komisi berjenjang multi-level: setiap reseller punya
upline (membentuk pohon jaringan), transaksi penjualan otomatis memicu
perhitungan komisi ke upline hingga N level sesuai konfigurasi persentase,
dikelompokkan per periode bulanan yang bisa dibayar & dikunci.

## Cara Menjalankan

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

Buka http://localhost:3000.

> Catatan VM: unduhan engine Prisma sering gagal (ECONNRESET). Workaround:
> `npm install --ignore-scripts`, lalu salin `schema-engine-debian-openssl-3.0.x`
> dan `libquery_engine-debian-openssl-3.0.x.so.node` dari
> `~/workspace/ts-convert/prisma-engines/` ke `node_modules/@prisma/engines/`,
> baru `npx prisma generate`.

## Halaman

- `/` — Dashboard: total reseller, transaksi, omzet, komisi menunggu dibayar, daftar periode.
- `/reseller` — Pohon jaringan reseller, form tambah reseller + pilih upline (pencegahan siklus).
- `/transaksi` — Catat transaksi penjualan, riwayat transaksi.
- `/komisi` — Ledger komisi per periode, tombol "Bayar & Kunci Periode", konfigurasi persentase per level.
- `/laporan` — Laporan jaringan (recursive CTE): pohon per root + omzet & komisi per node.

## API

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET/POST | `/api/reseller` | list + tambah |
| GET/PUT/DELETE | `/api/reseller/[id]` | detail/ubah/hapus (siklus → 422) |
| GET/PUT | `/api/komisi-config` | baca/ubah persentase per level |
| GET/POST | `/api/transaksi` | list + catat (komisi otomatis) |
| GET/PUT/DELETE | `/api/transaksi/[id]` | detail/ubah/hapus (periode locked → 409) |
| GET | `/api/ledger?periode=YYYY-MM` | ledger komisi per periode |
| GET/POST | `/api/periode` | list/buat periode |
| POST | `/api/periode/[periode]/bayar` | bayar & kunci periode |
| GET | `/api/laporan/jaringan?rootId=` | pohon jaringan via `WITH RECURSIVE` |

## Aturan Bisnis

1. Calon upline tidak boleh diri sendiri / descendant-nya → 422 "siklus terdeteksi".
2. Komisi otomatis per transaksi: level 1 = 10%, level 2 = 5%, level 3 = 2% (configurable).
3. Periode yang sudah LUNAS tidak bisa diubah: edit/hapus transaksi di periode itu → 409.
4. Reseller dengan downline/transaksi tidak bisa dihapus → 409.

Detail lengkap: lihat [PRD.md](./PRD.md).
