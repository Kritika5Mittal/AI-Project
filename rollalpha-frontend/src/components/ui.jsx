import { AlertTriangle, Info, Loader2, FlaskConical } from "lucide-react";

export const inputCls =
  "w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:bg-slate-100";

export const DISCLAIMER =
  "RollAlpha AI evaluates historical performance and risk only. Past performance does not guarantee future returns. This is not investment advice.";

export function Card({ className = "", children, ...rest }) {
  return <div className={`rounded-2xl bg-white p-5 shadow-card ${className}`} {...rest}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

const btn = {
  primary: "bg-navy-900 text-white hover:bg-navy-800",
  accent: "bg-accent text-navy-950 hover:brightness-95",
  ghost: "border border-navy-200 bg-white text-navy-900 hover:bg-navy-100",
  onDark: "border border-navy-700 bg-transparent text-white hover:bg-navy-800",
  danger: "border border-loss/30 bg-white text-loss hover:bg-loss-soft",
};
export function Button({ variant = "primary", className = "", loading, children, ...rest }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${btn[variant]} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-navy-800">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const noticeStyle = {
  info: "bg-navy-100 text-navy-800",
  warn: "bg-warn-soft text-warn",
  error: "bg-loss-soft text-loss",
  demo: "border border-dashed border-warn/50 bg-warn-soft text-warn",
};
export function Notice({ kind = "info", title, children, action }) {
  const Icon = kind === "demo" ? FlaskConical : kind === "info" ? Info : AlertTriangle;
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${noticeStyle[kind]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, sub, tone }) {
  return (
    <Card>
      <p className="text-sm text-slate-600">{label}</p>
      <p className={`num mt-1 font-display text-2xl font-bold sm:text-[1.7rem] ${tone || ""}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </Card>
  );
}

export function Spinner({ label = "Loading…" }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-slate-600" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="rounded-xl border border-dashed border-navy-200 px-6 py-10 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Disclaimer({ className = "" }) {
  return <p className={`text-xs leading-relaxed text-slate-500 ${className}`}>{DISCLAIMER}</p>;
}

export function ChartBox({ height = 288, children }) {
  return <div style={{ height }} className="w-full text-xs">{children}</div>;
}

export const CHART_COLORS = ["#14B8A6", "#3B6FE0", "#E0A030", "#B455D4", "#E5614F", "#5B6B8C"];
