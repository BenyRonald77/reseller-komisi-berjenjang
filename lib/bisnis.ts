import { Prisma, PrismaClient } from "@prisma/client";
import { periodeOf } from "./format";

export class BisnisError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---------- Pencegahan siklus: descendants via WITH RECURSIVE ----------

export async function descendantIds(
  tx: Pick<PrismaClient, "$queryRaw">,
  resellerId: number
): Promise<number[]> {
  const rows = await tx.$queryRaw<{ id: number }[]>`
    WITH RECURSIVE d(id) AS (
      SELECT id FROM Reseller WHERE uplineId = ${resellerId}
      UNION ALL
      SELECT r.id FROM Reseller r JOIN d ON r.uplineId = d.id
    )
    SELECT id FROM d`;
  return rows.map((r) => r.id);
}

/** Validasi calon upline: tidak boleh diri sendiri / descendant. */
export async function validateUpline(
  tx: Pick<PrismaClient, "$queryRaw">,
  resellerId: number | null,
  uplineId: number | null
) {
  if (uplineId == null) return;
  if (resellerId != null && uplineId === resellerId) {
    throw new BisnisError(422, "siklus terdeteksi: upline tidak boleh diri sendiri");
  }
  if (resellerId != null) {
    const desc = await descendantIds(tx, resellerId);
    if (desc.includes(uplineId)) {
      throw new BisnisError(422, "siklus terdeteksi: upline adalah downline dari reseller");
    }
  }
}

// ---------- Rantai upline ----------

export type ResellerRow = { id: number; nama: string; kode: string; uplineId: number | null };

/** Daftar upline dari level 1 (langsung) sampai maxLevel, atau sampai root. */
export async function uplineChain(
  tx: Pick<PrismaClient, "reseller">,
  resellerId: number,
  maxLevel: number
): Promise<ResellerRow[]> {
  const chain: ResellerRow[] = [];
  let cur = await tx.reseller.findUnique({ where: { id: resellerId } });
  for (let i = 0; i < maxLevel && cur?.uplineId; i++) {
    const up = await tx.reseller.findUnique({ where: { id: cur.uplineId } });
    if (!up) break;
    chain.push({ id: up.id, nama: up.nama, kode: up.kode, uplineId: up.uplineId });
    cur = up;
  }
  return chain;
}

const bulat = (n: number) => Math.round(n * 100) / 100;

// ---------- Komisi otomatis ----------

/** Buat baris ledger untuk transaksi. Mengembalikan daftar ledger terbuat. */
export async function hitungKomisi(
  tx: PrismaClient,
  transaksiId: number,
  resellerId: number,
  nominal: number,
  periode: string
) {
  const configs = await tx.komisiConfig.findMany({ orderBy: { level: "asc" } });
  if (configs.length === 0) return [];
  const chain = await uplineChain(tx, resellerId, configs.length);
  const rows = [];
  for (const cfg of configs) {
    const penerima = chain[cfg.level - 1];
    if (!penerima) continue;
    rows.push({
      resellerId: penerima.id,
      transaksiId,
      level: cfg.level,
      nominal: bulat((nominal * cfg.persen) / 100),
      periode,
      status: "MENUNGGU",
    });
  }
  if (rows.length > 0) await tx.komisiLedger.createMany({ data: rows });
  return rows;
}

/** Buat transaksi + periode (auto) + ledger komisi. */
export async function buatTransaksi(
  tx: PrismaClient,
  data: { resellerId: number; nominal: number; tanggal: string }
) {
  const periode = periodeOf(data.tanggal);
  const trx = await tx.transaksi.create({
    data: {
      resellerId: data.resellerId,
      nominal: data.nominal,
      tanggal: data.tanggal,
      periode,
    },
  });
  await tx.periodeKomisi.upsert({
    where: { periode },
    update: {},
    create: { periode, status: "TERBUKA" },
  });
  const ledger = await hitungKomisi(tx, trx.id, data.resellerId, data.nominal, periode);
  return { trx, ledger };
}

export async function periodeLocked(tx: Pick<PrismaClient, "periodeKomisi">, periode: string) {
  const p = await tx.periodeKomisi.findUnique({ where: { periode } });
  return p?.status === "LUNAS";
}

// ---------- Laporan jaringan: WITH RECURSIVE ----------

export type NodeJaringan = {
  id: number;
  nama: string;
  kode: string;
  uplineId: number | null;
  kedalaman: number;
  omzet: number;
  komisi: number;
  anak: NodeJaringan[];
};

export async function pohonJaringan(
  tx: PrismaClient,
  rootId?: number
): Promise<NodeJaringan[]> {
  type Flat = { id: number; nama: string; kode: string; uplineId: number | null; kedalaman: number };
  let flat: Flat[];
  if (rootId != null) {
    flat = await tx.$queryRaw<Flat[]>`
      WITH RECURSIVE j(id, nama, kode, uplineId, kedalaman) AS (
        SELECT id, nama, kode, uplineId, 0 FROM Reseller WHERE id = ${rootId}
        UNION ALL
        SELECT r.id, r.nama, r.kode, r.uplineId, j.kedalaman + 1
        FROM Reseller r JOIN j ON r.uplineId = j.id
      )
      SELECT id, nama, kode, uplineId, kedalaman FROM j ORDER BY kedalaman, id`;
  } else {
    flat = await tx.$queryRaw<Flat[]>`
      WITH RECURSIVE j(id, nama, kode, uplineId, kedalaman) AS (
        SELECT id, nama, kode, uplineId, 0 FROM Reseller WHERE uplineId IS NULL
        UNION ALL
        SELECT r.id, r.nama, r.kode, r.uplineId, j.kedalaman + 1
        FROM Reseller r JOIN j ON r.uplineId = j.id
      )
      SELECT id, nama, kode, uplineId, kedalaman FROM j ORDER BY kedalaman, id`;
  }
  if (flat.length === 0) return [];

  const ids = flat.map((f) => f.id);
  const omzet = await tx.transaksi.groupBy({
    by: ["resellerId"],
    where: { resellerId: { in: ids } },
    _sum: { nominal: true },
  });
  const kom = await tx.komisiLedger.groupBy({
    by: ["resellerId"],
    where: { resellerId: { in: ids } },
    _sum: { nominal: true },
  });
  const omzetMap = new Map(omzet.map((o) => [o.resellerId, o._sum.nominal ?? 0]));
  const komMap = new Map(kom.map((k) => [k.resellerId, k._sum.nominal ?? 0]));

  const nodes = new Map<number, NodeJaringan>();
  for (const f of flat) {
    nodes.set(f.id, {
      id: f.id,
      nama: f.nama,
      kode: f.kode,
      uplineId: f.uplineId,
      kedalaman: f.kedalaman,
      omzet: omzetMap.get(f.id) ?? 0,
      komisi: komMap.get(f.id) ?? 0,
      anak: [],
    });
  }
  const roots: NodeJaringan[] = [];
  for (const n of nodes.values()) {
    if (n.uplineId != null && nodes.has(n.uplineId)) {
      nodes.get(n.uplineId)!.anak.push(n);
    } else {
      roots.push(n);
    }
  }
  return roots;
}

/** Kedalaman (level) tiap reseller via CTE — dipakai UI pohon. */
export async function semuaLevel(tx: PrismaClient): Promise<Map<number, number>> {
  const rows = await tx.$queryRaw<{ id: number; kedalaman: number }[]>`
    WITH RECURSIVE j(id, kedalaman) AS (
      SELECT id, 0 FROM Reseller WHERE uplineId IS NULL
      UNION ALL
      SELECT r.id, j.kedalaman + 1 FROM Reseller r JOIN j ON r.uplineId = j.id
    )
    SELECT id, kedalaman FROM j`;
  return new Map(rows.map((r) => [r.id, r.kedalaman]));
}
