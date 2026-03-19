import { useQuery } from "@tanstack/react-query";
import { fetchPurchaseKPIs, fetchMonthlyTrend, fetchSpendByCategory, fetchPurchases, fetchVendors } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, AlertTriangle, ArrowRight, ShoppingCart,
  Receipt, Users, Clock, BarChart3, Zap,
} from "lucide-react";

const fmt = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
};

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function StatCard({ title, value, change, sub, icon: Icon, accent }: {
  title: string; value: string; change?: number; sub?: string;
  icon?: React.ElementType; accent?: string;
}) {
  return (
    <Card className="p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
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
        </div>
        {Icon && (
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${accent || "bg-primary/10 text-primary"}`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </Card>
  );
}

export default function PurchaseKPIs() {
  const navigate = useNavigate();
  const { data: kpis } = useQuery({ queryKey: ["purchaseKPIs"], queryFn: fetchPurchaseKPIs });
  const { data: trend } = useQuery({ queryKey: ["monthlyTrend"], queryFn: fetchMonthlyTrend });
  const { data: spend } = useQuery({ queryKey: ["spendByCategory"], queryFn: fetchSpendByCategory });
  const { data: purchases } = useQuery({ queryKey: ["purchases"], queryFn: () => fetchPurchases() });
  const { data: vendors } = useQuery({ queryKey: ["vendors"], queryFn: fetchVendors });

  const enrichedVendors = vendors?.map(v => {
    const vp = purchases?.filter(p => p.vendorId === v.id) || [];
    return { ...v, totalSpend: vp.reduce((s, p) => s + p.totalAmount, 0), invoiceCount: vp.length };
  }).sort((a, b) => b.totalSpend - a.totalSpend);

  const totalSpend = purchases?.reduce((s, p) => s + p.totalAmount, 0) || 0;
  const top1Pct = enrichedVendors?.[0] ? ((enrichedVendors[0].totalSpend / totalSpend) * 100).toFixed(1) : "0";
  const top3Spend = enrichedVendors?.slice(0, 3).reduce((s, v) => s + v.totalSpend, 0) || 0;
  const top3Pct = totalSpend > 0 ? ((top3Spend / totalSpend) * 100).toFixed(1) : "0";

  const mismatches = purchases?.filter(p => p.gstStatus === "mismatch").length || 0;
  const totalInvoices = purchases?.length || 0;
  const mismatchRate = totalInvoices > 0 ? ((mismatches / totalInvoices) * 100).toFixed(1) : "0";

  const vendorConcentrationRisk = parseFloat(top3Pct) > 60;

  const insights = [
    { msg: `Top vendor (${enrichedVendors?.[0]?.name || "—"}) = ${top1Pct}% of total spend`, severity: parseFloat(top1Pct) > 35 ? "high" : "low" },
    { msg: `Top 3 vendors = ${top3Pct}% of total spend`, severity: vendorConcentrationRisk ? "high" : "medium" },
    { msg: `ITC mismatch rate: ${mismatchRate}% (${mismatches} of ${totalInvoices} invoices)`, severity: mismatches > 0 ? "medium" : "low" },
    { msg: `Pending payables: ${fmt(kpis?.pendingPayables?.value || 0)}`, severity: "medium" },
  ];

  const auditItems = [
    { label: "Matched GST", value: `${kpis ? ((kpis.gstCompliance?.value || 0)).toFixed(1) : "—"}%`, good: true },
    { label: "GST Mismatches", value: `${mismatches} invoices`, good: mismatches === 0 },
    { label: "Pending Approval", value: `${purchases?.filter(p => p.status === "pending").length || 0} invoices`, good: false },
    { label: "Missing HSN/SAC", value: "0 invoices", good: true },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">Purchase Intelligence</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Spend analysis · Dec 2024</p>
        </div>
        <button onClick={() => navigate("/app/purchases/register")} className="text-xs text-primary flex items-center gap-1 hover:underline">
          View Register <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* (1) Spend Overview KPIs */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Spend Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard title="Total Purchases" value={fmt(kpis?.total?.value || 0)} change={kpis?.total?.change} icon={ShoppingCart} accent="bg-blue-100 text-blue-700" />
          <StatCard title="Avg Invoice Value" value={fmt(kpis?.avgInvoice?.value || 0)} change={kpis?.avgInvoice?.change} icon={BarChart3} accent="bg-violet-100 text-violet-700" />
          <StatCard title="Invoice Count" value={`${totalInvoices}`} sub="Total invoices" icon={Receipt} accent="bg-slate-100 text-slate-700" />
          <StatCard title="Input GST / ITC" value={fmt(kpis?.inputGST?.value || 0)} change={kpis?.inputGST?.change} icon={Receipt} accent="bg-emerald-100 text-emerald-700" />
          <StatCard title="Pending Payables" value={fmt(kpis?.pendingPayables?.value || 0)} change={kpis?.pendingPayables?.change} icon={Clock} accent="bg-red-100 text-red-700" />
          <StatCard title="Vendor Count" value={`${vendors?.length || 0}`} sub="Active vendors" icon={Users} accent="bg-amber-100 text-amber-700" />
        </div>
      </section>

      {/* (2) Spend Trend + Category */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Spend Trend & Category Breakdown</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3">Monthly Purchase Trend</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 100000).toFixed(0)}L`} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="purchases" name="Purchases" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3">Spend by Category</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={spend} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={80} innerRadius={30}
                    label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {spend?.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </section>

      {/* (3) Vendor Intelligence + Audit */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Vendor Intelligence & Audit Quality</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Top Vendors */}
          <Card className="p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">Top Vendors by Spend</h3>
              <button onClick={() => navigate("/app/purchases/vendors")} className="text-xs text-primary hover:underline">View all</button>
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={enrichedVendors?.slice(0, 6)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 100000).toFixed(0)}L`} stroke="hsl(var(--muted-foreground))" />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="totalSpend" fill="#6366f1" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className={`p-2 rounded-lg border ${vendorConcentrationRisk ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
                <p className="font-medium">Top 3 Vendor Concentration</p>
                <p className={`text-lg font-bold mt-0.5 ${vendorConcentrationRisk ? "text-red-600" : "text-emerald-600"}`}>{top3Pct}%</p>
                {vendorConcentrationRisk && <p className="text-[10px] text-red-600 mt-0.5">High dependency risk</p>}
              </div>
              <div className="p-2 rounded-lg border bg-muted/30">
                <p className="font-medium">GST Compliance</p>
                <p className="text-lg font-bold mt-0.5 text-blue-600">{typeof kpis?.gstCompliance?.value === "number" ? kpis.gstCompliance.value.toFixed(1) : "—"}%</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{mismatches} mismatches</p>
              </div>
            </div>
          </Card>

          {/* Audit & Data Quality */}
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3">Audit & Data Quality</h3>
            <div className="space-y-2.5">
              {auditItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className={`text-xs font-semibold ${item.good ? "text-emerald-600" : "text-red-600"}`}>{item.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t">
              <h4 className="text-xs font-medium mb-2">Compliance Scores by Vendor</h4>
              <div className="space-y-1.5">
                {enrichedVendors?.slice(0, 4).map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-24 truncate">{v.name}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${v.complianceScore >= 90 ? "bg-emerald-500" : v.complianceScore >= 75 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${v.complianceScore}%` }} />
                    </div>
                    <span className="text-[10px] font-medium w-8 text-right">{v.complianceScore}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* (4) Actionable Insights */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Actionable Insights</h2>
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {insights.map((ins, i) => (
              <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg border ${
                ins.severity === "high" ? "bg-red-50 border-red-200" :
                ins.severity === "medium" ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"
              }`}>
                <Zap className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${
                  ins.severity === "high" ? "text-red-600" :
                  ins.severity === "medium" ? "text-amber-600" : "text-emerald-600"
                }`} />
                <span className={`text-xs ${
                  ins.severity === "high" ? "text-red-700" :
                  ins.severity === "medium" ? "text-amber-700" : "text-emerald-700"
                }`}>{ins.msg}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={() => navigate("/app/purchases/register")} className="text-xs text-primary hover:underline flex items-center gap-1">
              Drill into Purchase Register <ArrowRight className="h-3 w-3" />
            </button>
            <span className="text-muted-foreground">·</span>
            <button onClick={() => navigate("/app/purchases/vendors")} className="text-xs text-primary hover:underline flex items-center gap-1">
              View Vendor Analytics <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </Card>
      </section>
    </div>
  );
}
