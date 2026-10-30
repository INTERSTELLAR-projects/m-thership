import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, RefreshCw, DollarSign, Percent, Landmark, Wallet, AlertTriangle } from "lucide-react";
import GameChartTooltip from "../charts/GameChartTooltip";

const money = (n) =>
  `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const monthShort = (key) => {
  const [y, m] = String(key).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
};

const monthFull = (key) => {
  const [y, m] = String(key).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

export default function StripeRevenue() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    base44.functions
      .invoke("stripeRevenue", {})
      .then((res) => {
        if (alive) setData(res.data);
      })
      .catch((e) => {
        if (alive) setError(e?.response?.data?.error || "Could not reach Stripe");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [nonce]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-ink/[0.38] animate-spin" />
      </div>
    );
  }

  if (!data?.configured) {
    return (
      <div className="game-panel p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
            Stripe not connected
          </h3>
        </div>
        <p className="text-ink/65 text-sm mb-4">
          Add a read-only Stripe key to start pulling every payment, fee and Capital repayment into this page.
        </p>
        <ol className="space-y-2 text-sm text-ink/70 list-decimal list-inside">
          <li>Open Stripe Dashboard → Developers → API keys.</li>
          <li>Create a <span className="font-semibold">restricted key</span> with <span className="font-semibold">Read</span> access to Balance Transactions, Charges, Payouts, Customers and Subscriptions.</li>
          <li>Save it in this app's Secrets page as <span className="font-mono text-xs bg-ink/5 px-1.5 py-0.5 rounded">STRIPE_SECRET_KEY</span>.</li>
          <li>Come back here and hit refresh.</li>
        </ol>
      </div>
    );
  }

  if (error || data.error) {
    return (
      <div className="game-panel p-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-red-600/70" />
          <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase text-red-600/80">Stripe error</h3>
        </div>
        <p className="text-ink/65 text-sm mb-4">{error || data.error}</p>
        <button
          onClick={() => setNonce((n) => n + 1)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-ink/[0.04] border border-ink/[0.13] text-ink/60 hover:text-ink transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Try again
        </button>
      </div>
    );
  }

  const chartData = data.months.map((m) => ({
    month: monthShort(m.key),
    collected: m.collected,
    fees: m.fees,
    net: m.net,
  }));

  const feeRate = data.current.collected > 0 ? (data.current.fees / data.current.collected) * 100 : 0;
  const rows = [...data.months].reverse();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
            Stripe — Live Money In
          </h2>
          <p className="text-ink/[0.43] text-xs mt-0.5">
            Every payment, fee and Capital repayment · {data.totals.payments} payments in the last 12 months
          </p>
        </div>
        <button
          onClick={() => setNonce((n) => n + 1)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-ink/[0.04] border border-ink/[0.13] text-ink/60 hover:text-orange-500 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          icon={DollarSign}
          label={`Collected · ${monthShort(data.current.key)}`}
          value={money(data.current.collected)}
          sub={`${data.current.payments} payments`}
          highlight
        />
        <Card
          icon={Percent}
          label="Stripe Fees"
          value={money(data.current.fees)}
          sub={`${feeRate.toFixed(1)}% of collected`}
        />
        <Card
          icon={Landmark}
          label="Stripe Capital"
          value={money(data.current.capital)}
          sub="Loan repayment this month"
        />
        <Card
          icon={Wallet}
          label="Net to Bank"
          value={money(data.current.net)}
          sub="After fees, refunds & capital"
          good
        />
      </div>

      <div className="game-panel p-5">
        <p className="font-display text-[10px] tracking-[0.2em] uppercase mb-3 bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
          Collected vs Net · Last 12 Months
        </p>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barSize={14} margin={{ top: 5, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="srBarGross" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff3c00" />
                  <stop offset="100%" stopColor="#ffaa00" stopOpacity="0.85" />
                </linearGradient>
                <linearGradient id="srBarNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ADE80" />
                  <stop offset="100%" stopColor="#16A34A" stopOpacity="0.85" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,26,26,0.08)" />
              <XAxis
                dataKey="month"
                tick={{ fill: "rgba(26,26,26,0.35)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<GameChartTooltip prefix="$" />} cursor={{ fill: "rgba(255,60,0,0.05)" }} />
              <Bar dataKey="collected" fill="url(#srBarGross)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="net" fill="url(#srBarNet)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="game-panel overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
            Monthly Breakdown
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] tracking-wider uppercase text-ink/[0.43] border-y border-ink/[0.13]">
                <th className="text-left font-semibold px-5 py-2">Month</th>
                <th className="text-right font-semibold px-3 py-2">Collected</th>
                <th className="text-right font-semibold px-3 py-2">Refunds</th>
                <th className="text-right font-semibold px-3 py-2">Stripe Fees</th>
                <th className="text-right font-semibold px-3 py-2">Capital</th>
                <th className="text-right font-semibold px-5 py-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr
                  key={m.key}
                  className={`border-b border-ink/[0.07] last:border-0 ${
                    m.key === data.current.key ? "bg-orange-500/[0.06]" : ""
                  }`}
                >
                  <td className="px-5 py-2.5 text-ink/75 font-medium">
                    {monthFull(m.key)}
                    {m.key === data.current.key && (
                      <span className="ml-2 text-[9px] font-bold tracking-wider uppercase text-orange-600/80">Now</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-ink/80">{money(m.collected)}</td>
                  <td className={`px-3 py-2.5 text-right font-mono ${m.refunds ? "text-red-600/70" : "text-ink/[0.28]"}`}>
                    {m.refunds ? `-${money(m.refunds)}` : "—"}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono ${m.fees ? "text-blue-600/70" : "text-ink/[0.28]"}`}>
                    {m.fees ? `-${money(m.fees)}` : "—"}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono ${m.capital ? "text-amber-600/80" : "text-ink/[0.28]"}`}>
                    {m.capital ? `-${money(m.capital)}` : "—"}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono font-semibold text-green-600/80">{money(m.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="game-panel p-5">
        <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent mb-3">
          Recent Activity
        </h3>
        <div className="space-y-1">
          {data.recent.length === 0 && <p className="text-ink/[0.43] text-xs">No Stripe activity in the last 12 months.</p>}
          {data.recent.map((r) => (
            <div key={r.id} className="flex items-center gap-3 py-2 border-b border-ink/[0.07] last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-ink/80 text-sm truncate">{r.description || r.type.replace(/_/g, " ")}</p>
                <p className="text-ink/[0.38] text-[10px] uppercase tracking-wider">
                  {r.type.replace(/_/g, " ")} ·{" "}
                  {new Date(r.created * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
              <p className="font-mono text-sm text-ink/75 w-24 text-right shrink-0">{money(r.gross)}</p>
              <p className="font-mono text-[11px] text-blue-600/60 w-20 text-right shrink-0">
                {r.fee ? `-${money(r.fee)}` : "—"}
              </p>
              <p className="font-mono text-sm font-semibold text-green-600/80 w-24 text-right shrink-0">
                {money(r.net)}
              </p>
            </div>
          ))}
        </div>
        <p className="text-ink/[0.33] text-[10px] mt-3">
          Gross · fee · net per Stripe balance transaction. Payouts and transfers are excluded from gross.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat label="12-mo Collected" value={money(data.totals.collected)} />
        <MiniStat label="12-mo Stripe Fees" value={money(data.totals.fees)} />
        <MiniStat label="12-mo Capital" value={money(data.totals.capital)} />
        <MiniStat label="12-mo Net" value={money(data.totals.net)} />
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value, sub, highlight, good }) {
  return (
    <div className="game-panel p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon
          className={`w-3.5 h-3.5 ${highlight ? "text-orange-500" : good ? "text-green-600/60" : "text-ink/[0.38]"}`}
        />
        <span className="text-ink/[0.48] text-[10px] tracking-wider uppercase">{label}</span>
      </div>
      <p
        className={`text-xl font-display font-extrabold ${
          highlight
            ? "bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent"
            : good
            ? "text-green-600"
            : "text-ink/80"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-ink/[0.43] text-[10px] mt-1">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="bg-card rounded-md border border-ink/[0.13] p-4">
      <p className="text-ink/[0.43] text-[10px] tracking-wider uppercase mb-1">{label}</p>
      <p className="font-display font-bold text-base text-ink/80">{value}</p>
    </div>
  );
}