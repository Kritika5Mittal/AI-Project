import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Calculator, GitCompare, PiggyBank } from "lucide-react";
import { useApi } from "../lib/useApi.js";
import { DEMO_DASHBOARD } from "../lib/demo.js";
import { compactInr, inr, pctPlain, shortDate, signClass, signed } from "../lib/format.js";
import { Button, Card, CHART_COLORS, ChartBox, Disclaimer, Notice, PageHeader, Spinner, Stat } from "../components/ui.jsx";

const TYPE_LABEL = { purchase: "Purchase", sip: "SIP", redemption: "Redemption", dividend: "Dividend" };

const QUICK = [
  { to: "/xirr", icon: Calculator, title: "XIRR calculator", text: "Find the annualised return on your cash flows." },
  { to: "/sip", icon: PiggyBank, title: "SIP calculator", text: "Estimate what a monthly SIP could grow to." },
  { to: "/compare", icon: GitCompare, title: "Compare funds", text: "Rank funds on returns, risk and cost." },
];

export default function Dashboard() {
  const { data, error, loading, reload } = useApi("/dashboard/summary");

  if (loading) return <Spinner label="Loading your portfolio…" />;
  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Notice kind="error" title="Couldn't load the dashboard" action={<Button variant="ghost" onClick={reload}>Retry</Button>}>
          {error.message}
        </Notice>
      </>
    );
  }

  const isDemo = data.empty;
  const d = isDemo ? DEMO_DASHBOARD : data;
  const t = d.totals;
  const hasValue = d.performance.some((p) => p.value != null);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your invested amount, current value and annualised return, based on the transactions you've saved." />

      {isDemo && (
        <div className="mb-5">
          <Notice kind="demo" title="Illustrative sample data" action={<Link to="/transactions"><Button variant="ghost">Add transactions</Button></Link>}>
            These numbers are made up to show how the dashboard looks. Add your transactions to see your own portfolio.
          </Notice>
        </div>
      )}
      {(d.warnings || []).map((w) => <div key={w} className="mb-3"><Notice kind="warn">{w}</Notice></div>)}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total invested" value={inr(t.total_invested)} />
        <Stat label="Current value" value={inr(t.current_value)} sub={t.current_value == null ? "Needs units for every holding" : undefined} />
        <Stat
          label="Gain / loss"
          value={signed(t.absolute_gain)}
          tone={signClass(t.absolute_gain)}
          sub={t.absolute_gain_pct != null ? `${pctPlain(t.absolute_gain_pct)} on invested amount` : undefined}
        />
        <Stat
          label="Annualised return (XIRR)"
          value={t.xirr_pct != null ? pctPlain(t.xirr_pct) : "—"}
          tone={signClass(t.xirr_pct)}
          sub={t.xirr_pct == null ? "Shown when cash flows are valid" : "From your dated cash flows"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-lg font-semibold">Portfolio performance</h2>
          {!hasValue && <p className="mt-1 text-xs text-slate-500">Value over time appears once all holdings can be valued.</p>}
          <ChartBox>
            <ResponsiveContainer>
              <AreaChart data={d.performance} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#E8EDF7" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(v) => v.slice(0, 7)} minTickGap={40} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={compactInr} tickLine={false} axisLine={false} width={64} />
                <Tooltip formatter={(v, n) => [inr(v), n === "value" ? "Portfolio value" : "Invested"]} labelFormatter={shortDate} />
                <Area dataKey="invested" type="stepAfter" stroke="#5B6B8C" fill="#5B6B8C" fillOpacity={0.12} strokeWidth={2} />
                {hasValue && <Area dataKey="value" type="monotone" stroke="#0B8F73" fill="#19B3A6" fillOpacity={0.22} strokeWidth={2.5} />}
              </AreaChart>
            </ResponsiveContainer>
          </ChartBox>
          <p className="mt-2 flex gap-4 text-xs text-slate-600">
            <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#5B6B8C]" />Invested</span>
            {hasValue && <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-gain" />Portfolio value</span>}
          </p>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">Allocation</h2>
          <p className="text-xs text-slate-500">By {d.allocation.basis === "current_value" ? "current value" : "amount invested"}</p>
          <ChartBox height={190}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={d.allocation.by_fund} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2}>
                  {d.allocation.by_fund.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => inr(v)} />
              </PieChart>
            </ResponsiveContainer>
          </ChartBox>
          <ul className="mt-2 space-y-1.5 text-sm">
            {d.allocation.by_fund.map((f, i) => (
              <li key={f.name} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="truncate">{f.name}</span>
                </span>
                <span className="num text-slate-600">{pctPlain(f.pct, 1)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent transactions</h2>
            {!isDemo && <Link to="/transactions" className="text-sm font-medium text-navy-700 underline">View all</Link>}
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr><th className="py-2 pr-4 font-medium">Date</th><th className="pr-4 font-medium">Fund</th><th className="pr-4 font-medium">Type</th><th className="text-right font-medium">Amount</th></tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {d.recent_transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="num whitespace-nowrap py-2 pr-4">{shortDate(tx.date)}</td>
                    <td className="max-w-[220px] truncate pr-4">{tx.fund_name || "—"}</td>
                    <td className="pr-4">{TYPE_LABEL[tx.type]}</td>
                    <td className="num text-right">{inr(tx.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Quick actions</h2>
          {QUICK.map(({ to, icon: Icon, title, text }) => (
            <Link key={to} to={to} className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-card transition hover:bg-navy-100">
              <Icon className="mt-0.5 h-5 w-5 text-accent" aria-hidden />
              <span><span className="block font-semibold">{title}</span><span className="text-sm text-slate-600">{text}</span></span>
            </Link>
          ))}
        </div>
      </div>
      <Disclaimer className="mt-8" />
    </>
  );
}
