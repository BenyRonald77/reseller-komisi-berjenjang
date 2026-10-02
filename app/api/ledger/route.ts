import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { err } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const periode = req.nextUrl.searchParams.get("periode");
    if (!periode) return NextResponse.json({ error: "parameter periode wajib" }, { status: 400 });
    const rows = await prisma.komisiLedger.findMany({
      where: { periode },
      orderBy: { id: "asc" },
      include: {
        penerima: { select: { id: true, nama: true, kode: true } },
        transaksi: { select: { id: true, nominal: true, tanggal: true, reseller: { select: { nama: true, kode: true } } } },
      },
    });
    const ringkasan = await prisma.komisiLedger.groupBy({
      by: ["resellerId", "status"],
      where: { periode },
      _sum: { nominal: true },
      _count: { id: true },
    });
    const penerimaIds = [...new Set(ringkasan.map((r) => r.resellerId))];
    const penerima = await prisma.reseller.findMany({
      where: { id: { in: penerimaIds } },
      select: { id: true, nama: true, kode: true },
    });
    const peta = new Map(penerima.map((p) => [p.id, p]));
    return NextResponse.json({
      ledger: rows,
      ringkasan: ringkasan.map((r) => ({
        penerima: peta.get(r.resellerId),
        status: r.status,
        total: r._sum.nominal ?? 0,
        jumlah: r._count.id,
      })),
    });
  } catch (e) {
    return err(e);
  }
}
