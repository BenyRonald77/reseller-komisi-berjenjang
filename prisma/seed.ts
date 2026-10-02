import { PrismaClient } from "@prisma/client";
import { buatTransaksi } from "../lib/bisnis";
import { nowIso } from "../lib/format";

const prisma = new PrismaClient();

async function main() {
  const n = await prisma.reseller.count();
  if (n > 0) {
    console.log("seed dilewati (sudah ada data)");
    return;
  }

  // Konfigurasi komisi: level 1 = 10%, level 2 = 5%, level 3 = 2%
  await prisma.komisiConfig.createMany({
    data: [
      { level: 1, persen: 10 },
      { level: 2, persen: 5 },
      { level: 3, persen: 2 },
    ],
  });

  // Struktur 3 level: 1 root, 2 anak, 3 cucu, 1 cicit
  const andi = await prisma.reseller.create({ data: { nama: "Andi Wijaya", kode: "R001", kontak: "0811-0001" } });
  const budi = await prisma.reseller.create({ data: { nama: "Budi Santoso", kode: "R002", kontak: "0811-0002", uplineId: andi.id } });
  const citra = await prisma.reseller.create({ data: { nama: "Citra Dewi", kode: "R003", kontak: "0811-0003", uplineId: andi.id } });
  const dedi = await prisma.reseller.create({ data: { nama: "Dedi Kurnia", kode: "R004", kontak: "0811-0004", uplineId: budi.id } });
  const eka = await prisma.reseller.create({ data: { nama: "Eka Putri", kode: "R005", kontak: "0811-0005", uplineId: budi.id } });
  const fajar = await prisma.reseller.create({ data: { nama: "Fajar Nugroho", kode: "R006", kontak: "0811-0006", uplineId: citra.id } });
  const gita = await prisma.reseller.create({ data: { nama: "Gita Lestari", kode: "R007", kontak: "0811-0007", uplineId: dedi.id } });

  // Transaksi periode 2026-09 (akan di-lock)
  await buatTransaksi(prisma, { resellerId: gita.id, nominal: 1000000, tanggal: "2026-09-05" });
  await buatTransaksi(prisma, { resellerId: fajar.id, nominal: 500000, tanggal: "2026-09-12" });
  await buatTransaksi(prisma, { resellerId: eka.id, nominal: 750000, tanggal: "2026-09-20" });
  // Lock periode 2026-09
  await prisma.komisiLedger.updateMany({ where: { periode: "2026-09" }, data: { status: "DIBAYAR" } });
  await prisma.periodeKomisi.update({
    where: { periode: "2026-09" },
    data: { status: "LUNAS", lockedAt: nowIso() },
  });

  // Transaksi periode 2026-10 (terbuka)
  await buatTransaksi(prisma, { resellerId: gita.id, nominal: 2000000, tanggal: "2026-10-02" });
  await buatTransaksi(prisma, { resellerId: dedi.id, nominal: 300000, tanggal: "2026-10-03" });

  console.log("seed selesai: 7 reseller, 5 transaksi, periode 2026-09 LUNAS, 2026-10 TERBUKA");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
