import { useQuery } from "@tanstack/react-query";
import { fetchGSTSummaries, fetchMonthlyTrend, fetchPurchases, fetchReconciliation } from "@/services/api";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line,
} from "recharts";
import { CheckCircle2, AlertTriangle, ArrowRight, Zap } from "lucide-react";

const fmt = (n: number) => {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
};

function KPICard({ title, value, sub, status }: { title: string; value: string; sub?: string; status?: "ok" | "warn" | "error" }) {
  const bg = status === "ok" ? "border-emerald-200 bg-emerald-50" : status === "error" ? "border-red-200 bg-red-50" : status === "warn" ? "border-amber-200 bg-amber-50" : "";
  const valCls = status === "ok" ? "text-emerald-700" : status === "error" ? "text-red-700" : status === "warn" ? "text-amber-700" : "";
  return (
    <Card className={`p-3.5 ${bg}`}>
      <p className={`text-xs font-medium ${status ? valCls : "text-muted-foreground"}`}>{title}</p>
      <p className={`text-xl font-bold mt-0.5 tabular-nums ${valCls}`}>{value}</p>
      {sub && <p className={`text-[10px] mt-0.5 ${status ? valCls : "text-muted-foreground"}`}>{sub}</p>}
    </Card>
  );
}

export default function GSTDashboard() {
  const navigate = useNavigate();
  const { data: gstData } = useQuery({ queryKey: ["gstSummaries"], queryFn: fetchGSTSummaries });
  const { data: trend } = useQuery({ queryKey: ["monthlyTrend"], queryFn: fetchMonthlyTrend });
  const { data: purchases } = useQuery({ queryKey: ["purchases"], queryFn: () => fetchPurchases() });
  const { data: reconItems } = useQuery({ queryKey: ["reconciliation"], queryFn: fetchReconciliation });

  const latest = gstData?.[0];
  const mismatches = purchases?.filter(p => p.gstStatus === "mismatch").length || 0;
  const totalPurchases = purchases?.length || 0;
  const matchRate = totalPurchases > 0 ? (((totalPurchases - mismatches) / totalPurchases) * 100).toFixed(1) : "100.0";
  const unresolvedRecon = reconItems?.filter(r => !r.resolved).length || 0;

  const filingReadiness = [
    { label: "GSTR-3B", period: "Dec 2024", due: "20 Jan 2025", status: "ready" },
    { label: "GSTR-1", period: "Dec 2024", due: "11 Jan 2025", status: "pending" },
    { label: "GSTR-2B Match", period: "Dec 2024", due: "—", status: mismatches > 0 ? "action" : "ok" },
    { label: "ITC Reconciliation", period: "Dec 2024", due: "—", status: unresolvedRecon > 0 ? "action" : "ok" },
  ];

  const complianceItems = [
    { label: "GST Match Rate", value: `${matchRate}%`, ok: parseFloat(matchRate) >= 95 },
    { label: "ITC Available", value: fmt(latest?.itcAvailable || 0), ok: true },
    { label: "Unresolved Mismatches", value: `${mismatches}`, ok: mismatches === 0 },
    { label: "Reconciliation %", value: `${latest?.reconciliationPct || 0}%`, ok: (latest?.reconciliationPct || 0) >= 95 },
    { label: "Net GST Payable", value: fmt(latest?.netPayable || 0), ok: true },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">GST Compliance Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Tax intelligence · Dec 2024</p>
        </div>
        <button onClick={() => navigate("/app/gst/reports")} className="text-xs text-primary flex items-center gap-1 hover:underline">
          GST Reports <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* KPI Strip */}
      {latest && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <KPICard title="Input GST / ITC" value={fmt(latest.totalInput)} sub="From purchases" />
          <KPICard title="Output GST" value={fmt(latest.totalOutput)} sub="From sales" />
          <KPICard title="Net Payable" value={fmt(latest.netPayable)} sub="Output – Input" status={latest.netPayable > 0 ? "warn" : "ok"} />
          <KPICard title="ITC Available" value={fmt(latest.itcAvailable)} sub="Claimable credit" status="ok" />
          <KPICard title="GST Match Rate" value={`${matchRate}%`} sub={`${mismatches} mismatches`} status={parseFloat(matchRate) >= 95 ? "ok" : "error"} />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Input vs Output GST by Period</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gstData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 100000).toFixed(0)}L`} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="totalInput" name="Input GST" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="totalOutput" name="Output GST" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Net GST Trend</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 100000).toFixed(0)}L`} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="inputGST" name="Input" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="outputGST" name="Output" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Filing Readiness + Compliance Health */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Filing Readiness</h3>
          <div className="space-y-2">
            {filingReadiness.map((item, i) => (
              <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg border ${
                item.status === "ok" || item.status === "ready" ? "bg-emerald-50 border-emerald-200" :
                item.status === "action" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
              }`}>
                <div className="flex items-center gap-2">
                  {item.status === "ok" || item.status === "ready"
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    : <AlertTriangle className="h-4 w-4 text-red-600" />}
                  <div>
                    <p className="text-xs font-semibold">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground">{item.period}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-medium ${
                    item.status === "ok" || item.status === "ready" ? "text-emerald-700" :
                    item.status === "action" ? "text-red-700" : "text-amber-700"
                  }`}>
                    {item.status === "action" ? "Action needed" : item.status === "ready" ? "Ready to file" : item.status === "pending" ? "In progress" : "OK"}
                  </span>
                  {item.due !== "—" && <p className="text-[10px] text-muted-foreground">Due {item.due}</p>}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-3">
            <button onClick={() => navigate("/app/gst/reports")} className="text-xs text-primary hover:underline flex items-center gap-1">
              File Return <ArrowRight className="h-3 w-3" />
            </button>
            <span className="text-muted-foreground">·</span>
            <button onClick={() => navigate("/app/gst/reconciliation")} className="text-xs text-primary hover:underline flex items-center gap-1">
              Reconciliation <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Compliance Health</h3>
          <div className="space-y-2.5">
            {complianceItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className={`text-xs font-semibold ${item.ok ? "text-emerald-600" : "text-red-600"}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t space-y-2">
            {mismatches > 0 && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-red-700">{mismatches} GST mismatches detected — ITC at risk</p>
              </div>
            )}
            {unresolvedRecon > 0 && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                <Zap className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700">{unresolvedRecon} unresolved reconciliation items</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
