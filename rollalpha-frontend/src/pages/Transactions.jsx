import { useState } from "react";
import { Download, Pencil, Plus, Trash2, X } from "lucide-react";
import { api } from "../lib/api.js";
import { useApi } from "../lib/useApi.js";
import { inr, shortDate, todayISO } from "../lib/format.js";
import FundSearch from "../components/FundSearch.jsx";
import { Button, Card, Disclaimer, EmptyState, Field, Notice, PageHeader, Spinner, inputCls } from "../components/ui.jsx";

const TYPES = { purchase: "Lump-sum purchase", sip: "SIP instalment", redemption: "Redemption", dividend: "Dividend payout" };
const MONEY_IN = new Set(["redemption", "dividend"]);
const SORTS = {
  newest: { sort: "date", order: "desc", label: "Newest first" },
  oldest: { sort: "date", order: "asc", label: "Oldest first" },
  high: { sort: "amount", order: "desc", label: "Amount: high to low" },
  low: { sort: "amount", order: "asc", label: "Amount: low to high" },
};
const PAGE = 15;
const emptyForm = { date: todayISO(), type: "sip", amount: "", scheme_code: "", fund_name: "", units: "", notes: "" };

function TransactionForm({ initial, onCancel, onSaved }) {
  const editing = !!initial.id;
  const [f, setF] = useState(initial.id ? {
    date: initial.date, type: initial.type, amount: String(initial.amount), scheme_code: initial.scheme_code ?? "",
    fund_name: initial.fund_name ?? "", units: initial.units != null && initial.units_source === "user" ? String(initial.units) : "", notes: initial.notes ?? "",
  } : initial);
  const [pick, setPick] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const errs = [];
    if (!f.date) errs.push("Choose a date.");
    else if (f.date > todayISO()) errs.push("The date can't be in the future.");
    if (!(+f.amount > 0)) errs.push("Enter an amount greater than zero.");
    if (f.units !== "" && !(+f.units > 0)) errs.push("Units must be greater than zero, or left blank.");
    if (errs.length) return setErrors(errs);

    // Empty optional fields are left out so the server can fill units from that day's NAV.
    const payload = { date: f.date, type: f.type, amount: +f.amount, notes: f.notes };
    if (f.scheme_code !== "") payload.scheme_code = +f.scheme_code;
    if (f.fund_name) payload.fund_name = f.fund_name;
    if (f.units !== "") payload.units = +f.units;

    setSaving(true);
    setErrors([]);
    try {
      if (editing) await api.put(`/transactions/${initial.id}`, payload);
      else await api.post("/transactions", payload);
      onSaved();
    } catch (err) {
      setErrors([err.message]);
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{editing ? "Edit transaction" : "Add transaction"}</h2>
        <button onClick={onCancel} aria-label="Close form" className="rounded p-1 text-slate-500 hover:bg-navy-100"><X className="h-5 w-5" /></button>
      </div>
      <form onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date"><input type="date" max={todayISO()} className={inputCls} value={f.date} onChange={set("date")} /></Field>
          <Field label="Type">
            <select className={inputCls} value={f.type} onChange={set("type")}>{Object.entries(TYPES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          </Field>
          <Field label="Amount (₹)"><input type="number" min="0" step="any" inputMode="decimal" className={inputCls} value={f.amount} onChange={set("amount")} /></Field>
          <Field label="Units" hint="Optional. Leave blank to estimate from that day's NAV."><input type="number" min="0" step="any" className={inputCls} value={f.units} onChange={set("units")} /></Field>
        </div>

        <div className="mt-4 rounded-xl bg-canvas p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              <span className="font-medium">Fund: </span>
              {f.fund_name ? `${f.fund_name} (code ${f.scheme_code})` : <span className="text-slate-500">none selected. Pick one so the dashboard can value this holding.</span>}
            </p>
            <Button type="button" variant="ghost" onClick={() => setPick((p) => !p)}>{pick ? "Hide search" : "Find fund"}</Button>
          </div>
          {pick && (
            <div className="mt-3">
              <FundSearch
                renderAction={(fund) => (
                  <Button type="button" variant="ghost" className="px-3 py-1.5" onClick={() => { setF((s) => ({ ...s, scheme_code: fund.scheme_code, fund_name: fund.scheme_name })); setPick(false); }}>
                    Select
                  </Button>
                )}
              />
            </div>
          )}
        </div>

        <Field label="Notes" className="mt-4"><input maxLength={500} className={inputCls} value={f.notes} onChange={set("notes")} placeholder="Optional" /></Field>

        {errors.length > 0 && <div className="mt-4"><Notice kind="error"><ul className="list-disc pl-5">{errors.map((x) => <li key={x}>{x}</li>)}</ul></Notice></div>}
        <div className="mt-5 flex gap-3">
          <Button type="submit" loading={saving}>{editing ? "Save changes" : "Add transaction"}</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}

export default function Transactions() {
  const [filters, setFilters] = useState({ type: "", date_from: "", date_to: "", sortKey: "newest" });
  const [offset, setOffset] = useState(0);
  const [form, setForm] = useState(null); // null | emptyForm | transaction
  const [notice, setNotice] = useState(null);

  const s = SORTS[filters.sortKey];
  const params = new URLSearchParams({ sort: s.sort, order: s.order, limit: String(PAGE), offset: String(offset) });
  if (filters.type) params.set("type", filters.type);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  const { data, error, loading, reload } = useApi(`/transactions?${params}`);

  const setFilter = (k) => (e) => { setFilters((f) => ({ ...f, [k]: e.target.value })); setOffset(0); };

  async function remove(tx) {
    if (!window.confirm(`Delete this ${TYPES[tx.type].toLowerCase()} of ${inr(tx.amount)} on ${shortDate(tx.date)}?`)) return;
    try {
      await api.del(`/transactions/${tx.id}`);
      setNotice(null);
      reload();
    } catch (e) {
      setNotice(e.message);
    }
  }

  const total = data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Record your purchases, SIP instalments and redemptions. The dashboard and your XIRR are calculated from these."
        actions={
          <div className="flex gap-2">
            <a href={api.url("/transactions/export.csv")} download className="inline-flex items-center gap-2 rounded-lg border border-navy-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-navy-100">
              <Download className="h-4 w-4" aria-hidden /> Export CSV
            </a>
            <Button onClick={() => setForm({ ...emptyForm, date: todayISO() })}><Plus className="h-4 w-4" aria-hidden /> Add transaction</Button>
          </div>
        }
      />

      {form && <TransactionForm key={form.id ?? "new"} initial={form} onCancel={() => setForm(null)} onSaved={() => { setForm(null); setOffset(0); reload(); }} />}
      {notice && <div className="mb-4"><Notice kind="error">{notice}</Notice></div>}

      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Type">
            <select className={inputCls} value={filters.type} onChange={setFilter("type")}>
              <option value="">All types</option>
              {Object.entries(TYPES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </Field>
          <Field label="From"><input type="date" className={inputCls} value={filters.date_from} onChange={setFilter("date_from")} /></Field>
          <Field label="To"><input type="date" className={inputCls} value={filters.date_to} onChange={setFilter("date_to")} /></Field>
          <Field label="Sort by">
            <select className={inputCls} value={filters.sortKey} onChange={setFilter("sortKey")}>{Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          </Field>
        </div>

        {loading && <Spinner />}
        {error && <Notice kind="error" title="Couldn't load transactions" action={<Button variant="ghost" onClick={reload}>Retry</Button>}>{error.message}</Notice>}
        {data && data.items.length === 0 && (
          <EmptyState title={filters.type || filters.date_from || filters.date_to ? "No transactions match these filters" : "No transactions yet"}
            action={!filters.type && !filters.date_from && !filters.date_to ? <Button onClick={() => setForm({ ...emptyForm, date: todayISO() })}>Add your first transaction</Button> : null}>
            {filters.type || filters.date_from || filters.date_to ? "Try clearing a filter." : "Add a SIP instalment or purchase to start tracking your portfolio."}
          </EmptyState>
        )}

        {data && data.items.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Date</th><th className="pr-3 font-medium">Fund</th><th className="pr-3 font-medium">Type</th>
                    <th className="pr-3 text-right font-medium">Amount</th><th className="pr-3 text-right font-medium">Units</th><th className="pr-3 text-right font-medium">NAV</th><th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {data.items.map((tx) => (
                    <tr key={tx.id}>
                      <td className="num whitespace-nowrap py-3 pr-3">{shortDate(tx.date)}</td>
                      <td className="max-w-[240px] truncate pr-3" title={tx.fund_name || ""}>{tx.fund_name || <span className="text-slate-400">—</span>}</td>
                      <td className="whitespace-nowrap pr-3">{TYPES[tx.type]}</td>
                      <td className={`num whitespace-nowrap pr-3 text-right font-medium ${MONEY_IN.has(tx.type) ? "text-gain" : ""}`}>{MONEY_IN.has(tx.type) ? "+" : "−"}{inr(tx.amount)}</td>
                      <td className="num pr-3 text-right">
                        {tx.units != null ? tx.units : "—"}
                        {tx.units_source === "derived" && <span title="Estimated from that day's NAV" className="ml-1 rounded bg-warn-soft px-1 text-[10px] font-semibold text-warn">est.</span>}
                      </td>
                      <td className="num pr-3 text-right">{tx.nav ?? "—"}</td>
                      <td className="whitespace-nowrap text-right">
                        <button onClick={() => { setForm(tx); window.scrollTo({ top: 0, behavior: "smooth" }); }} aria-label="Edit transaction" className="rounded p-1.5 text-slate-500 hover:bg-navy-100"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(tx)} aria-label="Delete transaction" className="rounded p-1.5 text-slate-500 hover:bg-loss-soft hover:text-loss"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <span className="num">{offset + 1}–{Math.min(offset + PAGE, total)} of {total}</span>
              <div className="flex gap-2">
                <Button variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</Button>
                <Button variant="ghost" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Card>
      <Disclaimer className="mt-8" />
    </>
  );
}
