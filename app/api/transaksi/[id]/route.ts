import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hitungKomisi, periodeLocked, BisnisError } from "@/lib/bisnis";
import { isValidDate, periodeOf } from "@/lib/format";
import { err } from "@/lib/api";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const t = await prisma.transaksi.findUnique({
      where: { id },
      include: {
        reseller: { select: { id: true, nama: true, kode: true } },
        ledger: { include: { penerima: { select: { nama: true, kode: true } } } },
      },
    });
    if (!t) return NextResponse.json({ error: "transaksi tidak ditemukan" }, { status: 404 });
    return NextResponse.json(t);
  } catch (e) {
    return err(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const t = await prisma.transaksi.findUnique({ where: { id } });
    if (!t) return NextResponse.json({ error: "transaksi tidak ditemukan" }, { status: 404 });
    if (await periodeLocked(prisma, t.periode))
      throw new BisnisError(409, `periode ${t.periode} sudah dikunci, transaksi tidak bisa diubah`);

    const body = await req.json().catch(() => null);
    const nominal = body?.nominal !== undefined ? Number(body.nominal) : t.nominal;
    const tanggal = body?.tanggal !== undefined ? String(body.tanggal) : t.tanggal;
    if (!(nominal > 0)) throw new BisnisError(400, "nominal harus lebih dari 0");
    if (!isValidDate(tanggal)) throw new BisnisError(400, "tanggal harus format YYYY-MM-DD");
    const periodeBaru = periodeOf(tanggal);

    await prisma.$transaction([
      prisma.komisiLedger.deleteMany({ where: { transaksiId: id } }),
      prisma.transaksi.update({ where: { id }, data: { nominal, tanggal, periode: periodeBaru } }),
      prisma.periodeKomisi.upsert({
        where: { periode: periodeBaru },
        update: {},
        create: { periode: periodeBaru, status: "TERBUKA" },
      }),
    ]);
    const ledger = await hitungKomisi(prisma, id, t.resellerId, nominal, periodeBaru);
    const updated = await prisma.transaksi.findUnique({ where: { id } });
    return NextResponse.json({ ...updated, ledger });
  } catch (e) {
    return err(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const t = await prisma.transaksi.findUnique({ where: { id } });
    if (!t) return NextResponse.json({ error: "transaksi tidak ditemukan" }, { status: 404 });
    if (await periodeLocked(prisma, t.periode))
      throw new BisnisError(409, `periode ${t.periode} sudah dikunci, transaksi tidak bisa dihapus`);

    // Ledger ikut terhapus via onDelete: Cascade.
    await prisma.transaksi.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return err(e);
  }
}
