import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reseller Komisi Berjenjang",
  description: "Sistem reseller dengan komisi berjenjang multi-level",
};

function Nav() {
  const links = [
    ["/", "Dashboard"],
    ["/reseller", "Reseller"],
    ["/transaksi", "Transaksi"],
    ["/komisi", "Komisi"],
    ["/laporan", "Laporan Jaringan"],
  ] as const;
  return (
    <nav className="bg-slate-900 text-white">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-6 flex-wrap">
        <span className="font-bold text-lg">🏪 Komisi Berjenjang</span>
        {links.map(([href, label]) => (
          <a key={href} href={href} className="text-sm text-slate-200 hover:text-white hover:underline">
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen text-slate-900">
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
