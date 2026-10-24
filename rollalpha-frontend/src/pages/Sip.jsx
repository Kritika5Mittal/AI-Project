import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api.js";
import { compactInr, inr, signClass } from "../lib/format.js";
import { Button, Card, ChartBox, Disclaimer, Field, Notice, PageHeader, Stat, inputCls } from "../components/ui.jsx";

const FREQ = [["monthly", "Monthly"], ["quarterly", "Quarterly"], ["half_yearly", "Every 6 months"], ["yearly", "Yearly"]];

export default function Sip() {
  const [f, setF] = useState({ amount: "10000", years: "10", rate: "12", frequency: "monthly", stepUp: "0" });
  const [state, setState] = useState({ loading: false, result: null, error: null });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  function validate() {
    const errs = [];
    if (!(+f.amount > 0)) errs.push("Enter an investment amount greater than zero.");
    if (!Number.isInteger(+f.years) || +f.years < 1 || +f.years > 50) errs.push("Duration must be a whole number of years between 1 and 50.");
    if (f.rate === "" || +f.rate < 0 || +f.rate > 50) errs.push("Expected return must be between 0% and 50%.");
    if (+f.stepUp < 0 || +f.stepUp > 50) errs.push("Annual step-up must be between 0% and 50%.");
    return errs;
  }

  async function calculate() {
    const errs = validate();
    if (errs.length) return setState({ loading: false, result: null, error: { message: errs.join(" ") } });
    setState({ loading: true, result: null, error: null });
    try {
      const result = await api.post("/sip/calculate", {
        amount: +f.amount, years: +f.years, annual_return_pct: +f.rate, frequency: f.frequency, annual_step_up_pct: +f.stepUp || 0,
      });
      setState({ loading: false, result, error: null });
    } catch (error) {
      setState({ loading: false, result: null, error });
    }
  }

  const r = state.result;
  const freqLabel = FREQ.find(([v]) => v === f.frequency)?.[1].toLowerCase();

  return (
    <>
      <PageHeader title="SIP calculator" subtitle="Estimate what regular investments could grow to if a fund earned a steady return. It's a what-if, not a forecast." />

      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={`Amount per instalment (₹)`} hint={`Invested ${freqLabel}`}>
            <input type="number" min="1" inputMode="decimal" className={inputCls} value={f.amount} onChange={set("amount")} />
          </Field>
          <Field label="Investment frequency">
            <select className={inputCls} value={f.frequency} onChange={set("frequency")}>{FREQ.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          </Field>
          <Field label="Duration (years)">
            <input type="number" min="1" max="50" className={inputCls} value={f.years} onChange={set("years")} />
          </Field>
          <Field label="Expected annual return (%)" hint="An assumption you choose. Real returns vary.">
            <input type="number" min="0" max="50" step="0.1" className={inputCls} value={f.rate} onChange={set("rate")} />
          </Field>
          <Field label="Yearly step-up (%)" hint="Optional: raise the instalment each year.">
            <input type="number" min="0" max="50" step="1" className={inputCls} value={f.stepUp} onChange={set("stepUp")} />
          </Field>
        </div>
        <Button className="mt-5" onClick={calculate} loading={state.loading}>Calculate</Button>
      </Card>

      {state.error && <div className="mt-5"><Notice kind="error" title="Check your inputs">{state.error.message}</Notice></div>}

      {r && (
        <div className="mt-6 space-y-5">
          <Notice kind="warn" title="This is an estimate">
            It assumes the same return every year. Real fund returns go up and down and aren't guaranteed. It's separate from your actual portfolio return (XIRR).
          </Notice>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Total amount invested" value={inr(r.total_invested)} />
            <Stat label="Estimated future value" value={inr(r.estimated_future_value)} />
            <Stat label="Estimated gain" value={inr(r.estimated_gain)} tone={signClass(r.estimated_gain)} />
          </div>

          <Card>
            <h2 className="text-lg font-semibold">Estimated growth</h2>
            <ChartBox>
              <ResponsiveContainer>
                <AreaChart data={r.yearly_breakdown} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#E8EDF7" vertical={false} />
                  <XAxis dataKey="year" tickFormatter={(v) => `Yr ${v}`} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={compactInr} tickLine={false} axisLine={false} width={64} />
                  <Tooltip formatter={(v, n) => [inr(v), n === "invested" ? "Invested" : "Estimated value"]} labelFormatter={(v) => `End of year ${v}`} />
                  <Area dataKey="estimated_value" stroke="#0B8F73" fill="#19B3A6" fillOpacity={0.25} strokeWidth={2.5} />
                  <Area dataKey="invested" stroke="#5B6B8C" fill="#5B6B8C" fillOpacity={0.14} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartBox>
            <p className="mt-2 flex gap-4 text-xs text-slate-600">
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-gain" />Estimated value</span>
              <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#5B6B8C]" />Invested</span>
            </p>
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-semibold">Year-by-year breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-right text-xs text-slate-500">
                  <tr><th className="py-2 text-left font-medium">Year</th><th className="font-medium">Instalment</th><th className="font-medium">Invested</th><th className="font-medium">Estimated value</th><th className="font-medium">Estimated gain</th></tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {r.yearly_breakdown.map((y) => (
                    <tr key={y.year} className="num text-right">
                      <td className="py-2 text-left">{y.year}</td><td>{inr(y.instalment_amount)}</td><td>{inr(y.invested)}</td><td>{inr(y.estimated_value)}</td><td className={signClass(y.estimated_gain)}>{inr(y.estimated_gain)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
      <Disclaimer className="mt-8" />
    </>
  );
}
