export const rupiah = (n: number) =>
  "Rp" + Math.round(n).toLocaleString("id-ID");

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

export const nowIso = () => new Date().toISOString();

export const periodeOf = (tanggal: string) => tanggal.slice(0, 7);

export const isValidDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
