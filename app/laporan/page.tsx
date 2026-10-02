"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { rupiah } from "@/lib/format";

type Node = {
  id: number; nama: string; kode: string; kedalaman: number;
  omzet: number; komisi: number; anak: Node[];
};
type Reseller = { id: number; nama: string; kode: string };

function TreeNode({ node }: { node: Node }) {
  return (
    <div className="ml-4 mt-1 border-l-2 border-emerald-200 pl-3">
      <div className="py-1 flex items-center gap-2 flex-wrap text-sm">
        <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{node.kode}</span>
        <span className="font-medium">{node.nama}</span>
        <span className="text-xs text-slate-500">level {node.kedalaman}</span>
        <span className="text-xs">omzet: <b>{rupiah(node.omzet)}</b></span>
        <span className="text-xs">komisi: <b className="text-emerald-700">{rupiah(node.komisi)}</b></span>
      </div>
      {node.anak.map((c) => <TreeNode key={c.id} node={c} />)}
    </div>
  );
}

function LaporanInner() {
  const params = useSearchParams();
  const [tree, setTree] = useState<Node[]>([]);
  const [roots, setRoots] = useState<Reseller[]>([]);
  const [rootId, setRootId] = useState(params.get("rootId") ?? "");

  useEffect(() => {
    fetch("/api/reseller").then((r) => r.json()).then((rs: (Reseller & { uplineId: number | null })[]) =>
      setRoots(rs.filter((r) => r.uplineId == null)));
  }, []);
  useEffect(() => {
    const q = rootId ? `?rootId=${rootId}` : "";
    fetch(`/api/laporan/jaringan${q}`).then((r) => r.json()).then(setTree);
  }, [rootId]);

  const hitung = (ns: Node[]): { omzet: number; komisi: number; orang: number } =>
    ns.reduce((a, n) => {
      const c = hitung(n.anak);
      return { omzet: a.omzet + n.omzet + c.omzet, komisi: a.komisi + n.komisi + c.komisi, orang: a.orang + 1 + c.orang };
    }, { omzet: 0, komisi: 0, orang: 0 });
  const tot = hitung(tree);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Laporan Jaringan</h1>
      <div className="card flex items-end gap-3 flex-wrap">
        <div>
          <label className="label">Root (kosongkan = semua root)</label>
          <select className="input" value={rootId} onChange={(e) => setRootId(e.target.value)}>
            <option value="">— semua —</option>
            {roots.map((r) => <option key={r.id} value={r.id}>{r.kode} — {r.nama}</option>)}
          </select>
        </div>
        <div className="text-sm text-slate-600">
          {tot.orang} reseller · total omzet <b>{rupiah(tot.omzet)}</b> · total komisi <b className="text-emerald-700">{rupiah(tot.komisi)}</b>
        </div>
      </div>
      <div className="card">
        {tree.map((n) => <TreeNode key={n.id} node={n} />)}
        {tree.length === 0 && <p className="text-sm text-slate-500">Tidak ada data.</p>}
      </div>
    </div>
  );
}

export default function LaporanPage() {
  return (
    <Suspense fallback={<div className="card">Memuat…</div>}>
      <LaporanInner />
    </Suspense>
  );
}
