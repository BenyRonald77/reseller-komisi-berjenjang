import { prisma } from "@/lib/prisma";
import { rupiah } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [jmlReseller, jmlTransaksi, omzet, komisiMenunggu, periode] = await Promise.all([
    prisma.reseller.count(),
    prisma.transaksi.count(),
    prisma.transaksi.aggregate({ _sum: { nominal: true } }),
    prisma.komisiLedger.aggregate({
      where: { status: "MENUNGGU" },
      _sum: { nominal: true },
    }),
    prisma.periodeKomisi.findMany({ orderBy: { periode: "desc" } }),
  ]);

  const stats = [
    ["Total Reseller", String(jmlReseller)],
    ["Total Transaksi", String(jmlTransaksi)],
    ["Total Omzet", rupiah(omzet._sum.nominal ?? 0)],
    ["Komisi Menunggu Dibayar", rupiah(komisiMenunggu._sum.nominal ?? 0)],
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(([label, val]) => (
          <div key={label} className="card">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-xl font-bold mt-1">{val}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <h2 className="font-semibold mb-3">Periode Komisi</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Periode</th>
              <th>Status</th>
              <th>Dikunci</th>
            </tr>
          </thead>
          <tbody>
            {periode.map((p) => (
              <tr key={p.id}>
                <td className="font-mono">{p.periode}</td>
                <td>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      p.status === "LUNAS" ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="text-slate-500 text-xs">{p.lockedAt ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
