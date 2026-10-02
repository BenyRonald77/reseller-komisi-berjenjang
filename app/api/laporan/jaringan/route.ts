import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pohonJaringan, BisnisError } from "@/lib/bisnis";
import { err } from "@/lib/api";

export async function GET(req: NextRequest) {
  try {
    const rootParam = req.nextUrl.searchParams.get("rootId");
    const rootId = rootParam == null || rootParam === "" ? undefined : Number(rootParam);
    if (rootId !== undefined && !Number.isInteger(rootId))
      throw new BisnisError(400, "rootId tidak valid");
    if (rootId !== undefined) {
      const r = await prisma.reseller.findUnique({ where: { id: rootId } });
      if (!r) throw new BisnisError(404, "root reseller tidak ditemukan");
    }
    const tree = await pohonJaringan(prisma, rootId);
    return NextResponse.json(tree);
  } catch (e) {
    return err(e);
  }
}
