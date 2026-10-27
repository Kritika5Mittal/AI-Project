
import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const API = "http://127.0.0.1:8000";
const popularFunds = ["HDFC", "ICICI", "SBI", "Nippon"];

const returnPeriods = [
  { key: "1_month", label: "1 Month" },
  { key: "6_months", label: "6 Months" },
  { key: "1_year", label: "1 Year" },
];

function formatNav(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "N/A";
  }

  return number.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function formatReturn(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "N/A";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getReturnClass(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "return-value";
  }

  if (value > 0) return "return-value positive";
  if (value < 0) return "return-value negative";

  return "return-value";
}

export default function FundExplorer() {
  const [search, setSearch] = useState("");
  const [funds, setFunds] = useState([]);
  const [selectedFund, setSelectedFund] = useState(null);

  const [latestNav, setLatestNav] = useState(null);
  const [history, setHistory] = useState([]);
  const [returns, setReturns] = useState(null);

  const [comparisonFunds, setComparisonFunds] = useState([]);
  const [comparisonResults, setComparisonResults] = useState([]);

  const [searchLoading, setSearchLoading] = useState(false);
  const [fundLoading, setFundLoading] = useState(false);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  const [error, setError] = useState("");
  const [comparisonError, setComparisonError] = useState("");

  async function searchFunds(query = search) {
    const cleanedQuery = query.trim();

    if (!cleanedQuery) {
      setError("Please enter a fund name.");
      return;
    }

    setSearch(cleanedQuery);
    setError("");
    setFunds([]);
    setSearchLoading(true);

    try {
      const response = await fetch(
        `${API}/funds/search?q=${encodeURIComponent(cleanedQuery)}`
      );

      if (!response.ok) {
        throw new Error("Fund search failed. Please try again.");
      }

      const results = await response.json();
      setFunds(Array.isArray(results) ? results : []);

      if (!Array.isArray(results) || results.length === 0) {
        setError("No funds found. Try another search.");
      }
    } catch (err) {
      setError(err.message || "Could not connect to the backend.");
    } finally {
      setSearchLoading(false);
    }
  }

  async function selectFund(fund) {
    setSelectedFund(fund);
    setLatestNav(null);
    setHistory([]);
    setReturns(null);
    setError("");
    setFundLoading(true);

    try {
      const [navResponse, historyResponse, returnsResponse] =
        await Promise.all([
          fetch(`${API}/funds/${fund.schemeCode}/latest`),
          fetch(`${API}/funds/${fund.schemeCode}/history`),
          fetch(`${API}/funds/${fund.schemeCode}/returns`),
        ]);

      if (!navResponse.ok) {
        throw new Error("Could not load the latest NAV.");
      }

      if (!historyResponse.ok) {
        throw new Error("Could not load historical NAV data.");
      }

      if (!returnsResponse.ok) {
        throw new Error("Could not calculate fund returns.");
      }

      const navData = await navResponse.json();
      const historyData = await historyResponse.json();
      const returnsData = await returnsResponse.json();

      setLatestNav(navData);
      setHistory(
        Array.isArray(historyData.data) ? historyData.data : []
      );
      setReturns(returnsData.returns || {});
    } catch (err) {
      setError(err.message || "Could not load this fund.");
    } finally {
      setFundLoading(false);
    }
  }

  function addToComparison(fund) {
    setComparisonError("");

    if (
      comparisonFunds.some(
        (item) => item.schemeCode === fund.schemeCode
      )
    ) {
      setComparisonError("This fund is already in your comparison.");
      return;
    }

    if (comparisonFunds.length >= 3) {
      setComparisonError("You can compare up to three funds at a time.");
      return;
    }

    setComparisonFunds((current) => [...current, fund]);
    setComparisonResults([]);
  }

  function removeFromComparison(schemeCode) {
    setComparisonFunds((current) =>
      current.filter((fund) => fund.schemeCode !== schemeCode)
    );

    setComparisonResults([]);
    setComparisonError("");
  }

  function clearComparison() {
    setComparisonFunds([]);
    setComparisonResults([]);
    setComparisonError("");
  }

  async function runComparison() {
    if (comparisonFunds.length < 2) {
      setComparisonError("Add at least two funds to compare.");
      return;
    }

    setComparisonLoading(true);
    setComparisonError("");
    setComparisonResults([]);

    try {
      const codes = comparisonFunds
        .map((fund) => fund.schemeCode)
        .join(",");

      const response = await fetch(
        `${API}/funds/compare?scheme_codes=${encodeURIComponent(codes)}`
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const detail =
          typeof data.detail === "string"
            ? data.detail
            : "Could not compare these funds.";

        throw new Error(detail);
      }

      const data = await response.json();
      setComparisonResults(
        Array.isArray(data.funds) ? data.funds : []
      );

      if (!Array.isArray(data.funds) || data.funds.length === 0) {
        setComparisonError("No comparison results were returned.");
      }
    } catch (err) {
      setComparisonError(
        err.message || "Could not connect to the backend."
      );
    } finally {
      setComparisonLoading(false);
    }
  }

  return (
    <section className="fund-explorer">
      {/* Fund search */}
      <div className="fund-explorer-heading">
        <p className="eyebrow">RESEARCH YOUR INVESTMENTS</p>
        <h2>Mutual Fund Explorer</h2>
        <p>
          Search for a mutual fund to view its latest NAV,
          historical trend, returns, and comparison data.
        </p>
      </div>

      <form
        className="fund-search-form"
        onSubmit={(event) => {
          event.preventDefault();
          searchFunds();
        }}
      >
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search HDFC, SBI, ICICI..."
          aria-label="Search mutual funds"
        />

        <button type="submit" disabled={searchLoading}>
          {searchLoading ? "Searching..." : "Search funds"}
        </button>
      </form>

      <div className="popular-searches">
        <span>Popular:</span>

        {popularFunds.map((name) => (
          <button
            type="button"
            key={name}
            onClick={() => searchFunds(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {error && <p className="fund-error">{error}</p>}

      {searchLoading && (
        <p className="fund-status">Searching for mutual funds...</p>
      )}

      {/* Search results and comparison actions */}
      {funds.length > 0 && (
        <div className="fund-results">
          <h3>Search results</h3>

          {funds.map((fund) => {
            const isAdded = comparisonFunds.some(
              (item) => item.schemeCode === fund.schemeCode
            );

            return (
              <div
                className="fund-result-item"
                key={fund.schemeCode}
              >
                <span className="fund-result-name">
                  {fund.schemeName}
                </span>

                <div className="fund-result-actions">
                  <button
                    type="button"
                    className="fund-view-button"
                    onClick={() => selectFund(fund)}
                  >
                    View
                  </button>

                  <button
                    type="button"
                    className="fund-add-button"
                    disabled={isAdded || comparisonFunds.length >= 3}
                    onClick={() => addToComparison(fund)}
                  >
                    {isAdded ? "Added" : "+ Compare"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fund comparison panel */}
      <section className="comparison-panel">
        <div className="comparison-heading">
          <div>
            <p className="eyebrow">SIDE-BY-SIDE ANALYSIS</p>
            <h3>Compare Funds</h3>
            <p>
              Add 2–3 funds from your search results.
              ({comparisonFunds.length}/3 selected)
            </p>
          </div>

          {comparisonFunds.length > 0 && (
            <button
              type="button"
              className="comparison-clear-button"
              onClick={clearComparison}
            >
              Clear all
            </button>
          )}
        </div>

        {comparisonFunds.length > 0 && (
          <div className="comparison-selected-list">
            {comparisonFunds.map((fund) => (
              <div
                className="comparison-selected-item"
                key={fund.schemeCode}
              >
                <span>{fund.schemeName}</span>

                <button
                  type="button"
                  onClick={() => removeFromComparison(fund.schemeCode)}
                  aria-label={`Remove ${fund.schemeName}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className="comparison-run-button"
          disabled={
            comparisonFunds.length < 2 || comparisonLoading
          }
          onClick={runComparison}
        >
          {comparisonLoading
            ? "Comparing..."
            : "Compare selected funds"}
        </button>

        {comparisonError && (
          <p className="fund-error">{comparisonError}</p>
        )}

        {comparisonResults.length > 0 && (
          <>
            <div className="comparison-table-wrap">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Metric</th>

                    {comparisonResults.map((fund) => (
                      <th key={fund.scheme_code}>
                        {fund.scheme_name}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <th>Latest NAV</th>

                    {comparisonResults.map((fund) => (
                      <td key={fund.scheme_code}>
                        ₹{formatNav(fund.latest_nav)}
                      </td>
                    ))}
                  </tr>

                  {returnPeriods.map((period) => (
                    <tr key={period.key}>
                      <th>{period.label}</th>

                      {comparisonResults.map((fund) => {
                        const value =
                          fund.returns?.[period.key]?.return_percent;

                        const valid =
                          typeof value === "number" &&
                          Number.isFinite(value);

                        const className = !valid
                          ? ""
                          : value > 0
                          ? "comparison-positive"
                          : value < 0
                          ? "comparison-negative"
                          : "";

                        return (
                          <td
                            key={fund.scheme_code}
                            className={className}
                          >
                            {formatReturn(value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  <tr>
                    <th>Latest NAV date</th>

                    {comparisonResults.map((fund) => (
                      <td key={fund.scheme_code}>
                        {fund.latest_date || "N/A"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="chart-disclaimer">
              Returns are historical NAV changes, not guaranteed
              future performance. They exclude distributions and
              transaction costs. Compare dates and fund types before
              drawing conclusions.
            </p>
          </>
        )}
      </section>

      {fundLoading && (
        <p className="fund-status">
          Loading latest NAV, returns, and historical data...
        </p>
      )}

      {/* Selected fund details */}
      {selectedFund && latestNav && !fundLoading && (
        <div className="fund-details">
          <div className="selected-fund-heading">
            <p className="eyebrow">SELECTED SCHEME</p>

            <h3>
              {latestNav.scheme_name || selectedFund.schemeName}
            </h3>

            <p>{latestNav.fund_house || ""}</p>

            {latestNav.category && <p>{latestNav.category}</p>}
          </div>

          {/* Latest NAV cards */}
          <div className="nav-details">
            <div>
              <span className="nav-label">Latest NAV</span>

              <strong>₹{formatNav(latestNav.nav)}</strong>
            </div>

            <div>
              <span className="nav-label">NAV date</span>

              <strong>{latestNav.nav_date || "Not available"}</strong>
            </div>
          </div>

          {/* Historical return cards */}
          <div className="returns-section">
            <div className="returns-heading">
              <h3>Historical Returns</h3>

              <p>
                NAV change as of{" "}
                {returns?.latest_date ||
                  latestNav.nav_date ||
                  "latest available date"}
              </p>
            </div>

            <div className="returns-grid">
              {returnPeriods.map((period) => {
                const result = returns?.[period.key];
                const value = result?.return_percent;

                const available =
                  typeof value === "number" &&
                  Number.isFinite(value);

                return (
                  <div className="return-card" key={period.key}>
                    <span className="return-period">
                      {period.label}
                    </span>

                    <strong className={getReturnClass(value)}>
                      {formatReturn(value)}
                    </strong>

                    <span className="return-caption">
                      {available
                        ? `From ${result.start_date}`
                        : "Insufficient history"}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="returns-disclaimer">
              Based on NAV changes, excluding distributions and
              transaction costs. Past performance does not guarantee
              future results.
            </p>
          </div>

          {/* Historical NAV chart */}
          <div className="history-chart-card">
            <div className="history-chart-heading">
              <div>
                <h3>Historical NAV trend</h3>
                <p>Approximately the last 12 months</p>
              </div>

              <span className="chart-unit">NAV (₹)</span>
            </div>

            {history.length > 1 ? (
              <div className="history-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={history}
                    margin={{
                      top: 12,
                      right: 18,
                      left: 8,
                      bottom: 8,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e5ebe7"
                    />

                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => value.slice(0, 7)}
                      minTickGap={35}
                      tick={{ fontSize: 11 }}
                    />

                    <YAxis
                      domain={["auto", "auto"]}
                      width={70}
                      tick={{ fontSize: 11 }}
                    />

                    <Tooltip
                      labelFormatter={(value) => `Date: ${value}`}
                      formatter={(value) => [
                        `₹${Number(value).toFixed(4)}`,
                        "NAV",
                      ]}
                    />

                    <Line
                      type="monotone"
                      dataKey="nav"
                      name="NAV"
                      stroke="#16845b"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="fund-status">
                Not enough historical data is available to draw a chart.
              </p>
            )}

            <p className="chart-disclaimer">
              This chart shows historical NAV, not total investment
              returns. Past performance does not guarantee future results.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
