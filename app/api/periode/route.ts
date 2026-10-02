import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BisnisError } from "@/lib/bisnis";
import { err } from "@/lib/api";

export async function GET() {
  try {
    const rows = await prisma.periodeKomisi.findMany({ orderBy: { periode: "desc" } });
    return NextResponse.json(rows);
  } catch (e) {
    return err(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const periode = String(body?.periode ?? "");
    if (!/^\d{4}-\d{2}$/.test(periode)) throw new BisnisError(400, "periode harus format YYYY-MM");
    const created = await prisma.periodeKomisi.upsert({
      where: { periode },
      update: {},
      create: { periode, status: "TERBUKA" },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return err(e);
  }
}
