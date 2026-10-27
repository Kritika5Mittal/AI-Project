const inrFmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const compactFmt = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export const inr = (v) => (v == null || Number.isNaN(v) ? "—" : inrFmt.format(v));
export const compactInr = (v) => (v == null ? "" : `₹${compactFmt.format(v)}`);
// decimal in (0.123) -> "12.3%"
export const pct = (v, d = 1) => (v == null || Number.isNaN(v) ? "—" : `${(v * 100).toFixed(d)}%`);
// already-percent in (12.3) -> "12.30%"
export const pctPlain = (v, d = 2) => (v == null || Number.isNaN(v) ? "—" : `${Number(v).toFixed(d)}%`);
export const num = (v, d = 2) => (v == null || Number.isNaN(v) ? "—" : Number(v).toFixed(d));
export const signClass = (v) => (v > 0 ? "text-gain" : v < 0 ? "text-loss" : "text-navy-900");
export const signed = (v) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${inr(Math.abs(v))}`);

// Local-time ISO date (toISOString would shift the day in IST).
export const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayISO = () => toISO(new Date());
export const monthsAgoISO = (n) => { const d = new Date(); d.setMonth(d.getMonth() - n); return toISO(d); };
export const shortDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const shortName = (name = "") => name.replace(/\s+-\s+.*$/, "");
