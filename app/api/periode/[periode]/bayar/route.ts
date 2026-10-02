import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BisnisError } from "@/lib/bisnis";
import { nowIso } from "@/lib/format";
import { err } from "@/lib/api";

export async function POST(_req: NextRequest, { params }: { params: { periode: string } }) {
  try {
    const periode = decodeURIComponent(params.periode);
    if (!/^\d{4}-\d{2}$/.test(periode)) throw new BisnisError(400, "periode harus format YYYY-MM");

    // Pola atomik single-statement: hanya update bila status masih TERBUKA.
    const locked = await prisma.periodeKomisi.updateMany({
      where: { periode, status: "TERBUKA" },
      data: { status: "LUNAS", lockedAt: nowIso() },
    });
    if (locked.count === 0) {
      const p = await prisma.periodeKomisi.findUnique({ where: { periode } });
      if (!p) throw new BisnisError(404, "periode tidak ditemukan");
      throw new BisnisError(409, `periode ${periode} sudah dikunci`);
    }
    const upd = await prisma.komisiLedger.updateMany({
      where: { periode, status: "MENUNGGU" },
      data: { status: "DIBAYAR" },
    });
    return NextResponse.json({ ok: true, periode, ledgerDibayar: upd.count });
  } catch (e) {
    return err(e);
  }
}
