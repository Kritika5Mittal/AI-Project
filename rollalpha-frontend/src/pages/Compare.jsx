import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDown, ArrowUp, Plus, Target, X } from "lucide-react";
import { api } from "../lib/api.js";
import { num, pct, shortName, signClass } from "../lib/format.js";
import FundSearch from "../components/FundSearch.jsx";
import { Button, Card, CHART_COLORS, ChartBox, Disclaimer, Field, Notice, PageHeader, inputCls } from "../components/ui.jsx";

const PERIODS = [["", "Full history of each fund"], ["3", "Last 3 years"], ["5", "Last 5 years"], ["7", "Last 7 years"]];

// key = metric key (or "score"); lowerBetter only matters for the default sort direction
const COLS = [
  { key: "score", label: "Score", get: (r) => r.score, fmt: (v) => num(v, 1) },
  { key: "cagr_1y", label: "1Y return", get: (r) => r.metrics.cagr_1y, fmt: pct, signed: true },
  { key: "cagr_3y", label: "3Y CAGR", get: (r) => r.metrics.cagr_3y, fmt: pct, signed: true },
  { key: "cagr_5y", label: "5Y CAGR", get: (r) => r.metrics.cagr_5y, fmt: pct, signed: true },
  { key: "cagr_since_inception", label: "Since launch", get: (r) => r.metrics.cagr_since_inception, fmt: pct, signed: true },
  { key: "excess_cagr", label: "vs benchmark", get: (r) => r.metrics.excess_cagr, fmt: pct, signed: true, needsBench: true },
  { key: "std_dev", label: "Std dev", get: (r) => r.metrics.std_dev, fmt: pct, lowerBetter: true },
  { key: "sharpe", label: "Sharpe", get: (r) => r.metrics.sharpe, fmt: (v) => num(v, 2) },
  { key: "max_drawdown", label: "Max drawdown", get: (r) => r.metrics.max_drawdown, fmt: pct, signed: true },
  { key: "expense_ratio", label: "Expense ratio", get: (r) => r.metrics.expense_ratio, fmt: (v) => pct(v, 2), lowerBetter: true },
];

// month -> last value in that month, so series with different dates line up on one chart
function monthly(series) {
  const m = new Map();
  for (const p of series) m.set(p.date.slice(0, 7), p.value);
  return m;
}

export default function Compare() {
  const [selected, setSelected] = useState([]); // [{code, name, expense}]
  const [bench, setBench] = useState(null); // {code, name}
  const [period, setPeriod] = useState("");
  const [state, setState] = useState({ loading: false, result: null, growth: null, error: null });
  const [sort, setSort] = useState({ key: "score", dir: "desc" });

  const add = (f) =>
    setSelected((s) => (s.some((x) => x.code === f.scheme_code) || s.length >= 6 ? s : [...s, { code: f.scheme_code, name: f.scheme_name, expense: "" }]));
  const remove = (code) => setSelected((s) => s.filter((x) => x.code !== code));
  const setExpense = (code, v) => setSelected((s) => s.map((x) => (x.code === code ? { ...x, expense: v } : x)));

  async function runCompare() {
    setState({ loading: true, result: null, growth: null, error: null });
    const expense_ratios = {};
    selected.forEach((x) => { if (x.expense !== "" && !Number.isNaN(+x.expense)) expense_ratios[x.code] = +x.expense / 100; });
    try {
      const result = await api.post("/funds/compare", {
        scheme_codes: selected.map((x) => x.code),
        benchmark_code: bench?.code ?? null,
        period_years: period ? +period : null,
        expense_ratios,
      });
      setSort({ key: "score", dir: "desc" });
      setState({ loading: false, result, growth: null, error: null });
      loadGrowth(result);
    } catch (error) {
      setState({ loading: false, result: null, growth: null, error });
    }
  }

  async function loadGrowth(result) {
    const years = period ? +period : 5;
    const codes = [...result.ranking.map((r) => r.scheme_code), ...(bench ? [bench.code] : [])];
    const settled = await Promise.allSettled(codes.map((c) => api.get(`/funds/${c}/nav-history?years=${years}&rebase=true&points=400`)));
    const maps = {};
    settled.forEach((s, i) => { if (s.status === "fulfilled" && s.value.series.length) maps[codes[i]] = monthly(s.value.series); });
    const months = [...new Set(Object.values(maps).flatMap((m) => [...m.keys()]))].sort();
    const rows = months.map((month) => ({ month, ...Object.fromEntries(Object.entries(maps).map(([c, m]) => [c, m.get(month) ?? null])) }));
    setState((s) => ({ ...s, growth: { rows, years } }));
  }

  const { result } = state;
  const hasBench = !!result?.benchmark;
  const cols = COLS.filter((c) => !c.needsBench || hasBench);

  const rows = useMemo(() => {
    if (!result) return [];
    const col = COLS.find((c) => c.key === sort.key);
    const sorted = [...result.ranking].sort((a, b) => {
      const va = col.get(a), vb = col.get(b);
      if (va == null) return 1;
      if (vb == null) return -1;
      return sort.dir === "asc" ? va - vb : vb - va;
    });
    return sorted;
  }, [result, sort]);

  const nameOf = (code) => shortName(result.ranking.find((r) => r.scheme_code === code)?.name || bench?.name || String(code));
  const toggleSort = (c) =>
    setSort((s) => (s.key === c.key ? { key: c.key, dir: s.dir === "desc" ? "asc" : "desc" } : { key: c.key, dir: c.lowerBetter ? "asc" : "desc" }));

  const barData = result
    ? [["1Y", "cagr_1y"], ["3Y", "cagr_3y"], ["5Y", "cagr_5y"]].map(([label, k]) => ({
        period: label,
        ...Object.fromEntries(result.ranking.map((r) => [r.scheme_code, r.metrics[k] == null ? null : +(r.metrics[k] * 100).toFixed(2)])),
        ...(hasBench ? { bench: result.benchmark.returns[k] == null ? null : +(result.benchmark.returns[k] * 100).toFixed(2) } : {}),
      }))
    : [];

  return (
    <>
      <PageHeader
        title="Compare mutual funds"
        subtitle="Pick two or more funds from the same category. Compare Direct with Direct and Growth with Growth, otherwise costs and returns aren't like for like."
      />

      <Card>
        <h2 className="mb-3 text-lg font-semibold">1. Find funds</h2>
        <FundSearch
          renderAction={(f) => (
            <>
              <Button variant="ghost" className="px-3 py-1.5" onClick={() => add(f)} disabled={selected.some((x) => x.code === f.scheme_code)}>
                <Plus className="h-4 w-4" aria-hidden /> Add
              </Button>
              <Button variant="ghost" className="px-3 py-1.5" onClick={() => setBench({ code: f.scheme_code, name: f.scheme_name })} title="Use an index fund as the benchmark">
                <Target className="h-4 w-4" aria-hidden /> Benchmark
              </Button>
            </>
          )}
        />
      </Card>

      <Card className="mt-5">
        <h2 className="mb-3 text-lg font-semibold">2. Review your selection</h2>
        {selected.length === 0 ? (
          <p className="text-sm text-slate-600">Add at least two funds above (up to six).</p>
        ) : (
          <ul className="space-y-2">
            {selected.map((x) => (
              <li key={x.code} className="flex flex-wrap items-center gap-3 rounded-xl bg-canvas px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{x.name}</span>
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  Expense ratio %
                  <input type="number" step="0.01" min="0" max="5" placeholder="optional" value={x.expense} onChange={(e) => setExpense(x.code, e.target.value)} className={`${inputCls} w-24 py-1`} />
                </label>
                <button onClick={() => remove(x.code)} aria-label={`Remove ${x.name}`} className="rounded p-1 text-slate-500 hover:bg-white hover:text-loss"><X className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
        {bench && (
          <p className="mt-3 flex items-center gap-2 text-sm">
            <Target className="h-4 w-4 text-accent" aria-hidden /> Benchmark: <strong className="font-semibold">{shortName(bench.name)}</strong>
            <button onClick={() => setBench(null)} className="text-xs text-slate-500 underline">remove</button>
          </p>
        )}
        {!bench && <p className="mt-3 text-xs text-slate-500">Optional: pick an index fund (for example a Nifty 50 index fund) as a benchmark proxy. Prefer one that tracks a total-return index.</p>}

        <div className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_auto]">
          <Field label="Calculation period" hint="Use one window for all funds so risk numbers cover the same market conditions.">
            <select className={inputCls} value={period} onChange={(e) => setPeriod(e.target.value)}>
              {PERIODS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </Field>
          <Button onClick={runCompare} disabled={selected.length < 2} loading={state.loading}>Compare funds</Button>
        </div>
        {selected.length === 1 && <p className="mt-2 text-xs text-slate-500">Add one more fund to compare.</p>}
      </Card>

      {state.error && <div className="mt-5"><Notice kind="error" title="Couldn't compare these funds">{state.error.message}</Notice></div>}

      {result && (
        <div className="mt-6 space-y-5">
          <Notice kind="info" title="About these numbers">
            Source: {result.data.source}. Data as of {result.data.data_as_of}. Period: {result.data.calculation_period}. {result.data.return_note}
            {" "}Scores are relative to the funds you picked, not absolute grades.
          </Notice>
          {result.warnings.map((w) => <Notice key={w} kind="warn">{w}</Notice>)}
          {result.excluded.map((x) => <Notice key={x.scheme_code} kind="warn">Fund {x.scheme_code} was left out: {x.reason}.</Notice>)}

          <Card>
            <h2 className="text-lg font-semibold">Summary table</h2>
            <p className="mb-3 text-xs text-slate-500">Click a column heading to sort. A dash means there isn't enough history for that figure.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-navy-100 text-left text-xs text-slate-600">
                    <th className="sticky left-0 bg-white py-2 pr-4 font-medium">Fund</th>
                    {cols.map((c) => (
                      <th key={c.key} className="px-2 py-2 text-right font-medium" aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                        <button onClick={() => toggleSort(c)} className="inline-flex items-center gap-1 hover:text-navy-900">
                          {c.label}
                          {sort.key === c.key && (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-100">
                  {rows.map((r) => (
                    <tr key={r.scheme_code}>
                      <td className="sticky left-0 max-w-[260px] bg-white py-3 pr-4">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[result.ranking.findIndex((x) => x.scheme_code === r.scheme_code)] }} aria-hidden />
                          <span>
                            <span className="block truncate font-medium">{shortName(r.name)}</span>
                            <span className="text-xs text-slate-500">Rank {r.rank}{r.category ? ` · ${r.category}` : ""}</span>
                          </span>
                        </span>
                      </td>
                      {cols.map((c) => {
                        const v = c.get(r);
                        return <td key={c.key} className={`num px-2 py-3 text-right ${c.signed ? signClass(v) : ""} ${c.key === "score" ? "font-semibold" : ""}`}>{c.fmt(v)}</td>;
                      })}
                    </tr>
                  ))}
                  {hasBench && (
                    <tr className="bg-navy-100/60">
                      <td className="sticky left-0 bg-navy-100 py-3 pr-4 font-medium">Benchmark: {shortName(result.benchmark.name)}</td>
                      {cols.map((c) => {
                        const map = { cagr_1y: "cagr_1y", cagr_3y: "cagr_3y", cagr_5y: "cagr_5y", cagr_since_inception: "cagr_since_inception", std_dev: "std_dev", max_drawdown: "max_drawdown" };
                        const v = map[c.key] ? result.benchmark.returns[map[c.key]] : undefined;
                        return <td key={c.key} className="num px-2 py-3 text-right">{v === undefined ? "" : c.fmt(v)}</td>;
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <h2 className="text-lg font-semibold">Returns by period</h2>
              <p className="mb-2 text-xs text-slate-500">1Y is the plain one-year return; 3Y and 5Y are annualised.</p>
              <ChartBox>
                <ResponsiveContainer>
                  <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="#E8EDF7" vertical={false} />
                    <XAxis dataKey="period" tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={44} />
                    <Tooltip formatter={(v, k) => [v == null ? "—" : `${v}%`, k === "bench" ? "Benchmark" : nameOf(+k)]} />
                    <Legend formatter={(k) => (k === "bench" ? "Benchmark" : nameOf(+k))} wrapperStyle={{ fontSize: 11 }} />
                    {result.ranking.map((r, i) => <Bar key={r.scheme_code} dataKey={String(r.scheme_code)} fill={CHART_COLORS[i]} radius={[3, 3, 0, 0]} />)}
                    {hasBench && <Bar dataKey="bench" fill="#9AA6BF" radius={[3, 3, 0, 0]} />}
                  </BarChart>
                </ResponsiveContainer>
              </ChartBox>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold">Growth of 100</h2>
              <p className="mb-2 text-xs text-slate-500">
                {state.growth ? `NAV rebased to 100 at the start of the last ${state.growth.years} years. Past growth, not a forecast.` : "Loading history…"}
              </p>
              <ChartBox>
                {state.growth && (
                  <ResponsiveContainer>
                    <LineChart data={state.growth.rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="#E8EDF7" vertical={false} />
                      <XAxis dataKey="month" minTickGap={40} tickLine={false} axisLine={false} />
                      <YAxis domain={["auto", "auto"]} tickLine={false} axisLine={false} width={40} />
                      <Tooltip formatter={(v, k) => [v == null ? "—" : v.toFixed(1), nameOf(+k)]} />
                      <Legend formatter={(k) => nameOf(+k)} wrapperStyle={{ fontSize: 11 }} />
                      {result.ranking.map((r, i) => <Line key={r.scheme_code} dataKey={String(r.scheme_code)} stroke={CHART_COLORS[i]} strokeWidth={2} dot={false} connectNulls />)}
                      {bench && <Line dataKey={String(bench.code)} stroke="#5B6B8C" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartBox>
            </Card>
          </div>

          <Card>
            <h2 className="text-lg font-semibold">How each score is built</h2>
            <p className="mb-3 text-xs text-slate-500">Points each metric adds to the 0–100 score. Weights are published on the backend (/api/methodology).</p>
            <div className="space-y-3">
              {result.ranking.map((r, i) => (
                <details key={r.scheme_code} className="rounded-xl bg-canvas px-4 py-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    {shortName(r.name)} <span className="num ml-2 text-slate-600">{num(r.score, 1)} / 100</span>
                    {r.coverage < 1 && <span className="ml-2 text-xs text-warn">(only {Math.round(r.coverage * 100)}% of metrics available)</span>}
                  </summary>
                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    {Object.entries(r.breakdown).map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-navy-100 py-1">
                        <dt className="text-slate-600">{k.replaceAll("_", " ")}</dt><dd className="num">{num(v, 1)}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              ))}
            </div>
          </Card>
          <Disclaimer />
        </div>
      )}
    </>
  );
}
