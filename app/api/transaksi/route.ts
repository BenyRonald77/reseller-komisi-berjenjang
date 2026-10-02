import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buatTransaksi, BisnisError } from "@/lib/bisnis";
import { isValidDate, nowIso } from "@/lib/format";
import { err } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const periode = req.nextUrl.searchParams.get("periode");
    const rows = await prisma.transaksi.findMany({
      where: periode ? { periode } : {},
      orderBy: { id: "desc" },
      include: { reseller: { select: { id: true, nama: true, kode: true } } },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return err(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const resellerId = Number(body?.resellerId);
    const nominal = Number(body?.nominal);
    const tanggal = String(body?.tanggal ?? "");

    if (!Number.isInteger(resellerId)) throw new BisnisError(400, "resellerId tidak valid");
    if (!(nominal > 0)) throw new BisnisError(400, "nominal harus lebih dari 0");
    if (!isValidDate(tanggal)) throw new BisnisError(400, "tanggal harus format YYYY-MM-DD");

    const r = await prisma.reseller.findUnique({ where: { id: resellerId } });
    if (!r) throw new BisnisError(404, "reseller tidak ditemukan");

    const { trx, ledger } = await buatTransaksi(prisma, { resellerId, nominal, tanggal });
    return NextResponse.json({ ...trx, ledger }, { status: 201 });
  } catch (e) {
    return err(e);
  }
}
