import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateUpline, semuaLevel, BisnisError } from "@/lib/bisnis";
import { err } from "@/lib/api";

export async function GET() {
  try {
    const rows = await prisma.reseller.findMany({
      orderBy: { id: "asc" },
      include: { upline: { select: { id: true, nama: true, kode: true } } },
    });
    const levels = await semuaLevel(prisma);
    return NextResponse.json(rows.map((r) => ({ ...r, level: levels.get(r.id) ?? 0 })));
  } catch (e) {
    return err(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const nama = String(body?.nama ?? "").trim();
    const kode = String(body?.kode ?? "").trim();
    const kontak = body?.kontak ? String(body.kontak).trim() : null;
    const uplineId = body?.uplineId == null ? null : Number(body.uplineId);

    if (!nama) throw new BisnisError(400, "nama wajib diisi");
    if (!kode) throw new BisnisError(400, "kode wajib diisi");
    if (uplineId != null && !Number.isInteger(uplineId)) throw new BisnisError(400, "uplineId tidak valid");

    if (uplineId != null) {
      const up = await prisma.reseller.findUnique({ where: { id: uplineId } });
      if (!up) throw new BisnisError(404, "upline tidak ditemukan");
    }

    const created = await prisma.reseller.create({
      data: { nama, kode, kontak, uplineId },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return err(e);
  }
}
