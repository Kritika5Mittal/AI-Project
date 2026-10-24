import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { api, ApiError } from "../lib/api.js";
import { inr, monthsAgoISO, pctPlain, signClass, signed, todayISO } from "../lib/format.js";
import { Button, Card, Disclaimer, Field, Notice, PageHeader, Stat, inputCls } from "../components/ui.jsx";

const KINDS = [
  ["investment", "Investment (money you put in)"],
  ["withdrawal", "Withdrawal (money you took out)"],
  ["current", "Current portfolio value"],
];
let nextId = 1;
const blank = (kind = "investment") => ({ id: nextId++, date: "", kind, amount: "" });

export default function Xirr() {
  const [rows, setRows] = useState([blank(), blank("current")]);
  const [state, setState] = useState({ loading: false, result: null, errors: [], warnings: [] });

  const update = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id) => setRows((rs) => (rs.length > 2 ? rs.filter((r) => r.id !== id) : rs));

  function loadExample() {
    const sips = [12, 10, 8, 6, 4, 2].map((m) => ({ id: nextId++, date: monthsAgoISO(m), kind: "investment", amount: "10000" }));
    setRows([...sips, { id: nextId++, date: todayISO(), kind: "current", amount: "66500" }]);
    setState({ loading: false, result: null, errors: [], warnings: [] });
  }

  // Checks we can do before calling the backend; the backend repeats the important ones.
  function validate() {
    const errs = [];
    const today = todayISO();
    rows.forEach((r, i) => {
      const n = i + 1;
      if (!r.date) errs.push(`Row ${n}: choose a date.`);
      else if (r.date > today) errs.push(`Row ${n}: the date can't be in the future.`);
      if (r.amount === "" || Number.isNaN(+r.amount) || +r.amount <= 0) errs.push(`Row ${n}: enter an amount greater than zero.`);
    });
    if (!rows.some((r) => r.kind === "investment")) errs.push("Add at least one investment.");
    if (!rows.some((r) => r.kind !== "investment")) errs.push("Add a withdrawal or the current portfolio value.");
    return errs;
  }

  async function calculate() {
    const errors = validate();
    if (errors.length) return setState({ loading: false, result: null, errors, warnings: [] });
    setState({ loading: true, result: null, errors: [], warnings: [] });
    try {
      // Backend convention: investments negative, withdrawals / final value positive.
      const cashflows = rows.map((r) => ({ date: r.date, amount: r.kind === "investment" ? -Math.abs(+r.amount) : Math.abs(+r.amount) }));
      const result = await api.post("/xirr", { cashflows });
      setState({ loading: false, result, errors: [], warnings: result.warnings || [] });
    } catch (e) {
      const detail = e instanceof ApiError ? e.detail : null;
      setState({ loading: false, result: null, errors: detail?.errors || [e.message], warnings: detail?.warnings || [] });
    }
  }

  const { result } = state;

  return (
    <>
      <PageHeader
        title="XIRR calculator"
        subtitle="XIRR is the single yearly return that explains all your dated investments and withdrawals. It's the right measure for SIPs, where money goes in at different times."
        actions={<Button variant="ghost" onClick={loadExample}>Load example</Button>}
      />

      <Card>
        <h2 className="mb-1 text-lg font-semibold">Cash flows</h2>
        <p className="mb-4 text-xs text-slate-500">Enter every amount as a positive number and pick its type. We send investments as negative and everything else as positive.</p>
        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={r.id} className="grid items-end gap-3 rounded-xl bg-canvas p-3 sm:grid-cols-[150px_1fr_160px_auto]">
              <Field label={`Date (row ${i + 1})`}>
                <input type="date" max={todayISO()} className={inputCls} value={r.date} onChange={(e) => update(r.id, { date: e.target.value })} />
              </Field>
              <Field label="Type">
                <select className={inputCls} value={r.kind} onChange={(e) => update(r.id, { kind: e.target.value })}>
                  {KINDS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              </Field>
              <Field label="Amount (₹)">
                <input type="number" min="0" step="any" inputMode="decimal" className={inputCls} value={r.amount} onChange={(e) => update(r.id, { amount: e.target.value })} />
              </Field>
              <button onClick={() => remove(r.id)} disabled={rows.length <= 2} aria-label={`Remove row ${i + 1}`} className="mb-0.5 rounded-lg p-2 text-slate-500 hover:bg-white hover:text-loss disabled:opacity-30">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="ghost" onClick={() => setRows((rs) => [...rs, blank()])}><Plus className="h-4 w-4" aria-hidden /> Add row</Button>
          <Button onClick={calculate} loading={state.loading}>Calculate XIRR</Button>
        </div>
      </Card>

      {state.errors.length > 0 && (
        <div className="mt-5">
          <Notice kind="error" title="XIRR can't be calculated yet">
            <ul className="list-disc pl-5">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </Notice>
        </div>
      )}
      {state.warnings.map((w) => <div key={w} className="mt-3"><Notice kind="warn">{w}</Notice></div>)}

      {result && (
        <div className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Annualised return (XIRR)" value={pctPlain(result.xirr_pct)} tone={signClass(result.xirr_pct)} sub="Per year, on your actual cash flows" />
            <Stat label="Total invested" value={inr(result.total_invested)} />
            <Stat label="Total withdrawals / final value" value={inr(result.total_withdrawals)} />
            <Stat label="Net gain or loss" value={signed(result.net_gain)} tone={signClass(result.net_gain)} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            XIRR is calculated on the server from your dates and amounts. It describes what happened, not what will happen.
          </p>
        </div>
      )}
      <Disclaimer className="mt-8" />
    </>
  );
}
