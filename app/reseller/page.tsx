"use client";
import { useEffect, useState } from "react";

type Reseller = {
  id: number; nama: string; kode: string; kontak: string | null;
  uplineId: number | null; level: number;
  upline: { id: number; nama: string; kode: string } | null;
};

type Node = Reseller & { anak: Node[] };

function buildTree(rows: Reseller[]): Node[] {
  const map = new Map<number, Node>();
  rows.forEach((r) => map.set(r.id, { ...r, anak: [] }));
  const roots: Node[] = [];
  map.forEach((n) => {
    if (n.uplineId != null && map.has(n.uplineId)) map.get(n.uplineId)!.anak.push(n);
    else roots.push(n);
  });
  return roots;
}

function TreeNode({ node, onEdit, onHapus }: { node: Node; onEdit: (r: Reseller) => void; onHapus: (r: Reseller) => void }) {
  return (
    <div className="ml-4 mt-1 border-l-2 border-slate-200 pl-3">
      <div className="flex items-center gap-2 py-1 flex-wrap">
        <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{node.kode}</span>
        <span className="font-medium">{node.nama}</span>
        <span className="text-xs text-slate-500">level {node.level}</span>
        {node.kontak && <span className="text-xs text-slate-500">{node.kontak}</span>}
        <button className="text-xs text-blue-600 hover:underline" onClick={() => onEdit(node)}>ubah</button>
        <button className="text-xs text-red-600 hover:underline" onClick={() => onHapus(node)}>hapus</button>
      </div>
      {node.anak.map((c) => (
        <TreeNode key={c.id} node={c} onEdit={onEdit} onHapus={onHapus} />
      ))}
    </div>
  );
}

export default function ResellerPage() {
  const [rows, setRows] = useState<Reseller[]>([]);
  const [nama, setNama] = useState("");
  const [kode, setKode] = useState("");
  const [kontak, setKontak] = useState("");
  const [uplineId, setUplineId] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const load = () => fetch("/api/reseller").then((r) => r.json()).then(setRows);
  useEffect(() => { load(); }, []);

  const reset = () => {
    setNama(""); setKode(""); setKontak(""); setUplineId(""); setEditId(null);
  };

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    const payload = { nama, kode, kontak: kontak || null, uplineId: uplineId ? Number(uplineId) : null };
    const res = await fetch(editId ? `/api/reseller/${editId}` : "/api/reseller", {
      method: editId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { setMsg("❌ " + (data.error ?? "gagal")); return; }
    setMsg("✅ tersimpan"); reset(); load();
  };

  const hapus = async (r: Reseller) => {
    if (!confirm(`Hapus reseller ${r.nama}?`)) return;
    const res = await fetch(`/api/reseller/${r.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setMsg("❌ " + (data.error ?? "gagal")); return; }
    setMsg("✅ dihapus"); load();
  };

  const tree = buildTree(rows);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Master Reseller</h1>
      {msg && <div className="card text-sm">{msg}</div>}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-3">{editId ? "Ubah Reseller" : "Tambah Reseller"}</h2>
          <form onSubmit={simpan} className="space-y-3">
            <div><label className="label">Nama</label><input className="input" value={nama} onChange={(e) => setNama(e.target.value)} required /></div>
            <div><label className="label">Kode (unik)</label><input className="input" value={kode} onChange={(e) => setKode(e.target.value)} required disabled={!!editId} /></div>
            <div><label className="label">Kontak</label><input className="input" value={kontak} onChange={(e) => setKontak(e.target.value)} /></div>
            <div>
              <label className="label">Upline (kosongkan = root)</label>
              <select className="input" value={uplineId} onChange={(e) => setUplineId(e.target.value)}>
                <option value="">— root —</option>
                {rows.filter((r) => r.id !== editId).map((r) => (
                  <option key={r.id} value={r.id}>{r.kode} — {r.nama} (level {r.level})</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button className="btn" type="submit">Simpan</button>
              {editId && <button className="btn" type="button" onClick={reset}>Batal</button>}
            </div>
          </form>
        </div>
        <div className="card">
          <h2 className="font-semibold mb-3">Pohon Jaringan</h2>
          {tree.map((n) => (
            <TreeNode key={n.id} node={n} onEdit={(r) => { setEditId(r.id); setNama(r.nama); setKode(r.kode); setKontak(r.kontak ?? ""); setUplineId(r.uplineId ? String(r.uplineId) : ""); }} onHapus={hapus} />
          ))}
          {tree.length === 0 && <p className="text-sm text-slate-500">Belum ada reseller.</p>}
        </div>
      </div>
    </div>
  );
}
