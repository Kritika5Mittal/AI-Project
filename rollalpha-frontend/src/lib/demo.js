// ILLUSTRATIVE sample data. Not real funds, not real returns.
// Shown only when the user has no transactions yet, always with a visible label.
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export const DEMO_DASHBOARD = (() => {
  let invested = 0;
  const performance = Array.from({ length: 24 }, (_, i) => {
    const m = i + 1;
    invested += 10000;
    const value = Math.round(invested * (1 + 0.0065 * m + 0.02 * Math.sin(m / 3)));
    return { date: iso(2024 + Math.floor(i / 12), (i % 12) + 1, 28), invested, value };
  });
  const last = performance[performance.length - 1];
  return {
    empty: false, demo: true, valuation_complete: true,
    totals: {
      total_invested: last.invested, total_withdrawn: 0, current_value: last.value,
      absolute_gain: last.value - last.invested,
      absolute_gain_pct: +(((last.value - last.invested) / last.invested) * 100).toFixed(2),
      xirr_pct: 14.2,
    },
    performance,
    allocation: {
      basis: "current_value",
      by_fund: [
        { name: "Sample Flexi Cap Fund", value: Math.round(last.value * 0.5), pct: 50 },
        { name: "Sample Index Fund", value: Math.round(last.value * 0.3), pct: 30 },
        { name: "Sample Hybrid Fund", value: Math.round(last.value * 0.2), pct: 20 },
      ],
    },
    recent_transactions: [
      { id: -1, date: "2025-12-28", type: "sip", amount: 10000, fund_name: "Sample Flexi Cap Fund" },
      { id: -2, date: "2025-11-28", type: "sip", amount: 10000, fund_name: "Sample Flexi Cap Fund" },
      { id: -3, date: "2025-10-28", type: "sip", amount: 10000, fund_name: "Sample Index Fund" },
    ],
    warnings: [],
  };
})();

// Landing-page chart: made-up 3-year rolling return range for an imaginary fund.
export const ROLLING_BAND = Array.from({ length: 48 }, (_, i) => {
  const median = 13 + 4 * Math.sin(i / 7) - i * 0.05;
  const min = median - 5 - 2 * Math.abs(Math.sin(i / 5));
  const max = median + 5 + 2 * Math.abs(Math.cos(i / 6));
  return { i, min: +min.toFixed(1), band: +(max - min).toFixed(1), median: +median.toFixed(1), max: +max.toFixed(1) };
});
