import { useQuery } from "@tanstack/react-query";
import { fetchHomeKPIs, fetchMonthlyTrend, fetchAgingBuckets, fetchPurchases } from "@/services/api";
import { salesService } from "@/services/salesService";
import { Card } from "@/components/ui/card";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, Zap } from "lucide-react";

const fmt = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
};

function KPICard({ title, value, change, sub }: { title: string; value: string; change?: number; sub?: string }) {
  return (
    <Card className="p-3.5">
      <p className="text-xs text-muted-foreground font-medium">{title}</p>
      <p className="text-lg font-bold mt-0.5 tabular-nums">{value}</p>
      {change !== undefined && (
        <div className="flex items-center gap-1 mt-0.5">
          {change >= 0
            ? <TrendingUp className="h-3 w-3 text-emerald-500" />
            : <TrendingDown className="h-3 w-3 text-red-500" />}
          <span className={`text-[10px] ${change >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {change >= 0 ? "+" : ""}{typeof change === "number" ? change.toFixed(1) : change}% MoM
          </span>
        </div>
      )}
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}

export default function Analysis() {
  const { data: kpis } = useQuery({ queryKey: ["homeKPIs"], queryFn: fetchHomeKPIs });
  const { data: trend } = useQuery({ queryKey: ["monthlyTrend"], queryFn: fetchMonthlyTrend });
  const { data: aging } = useQuery({ queryKey: ["aging"], queryFn: fetchAgingBuckets });
  const { data: purchases } = useQuery({ queryKey: ["purchases"], queryFn: () => fetchPurchases() });
  const { data: sales } = useQuery({ queryKey: ["sales"], queryFn: () => salesService.listInvoices() });

  const totalRevenue = sales?.reduce((a, s) => a + s.total_amount, 0) || 0;
  const totalPurchases = purchases?.reduce((a, p) => a + p.totalAmount, 0) || 0;
  const grossProfit = totalRevenue - totalPurchases;
  const grossMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100) : 0;
  const totalReceivables = aging?.receivables.reduce((a, b) => a + b.amount, 0) || 0;
  const totalPayables = aging?.payables.reduce((a, b) => a + b.amount, 0) || 0;
  const workingCapital = totalReceivables - totalPayables;

  const agingComparison = [
    { bucket: "0-30", receivables: aging?.receivables[0]?.amount || 0, payables: aging?.payables[0]?.amount || 0 },
    { bucket: "31-60", receivables: aging?.receivables[1]?.amount || 0, payables: aging?.payables[1]?.amount || 0 },
    { bucket: "61-90", receivables: aging?.receivables[2]?.amount || 0, payables: aging?.payables[2]?.amount || 0 },
    { bucket: "90+", receivables: aging?.receivables[3]?.amount || 0, payables: aging?.payables[3]?.amount || 0 },
  ];

  const insights = [
    { msg: `Gross margin: ${grossMargin.toFixed(1)}% — ${grossMargin >= 35 ? "healthy" : "below target (35%)"}`, sev: grossMargin >= 35 ? "ok" : "warn" },
    { msg: `Working capital: ${workingCapital >= 0 ? "+" : ""}${fmt(workingCapital)} (${workingCapital >= 0 ? "positive" : "negative cash position"})`, sev: workingCapital >= 0 ? "ok" : "high" },
    { msg: `Receivables exceed payables by ${fmt(Math.abs(workingCapital))}`, sev: "info" },
    { msg: `Revenue growth: +${kpis?.totalRevenue?.change?.toFixed(1) || "0"}% — ${(kpis?.totalRevenue?.change || 0) > 0 ? "on track" : "review needed"}`, sev: (kpis?.totalRevenue?.change || 0) > 0 ? "ok" : "warn" },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-base font-semibold">Financial Analysis</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Consolidated financial intelligence · Dec 2024</p>
      </div>

      {/* KPIs */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Financial Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard title="Total Revenue" value={fmt(kpis?.totalRevenue?.value || totalRevenue)} change={kpis?.totalRevenue?.change} />
          <KPICard title="Total Purchases" value={fmt(kpis?.totalPurchases?.value || totalPurchases)} change={kpis?.totalPurchases?.change} />
          <KPICard title="Gross Profit" value={fmt(grossProfit)} sub={`${grossMargin.toFixed(1)}% margin`} />
          <KPICard title="Net GST" value={fmt(kpis?.netGST?.value || 0)} change={kpis?.netGST?.change} />
          <KPICard title="Receivables" value={fmt(kpis?.receivables?.value || totalReceivables)} change={kpis?.receivables?.change} />
          <KPICard title="Working Capital" value={fmt(workingCapital)} sub={workingCapital >= 0 ? "Positive" : "Negative"} />
        </div>
      </section>

      {/* Trend Charts */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Revenue, Cost & Margin Trends</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3">Revenue vs Purchases</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 100000).toFixed(0)}L`} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="purchases" name="Purchases" stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3">Gross Margin %</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} stroke="hsl(var(--muted-foreground))" domain={[0, 60]} />
                  <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="margin" name="Gross Margin" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </section>

      {/* Aging Comparison + Insights */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Working Capital & Insights</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-4 lg:col-span-2">
            <h3 className="text-sm font-medium mb-3">Aging — Receivables vs Payables</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 100000).toFixed(0)}L`} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="receivables" name="Receivables" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="payables" name="Payables" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3">Decision Insights</h3>
            <div className="space-y-2">
              {insights.map((ins, i) => (
                <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-xs border ${
                  ins.sev === "high" ? "bg-red-50 border-red-200" :
                  ins.sev === "warn" ? "bg-amber-50 border-amber-200" :
                  ins.sev === "ok" ? "bg-emerald-50 border-emerald-200" :
                  "bg-blue-50 border-blue-200"
                }`}>
                  <Zap className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${
                    ins.sev === "high" ? "text-red-600" :
                    ins.sev === "warn" ? "text-amber-600" :
                    ins.sev === "ok" ? "text-emerald-600" : "text-blue-600"
                  }`} />
                  <span className={ins.sev === "high" ? "text-red-700" : ins.sev === "warn" ? "text-amber-700" : ins.sev === "ok" ? "text-emerald-700" : "text-blue-700"}>
                    {ins.msg}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
