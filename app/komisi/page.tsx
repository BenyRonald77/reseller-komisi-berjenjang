"use client";
import { useEffect, useState } from "react";
import { rupiah } from "@/lib/format";

type Ledger = {
  id: number; level: number; nominal: number; periode: string; status: string;
  penerima: { id: number; nama: string; kode: string };
  transaksi: { id: number; nominal: number; tanggal: string; reseller: { nama: string; kode: string } };
};
type Ringkasan = { penerima: { nama: string; kode: string }; status: string; total: number; jumlah: number };
type Periode = { id: number; periode: string; status: string; lockedAt: string | null };

export default function KomisiPage() {
  const [periodes, setPeriodes] = useState<Periode[]>([]);
  const [periode, setPeriode] = useState("");
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [ringkasan, setRingkasan] = useState<Ringkasan[]>([]);
  const [config, setConfig] = useState<{ level: number; persen: number }[]>([]);
  const [msg, setMsg] = useState("");

  const loadPeriode = () => fetch("/api/periode").then((r) => r.json()).then((ps: Periode[]) => {
    setPeriodes(ps);
    if (!periode && ps.length > 0) setPeriode(ps[0].periode);
  });
  const loadConfig = () => fetch("/api/komisi-config").then((r) => r.json()).then(setConfig);

  useEffect(() => { loadPeriode(); loadConfig(); }, []);
  useEffect(() => {
    if (!periode) return;
    fetch(`/api/ledger?periode=${periode}`).then((r) => r.json()).then((d) => {
      setLedger(d.ledger ?? []); setRingkasan(d.ringkasan ?? []);
    });
  }, [periode]);

  const bayar = async () => {
    if (!confirm(`Bayar & kunci periode ${periode}? Setelah dikunci tidak bisa diubah.`)) return;
    const res = await fetch(`/api/periode/${periode}/bayar`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setMsg("❌ " + (data.error ?? "gagal")); return; }
    setMsg(`✅ periode ${periode} dibayar & dikunci (${data.ledgerDibayar} baris komisi)`);
    loadPeriode();
  };

  const simpanConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/komisi-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg("❌ " + (data.error ?? "gagal")); return; }
    setConfig(data); setMsg("✅ konfigurasi komisi tersimpan");
  };

  const statusPeriode = periodes.find((p) => p.periode === periode)?.status;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Komisi per Periode</h1>
      {msg && <div className="card text-sm">{msg}</div>}

      <div className="card">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="label">Periode</label>
            <select className="input" value={periode} onChange={(e) => setPeriode(e.target.value)}>
              {periodes.map((p) => <option key={p.id} value={p.periode}>{p.periode} — {p.status}</option>)}
            </select>
          </div>
          <button className="btn-green" onClick={bayar} disabled={!periode || statusPeriode === "LUNAS"}>
            {statusPeriode === "LUNAS" ? "🔒 Sudah Dikunci" : "💰 Bayar & Kunci Periode"}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Ringkasan per Penerima ({periode || "-"})</h2>
        <table className="table">
          <thead><tr><th>Penerima</th><th>Status</th><th>Baris</th><th>Total</th></tr></thead>
          <tbody>
            {ringkasan.map((r, i) => (
              <tr key={i}>
                <td>{r.penerima.kode} — {r.penerima.nama}</td>
                <td><span className={`px-2 py-0.5 rounded text-xs ${r.status === "DIBAYAR" ? "bg-slate-200" : "bg-amber-100 text-amber-800"}`}>{r.status}</span></td>
                <td>{r.jumlah}</td>
                <td className="font-medium">{rupiah(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">Ledger Komisi</h2>
        <table className="table">
          <thead><tr><th>#</th><th>Penerima</th><th>Level</th><th>Nominal</th><th>Dari Transaksi</th><th>Status</th></tr></thead>
          <tbody>
            {ledger.map((l) => (
              <tr key={l.id}>
                <td>{l.id}</td>
                <td>{l.penerima.kode} — {l.penerima.nama}</td>
                <td>{l.level}</td>
                <td className="font-medium">{rupiah(l.nominal)}</td>
                <td className="text-xs text-slate-500">#{l.transaksi.id} {l.transaksi.reseller.kode} ({rupiah(l.transaksi.nominal)})</td>
                <td><span className={`px-2 py-0.5 rounded text-xs ${l.status === "DIBAYAR" ? "bg-slate-200" : "bg-amber-100 text-amber-800"}`}>{l.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card max-w-xl">
        <h2 className="font-semibold mb-3">Konfigurasi Persentase per Level</h2>
        <form onSubmit={simpanConfig} className="space-y-3">
          {config.map((c, i) => (
            <div key={c.level} className="flex items-center gap-2">
              <span className="text-sm w-20">Level {c.level}</span>
              <input className="input" type="number" min="0" max="100" step="0.01" value={c.persen}
                onChange={(e) => { const nx = [...config]; nx[i] = { ...c, persen: Number(e.target.value) }; setConfig(nx); }} />
              <span className="text-sm">%</span>
            </div>
          ))}
          <button className="btn" type="submit">Simpan Konfigurasi</button>
        </form>
      </div>
    </div>
  );
}
