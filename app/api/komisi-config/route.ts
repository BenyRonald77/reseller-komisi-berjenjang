import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BisnisError } from "@/lib/bisnis";
import { err } from "@/lib/api";

export async function GET() {
  try {
    const rows = await prisma.komisiConfig.findMany({ orderBy: { level: "asc" } });
    return NextResponse.json(rows);
  } catch (e) {
    return err(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const items: { level: number; persen: number }[] = body?.config ?? [];
    if (!Array.isArray(items) || items.length === 0)
      throw new BisnisError(400, "config wajib berupa array tidak kosong");
    for (const it of items) {
      if (!Number.isInteger(it.level) || it.level < 1)
        throw new BisnisError(400, `level tidak valid: ${it.level}`);
      if (typeof it.persen !== "number" || it.persen < 0 || it.persen > 100)
        throw new BisnisError(400, `persen level ${it.level} harus 0–100`);
    }
    // Upsert per level, hapus level yang tidak ada di payload
    const levels = items.map((i) => i.level);
    await prisma.$transaction([
      prisma.komisiConfig.deleteMany({ where: { level: { notIn: levels } } }),
      ...items.map((it) =>
        prisma.komisiConfig.upsert({
          where: { level: it.level },
          update: { persen: it.persen },
          create: { level: it.level, persen: it.persen },
        })
      ),
    ]);
    const rows = await prisma.komisiConfig.findMany({ orderBy: { level: "asc" } });
    return NextResponse.json(rows);
  } catch (e) {
    return err(e);
  }
}
