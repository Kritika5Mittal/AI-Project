import { Link } from "react-router-dom";
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { GitCompare, Calculator, PiggyBank, MessageSquare, ArrowRight } from "lucide-react";
import Logo from "../components/Logo.jsx";
import { Button, ChartBox, DISCLAIMER } from "../components/ui.jsx";
import { ROLLING_BAND } from "../lib/demo.js";

const FEATURES = [
  { icon: GitCompare, title: "Compare funds on one scale", wide: true,
    text: "Rank funds in the same category by CAGR, rolling returns, drawdown, Sharpe ratio and cost. Every weight in the score is published, so you can see why a fund ranked where it did." },
  { icon: Calculator, title: "XIRR for real cash flows",
    text: "Enter your SIP instalments and withdrawals. Get one annualised rate, calculated by the backend, not an average of returns." },
  { icon: PiggyBank, title: "SIP projections, labelled as estimates",
    text: "See what a monthly SIP could grow to under an assumed return. Projections never get mixed up with your actual results." },
  { icon: MessageSquare, title: "An assistant that explains", wide: true,
    text: "Ask what a metric means or how to read a comparison. The assistant explains concepts in plain language and never promises returns." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-navy-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/"><Logo /></Link>
          <nav aria-label="Primary" className="hidden items-center gap-6 text-sm font-medium text-navy-800 sm:flex">
            <a href="#features" className="hover:underline">Features</a>
            <a href="#about" className="hover:underline">About</a>
            <a href="#disclaimer" className="hover:underline">Disclaimer</a>
          </nav>
          <Link to="/dashboard"><Button>Open app</Button></Link>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-navy-950 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div>
            <h1 className="text-4xl font-bold leading-[1.1] sm:text-5xl">Make Smarter Mutual Fund Decisions</h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-navy-200">
              Compare funds on returns, risk and cost with a score you can inspect. Check what your SIP has really earned with XIRR,
              and ask the assistant whenever a term is unclear.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/dashboard"><Button variant="accent" className="px-5 py-2.5">Explore Dashboard <ArrowRight className="h-4 w-4" aria-hidden /></Button></Link>
              <Link to="/compare"><Button variant="onDark" className="px-5 py-2.5">Compare Funds</Button></Link>
            </div>
          </div>

          {/* Signature element: rolling-return band */}
          <figure className="rounded-2xl bg-navy-900 p-5 ring-1 ring-navy-700">
            <figcaption className="mb-3">
              <p className="font-display text-base font-semibold">3-year rolling returns: the range, not one number</p>
              <p className="mt-1 text-xs text-navy-300">
                Illustrative sample for an imaginary fund. Not real data. The band shows the best and worst 3-year result an
                investor could have had; the line is the median.
              </p>
            </figcaption>
            <ChartBox height={260}>
              <ResponsiveContainer>
                <ComposedChart data={ROLLING_BAND} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#20397A" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="i" tick={{ fill: "#9FB0D6" }} tickLine={false} axisLine={false} tickFormatter={(v) => (v % 12 === 0 ? `Yr ${v / 12 + 1}` : "")} />
                  <YAxis tick={{ fill: "#9FB0D6" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{ background: "#0A1226", border: "1px solid #20397A", borderRadius: 8, color: "#fff" }}
                    formatter={(v, n) => [`${v}%`, n === "median" ? "Median" : n === "min" ? "Worst" : "Range width"]}
                    labelFormatter={(v) => `Month ${v + 1}`}
                  />
                  <Area dataKey="min" stackId="r" stroke="none" fill="transparent" isAnimationActive={false} />
                  <Area dataKey="band" stackId="r" stroke="none" fill="#19B3A6" fillOpacity={0.28} isAnimationActive={false} />
                  <Line dataKey="median" stroke="#19B3A6" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartBox>
          </figure>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-bold sm:text-3xl">What you can do</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text, wide }) => (
            <div key={title} className={`rounded-2xl bg-canvas p-6 shadow-card ${wide ? "md:col-span-2" : ""}`}>
              <Icon className="h-6 w-6 text-accent" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="about" className="bg-canvas">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold">About RollAlpha AI</h2>
          <p className="mt-3 leading-relaxed text-slate-700">
            RollAlpha AI is built for beginner investors who want to understand mutual funds before they choose one. It looks at how
            a fund behaved in the past: returns, consistency, risk and cost. It turns that into a ranking whose method is open to inspection.
          </p>
        </div>
      </section>

      <section id="disclaimer" className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h2 className="text-xl font-bold">Disclaimer</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {DISCLAIMER} Mutual fund investments are subject to market risks. Read all scheme-related documents carefully, and consider
          speaking to a SEBI-registered investment adviser before making decisions.
        </p>
      </section>

      <footer id="contact" className="bg-navy-950 text-navy-300">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm sm:px-6">
          <Logo light />
          <nav aria-label="Footer" className="flex gap-6">
            <a href="#about" className="hover:text-white">About</a>
            <a href="#features" className="hover:text-white">Features</a>
            <a href="mailto:contact@rollalpha.example" className="hover:text-white">Contact</a>
            <a href="#disclaimer" className="hover:text-white">Disclaimer</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
