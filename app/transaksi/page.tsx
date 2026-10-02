"use client";
import { useEffect, useState } from "react";
import { rupiah, today } from "@/lib/format";

type Reseller = { id: number; nama: string; kode: string };
type Transaksi = {
  id: number; nominal: number; tanggal: string; periode: string;
  reseller: Reseller;
};

export default function TransaksiPage() {
  const [rows, setRows] = useState<Transaksi[]>([]);
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [resellerId, setResellerId] = useState("");
  const [nominal, setNominal] = useState("");
  const [tanggal, setTanggal] = useState(today());
  const [msg, setMsg] = useState("");

  const load = () => {
    fetch("/api/transaksi").then((r) => r.json()).then(setRows);
    fetch("/api/reseller").then((r) => r.json()).then(setResellers);
  };
  useEffect(() => { load(); }, []);

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/transaksi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resellerId: Number(resellerId), nominal: Number(nominal), tanggal }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg("❌ " + (data.error ?? "gagal")); return; }
    const jml = data.ledger?.length ?? 0;
    setMsg(`✅ transaksi tersimpan, ${jml} baris komisi dibuat`);
    setNominal(""); load();
  };

  const hapus = async (t: Transaksi) => {
    if (!confirm(`Hapus transaksi #${t.id} (${rupiah(t.nominal)})?`)) return;
    const res = await fetch(`/api/transaksi/${t.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { setMsg("❌ " + (data.error ?? "gagal")); return; }
    setMsg("✅ transaksi dihapus"); load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transaksi Penjualan</h1>
      {msg && <div className="card text-sm">{msg}</div>}
      <div className="card max-w-xl">
        <h2 className="font-semibold mb-3">Catat Transaksi</h2>
        <form onSubmit={simpan} className="space-y-3">
          <div>
            <label className="label">Reseller (penjual)</label>
            <select className="input" value={resellerId} onChange={(e) => setResellerId(e.target.value)} required>
              <option value="">— pilih —</option>
              {resellers.map((r) => <option key={r.id} value={r.id}>{r.kode} — {r.nama}</option>)}
            </select>
          </div>
          <div><label className="label">Nominal</label><input className="input" type="number" min="1" value={nominal} onChange={(e) => setNominal(e.target.value)} required /></div>
          <div><label className="label">Tanggal</label><input className="input" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} required /></div>
          <button className="btn" type="submit">Simpan (komisi otomatis)</button>
        </form>
      </div>
      <div className="card">
        <h2 className="font-semibold mb-3">Riwayat Transaksi</h2>
        <table className="table">
          <thead><tr><th>ID</th><th>Tanggal</th><th>Penjual</th><th>Nominal</th><th>Periode</th><th></th></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>#{t.id}</td>
                <td className="font-mono">{t.tanggal}</td>
                <td>{t.reseller.kode} — {t.reseller.nama}</td>
                <td className="font-medium">{rupiah(t.nominal)}</td>
                <td className="font-mono text-xs">{t.periode}</td>
                <td><button className="btn-red" onClick={() => hapus(t)}>hapus</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
