import { useState } from "react";
import { Search } from "lucide-react";
import { api } from "../lib/api.js";
import { useApi } from "../lib/useApi.js";
import { Button, Notice, inputCls } from "./ui.jsx";

// Search + filter funds. `renderAction(fund)` renders the buttons on each result row.
export default function FundSearch({ renderAction, placeholder = "Search a fund, e.g. parag parikh" }) {
  const cats = useApi("/funds/categories");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [plan, setPlan] = useState("direct");
  const [option, setOption] = useState("growth");
  const [state, setState] = useState({ loading: false, items: null, error: null });

  async function submit() {
    if (q.trim().length < 3) {
      setState({ loading: false, items: null, error: new Error("Type at least 3 characters to search.") });
      return;
    }
    setState({ loading: true, items: null, error: null });
    const params = new URLSearchParams({ q: q.trim(), limit: "20" });
    if (category) params.set("category", category);
    if (plan) params.set("plan", plan);
    if (option) params.set("option", option);
    try {
      const r = await api.get(`/funds/search?${params}`);
      setState({ loading: false, items: r.items, error: null });
    } catch (error) {
      setState({ loading: false, items: null, error });
    }
  }

  const select = (v, set, label, opts) => (
    <select aria-label={label} className={inputCls} value={v} onChange={(e) => set(e.target.value)}>
      {opts.map(([val, text]) => <option key={val} value={val}>{text}</option>)}
    </select>
  );

  return (
    <div>
      {/* A div, not a <form>: this component is also used inside other forms. */}
      <div role="search" className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label="Fund name"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        />
        <Button type="button" onClick={submit} loading={state.loading}><Search className="h-4 w-4" aria-hidden /> Search</Button>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {select(category, setCategory, "Category", [["", "Any category"], ...(cats.data?.categories || []).map((c) => [c, c])])}
        {select(plan, setPlan, "Plan", [["", "Direct & regular"], ["direct", "Direct plan"], ["regular", "Regular plan"]])}
        {select(option, setOption, "Option", [["", "Growth & IDCW"], ["growth", "Growth"], ["idcw", "IDCW (dividend)"]])}
      </div>
      <p className="mt-1 text-xs text-slate-500">Categories are estimated from fund names.</p>

      <div className="mt-3">
        {state.error && <Notice kind="error">{state.error.message}</Notice>}
        {state.items && state.items.length === 0 && <Notice>No funds matched. Try a shorter name or loosen the filters.</Notice>}
        {state.items && state.items.length > 0 && (
          <ul className="divide-y divide-navy-100 rounded-xl border border-navy-100">
            {state.items.map((f) => (
              <li key={f.scheme_code} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{f.scheme_name}</p>
                  <p className="text-xs text-slate-500">
                    Code {f.scheme_code}{f.category ? ` · ${f.category}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">{renderAction(f)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
