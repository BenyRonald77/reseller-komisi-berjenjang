import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateUpline, semuaLevel, BisnisError } from "@/lib/bisnis";
import { err } from "@/lib/api";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const r = await prisma.reseller.findUnique({
      where: { id },
      include: { upline: { select: { id: true, nama: true, kode: true } } },
    });
    if (!r) return NextResponse.json({ error: "reseller tidak ditemukan" }, { status: 404 });
    const levels = await semuaLevel(prisma);
    return NextResponse.json({ ...r, level: levels.get(r.id) ?? 0 });
  } catch (e) {
    return err(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const r = await prisma.reseller.findUnique({ where: { id } });
    if (!r) return NextResponse.json({ error: "reseller tidak ditemukan" }, { status: 404 });

    const body = await req.json().catch(() => null);
    const data: { nama?: string; kode?: string; kontak?: string | null; uplineId?: number | null } = {};

    if (body?.nama !== undefined) {
      const nama = String(body.nama).trim();
      if (!nama) throw new BisnisError(400, "nama wajib diisi");
      data.nama = nama;
    }
    if (body?.kode !== undefined) {
      const kode = String(body.kode).trim();
      if (!kode) throw new BisnisError(400, "kode wajib diisi");
      data.kode = kode;
    }
    if (body?.kontak !== undefined) data.kontak = body.kontak ? String(body.kontak).trim() : null;
    if (body?.uplineId !== undefined) {
      const uplineId = body.uplineId == null ? null : Number(body.uplineId);
      if (uplineId != null && !Number.isInteger(uplineId)) throw new BisnisError(400, "uplineId tidak valid");
      if (uplineId != null) {
        const up = await prisma.reseller.findUnique({ where: { id: uplineId } });
        if (!up) throw new BisnisError(404, "upline tidak ditemukan");
      }
      await validateUpline(prisma, id, uplineId);
      data.uplineId = uplineId;
    }

    const updated = await prisma.reseller.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (e) {
    return err(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id);
    const r = await prisma.reseller.findUnique({ where: { id } });
    if (!r) return NextResponse.json({ error: "reseller tidak ditemukan" }, { status: 404 });

    const jmlAnak = await prisma.reseller.count({ where: { uplineId: id } });
    if (jmlAnak > 0)
      throw new BisnisError(409, "reseller masih punya downline, pindahkan dulu uplinenya");
    const jmlTrx = await prisma.transaksi.count({ where: { resellerId: id } });
    if (jmlTrx > 0) throw new BisnisError(409, "reseller masih punya transaksi");

    await prisma.reseller.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return err(e);
  }
}
