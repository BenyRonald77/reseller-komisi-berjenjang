import { NextResponse } from "next/server";
import { BisnisError } from "@/lib/bisnis";

export function err(e: unknown) {
  if (e instanceof BisnisError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof Error && (e as { code?: string }).code === "P2002") {
    return NextResponse.json({ error: "kode sudah dipakai" }, { status: 409 });
  }
  console.error(e);
  return NextResponse.json({ error: "kesalahan server" }, { status: 500 });
}
