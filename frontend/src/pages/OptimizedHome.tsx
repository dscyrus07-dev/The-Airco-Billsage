import { useQuery } from "@tanstack/react-query";
import { getDashboardData } from "@/services/dashboardService";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, TrendingDown, ShoppingCart, DollarSign, Receipt,
  AlertTriangle, Clock, ArrowRight, CheckCircle, XCircle, Info,
  CreditCard, Wallet, RefreshCw,
} from "lucide-react";

const fmt = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
};

const fmtFull = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function KPICard({ title, value, change, sub, icon: Icon, accent }: {
  title: string; value: string; change?: number; sub?: string;
  icon: React.ElementType; accent: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium truncate">{title}</p>
          <p className="text-xl font-bold mt-1 tabular-nums">{value}</p>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-1">
              {change >= 0
                ? <TrendingUp className="h-3 w-3 text-emerald-500" />
                : <TrendingDown className="h-3 w-3 text-red-500" />}
              <span className={`text-xs ${change >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {change >= 0 ? "+" : ""}{change.toFixed(1)}% vs last month
              </span>
            </div>
          )}
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ml-2 ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

export default function OptimizedHomePage() {
  const navigate = useNavigate();
  
  // Single optimized query instead of 6 parallel queries
  const { data: dashboardData, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: getDashboardData,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false, // Reduce unnecessary refetches
    retry: 3,
  });

  if (error) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold">Dashboard Error</h2>
          <p className="text-muted-foreground mb-4">
            Unable to load dashboard data. Please try again.
          </p>
          <button 
            onClick={() => refetch()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !dashboardData) {
    return (
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-lg font-semibold">Financial Control Panel</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Loading...</p>
        </div>

        {/* 6 Primary KPI Cards Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>

        {/* Middle row skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Skeleton className="lg:col-span-3 h-64 rounded-lg" />
          <Skeleton className="lg:col-span-2 h-64 rounded-lg" />
        </div>

        {/* Bottom row skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="lg:col-span-2 h-96 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  const { kpis, aging, gstSummary, recentTransactions, alerts } = dashboardData;

  const overdueReceivables = aging.receivables
    .filter(r => r.bucket !== 'Current' && r.amount > 0)
    .reduce((a, r) => a + r.amount, 0);

  const dueSoon = aging.payables
    .filter(r => r.bucket === '1-30 days')
    .reduce((a, r) => a + r.amount, 0);

  const alertSeverityIcon = (sev: string) => {
    if (sev === "high") return <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />;
    if (sev === "medium") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />;
    return <Info className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />;
  };

  const statusColor = (s: string) => {
    const m: Record<string, string> = {
      paid: "bg-emerald-100 text-emerald-700",
      approved: "bg-blue-100 text-blue-700",
      issued: "bg-blue-100 text-blue-700",
      overdue: "bg-red-100 text-red-700",
      pending: "bg-amber-100 text-amber-700",
      draft: "bg-slate-100 text-slate-700",
      partial: "bg-purple-100 text-purple-700",
      mismatch: "bg-red-100 text-red-700",
      matched: "bg-emerald-100 text-emerald-700",
      pending_approval: "bg-amber-100 text-amber-700",
    };
    return m[s] || "bg-slate-100 text-slate-700";
  };

  const statusLabel = (s: string) => {
    const m: Record<string, string> = {
      paid: "Paid",
      approved: "Issued",
      issued: "Issued",
      overdue: "Overdue",
      pending: "Pending",
      draft: "Draft",
      partial: "Partial",
      mismatch: "Mismatch",
      matched: "Matched",
      pending_approval: "Pending Approval",
    };
    return m[s] || s;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Financial Control Panel</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Last updated: {new Date(dashboardData.lastUpdated).toLocaleTimeString()}
          </p>
        </div>
        <button 
          onClick={() => refetch()} 
          className="p-2 hover:bg-muted rounded-md transition-colors"
          title="Refresh dashboard"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* 6 Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard 
          title="Total Sales" 
          value={fmt(kpis.totalRevenue.value)} 
          change={kpis.totalRevenue.change}
          icon={DollarSign} 
          accent="bg-emerald-100 text-emerald-700" 
          sub="Current period" 
        />
        <KPICard 
          title="Total Purchases" 
          value={fmt(kpis.totalPurchases.value)} 
          change={kpis.totalPurchases.change}
          icon={ShoppingCart} 
          accent="bg-blue-100 text-blue-700" 
          sub="Current period" 
        />
        <KPICard
          title={kpis.netGSTPayable >= 0 ? "GST Payable" : "GST Refundable"}
          value={fmt(Math.abs(kpis.netGSTPayable))}
          icon={Receipt}
          accent={kpis.netGSTPayable >= 0 ? "bg-orange-100 text-orange-700" : "bg-teal-100 text-teal-700"}
          sub="Output – Input GST"
        />
        <KPICard 
          title="Receivables" 
          value={fmt(kpis.receivables.value)} 
          change={kpis.receivables.change}
          icon={TrendingUp} 
          accent="bg-violet-100 text-violet-700"
          sub={overdueReceivables > 0 ? `${fmt(overdueReceivables)} overdue` : "No overdue"} 
        />
        <KPICard 
          title="Payables" 
          value={fmt(kpis.payables.value)} 
          change={kpis.payables.change}
          icon={CreditCard} 
          accent="bg-red-100 text-red-700"
          sub={dueSoon > 0 ? `${fmt(dueSoon)} due in 30d` : "None due soon"} 
        />
        <KPICard
          title="Cash Position"
          value={fmt(kpis.cashPosition)}
          icon={Wallet}
          accent={kpis.cashPosition >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}
          sub={kpis.cashPosition >= 0 ? "Net positive" : "Cash pressure"}
        />
      </div>

      {/* Middle row: Aging Table + GST Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Aging Table */}
        <Card className="lg:col-span-3 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Receivables vs Payables Aging</h3>
            <button 
              onClick={() => navigate("/app/sales/receivables")} 
              className="text-xs text-primary flex items-center gap-0.5 hover:underline"
            >
              View details <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="pb-2 text-left font-medium text-muted-foreground">Bucket</th>
                <th className="pb-2 text-right font-medium text-muted-foreground">Receivables</th>
                <th className="pb-2 text-right font-medium text-muted-foreground">Payables</th>
                <th className="pb-2 text-right font-medium text-muted-foreground">Net</th>
              </tr>
            </thead>
            <tbody>
              {aging.receivables.map((r, i) => {
                const p = aging.payables[i];
                const net = r.amount - (p?.amount || 0);
                const isOverdue = i > 0;
                return (
                  <tr key={r.bucket} className="border-b last:border-0">
                    <td className="py-2 font-medium">
                      <span className={`inline-flex items-center gap-1 ${isOverdue && r.amount > 0 ? "text-red-600" : ""}`}>
                        {isOverdue && r.amount > 0 && <AlertTriangle className="h-3 w-3" />}
                        {r.bucket}
                      </span>
                    </td>
                    <td className={`py-2 text-right tabular-nums ${r.amount > 0 && isOverdue ? "text-red-600 font-medium" : ""}`}>
                      {r.amount > 0 ? fmt(r.amount) : "—"}
                    </td>
                    <td className={`py-2 text-right tabular-nums ${p?.amount > 0 && isOverdue ? "text-amber-600 font-medium" : ""}`}>
                      {p?.amount > 0 ? fmt(p.amount) : "—"}
                    </td>
                    <td className={`py-2 text-right tabular-nums font-medium ${net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {net !== 0 ? fmt(Math.abs(net)) : "—"}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-muted/30 font-semibold">
                <td className="py-2 text-xs">Total</td>
                <td className="py-2 text-right tabular-nums text-xs">
                  {fmt(aging.receivables.reduce((a, r) => a + r.amount, 0))}
                </td>
                <td className="py-2 text-right tabular-nums text-xs">
                  {fmt(aging.payables.reduce((a, p) => a + p.amount, 0))}
                </td>
                <td className="py-2 text-right tabular-nums text-xs text-emerald-600">
                  {fmt(Math.abs(
                    aging.receivables.reduce((a, r) => a + r.amount, 0) -
                    aging.payables.reduce((a, p) => a + p.amount, 0)
                  ))}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>

        {/* GST Summary */}
        <Card className="lg:col-span-2 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">GST Summary – {gstSummary.period}</h3>
            <button 
              onClick={() => navigate("/app/gst/dashboard")} 
              className="text-xs text-primary flex items-center gap-0.5 hover:underline"
            >
              Details <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between py-1.5 border-b">
              <span className="text-xs text-muted-foreground">Output GST (Tax collected)</span>
              <span className="text-xs font-semibold tabular-nums text-orange-700">{fmtFull(gstSummary.totalOutput)}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b">
              <span className="text-xs text-muted-foreground">Input GST / ITC</span>
              <span className="text-xs font-semibold tabular-nums text-blue-700">{fmtFull(gstSummary.totalInput)}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b">
              <span className="text-xs font-medium">Net GST {kpis.netGSTPayable >= 0 ? "Payable" : "Refundable"}</span>
              <span className={`text-sm font-bold tabular-nums ${kpis.netGSTPayable >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                {fmtFull(Math.abs(kpis.netGSTPayable))}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 mt-1">
              <span className="text-xs text-muted-foreground">Reconciliation</span>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${gstSummary.reconciliationPct >= 90 ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{ width: `${gstSummary.reconciliationPct}%` }}
                  />
                </div>
                <span className={`text-xs font-medium ${gstSummary.reconciliationPct >= 90 ? "text-emerald-600" : "text-amber-600"}`}>
                  {gstSummary.reconciliationPct}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground">CGST / SGST / IGST</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {fmt(gstSummary.outputCGST)} / {fmt(gstSummary.outputSGST)} / {fmt(gstSummary.outputIGST)}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Transactions + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Transactions */}
        <Card className="lg:col-span-2 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Recent Transactions</h3>
            <span className="text-xs text-muted-foreground">Last 10 entries</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left font-medium text-muted-foreground">Invoice</th>
                  <th className="pb-2 text-left font-medium text-muted-foreground">Party</th>
                  <th className="pb-2 text-right font-medium text-muted-foreground">Amount</th>
                  <th className="pb-2 text-right font-medium text-muted-foreground">GST</th>
                  <th className="pb-2 text-center font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                    onClick={() => navigate(tx.type === "purchase"
                      ? `/app/purchases/register`
                      : `/app/sales/register`)}
                  >
                    <td className="py-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${tx.type === "purchase" ? "bg-blue-500" : "bg-emerald-500"}`} />
                        <span className="font-mono">{tx.ref}</span>
                      </div>
                    </td>
                    <td className="py-2 max-w-[120px] truncate">{tx.party}</td>
                    <td className="py-2 text-right tabular-nums font-medium">{fmt(tx.amount)}</td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">{fmt(tx.gst)}</td>
                    <td className="py-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColor(tx.status)}`}>
                        {statusLabel(tx.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Alerts */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Critical Alerts</h3>
            {alerts && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {alerts.filter(a => a.severity === "high").length} high
              </Badge>
            )}
          </div>
          <div className="space-y-2">
            {alerts?.sort((a, b) => {
              const order = { high: 0, medium: 1, low: 2 };
              return order[a.severity] - order[b.severity];
            }).map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/40 cursor-pointer transition-colors border"
                onClick={() => navigate(`/app${alert.link}`)}
              >
                {alertSeverityIcon(alert.severity)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-tight truncate">{alert.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{alert.description}</p>
                </div>
              </div>
            ))}
            {!alerts?.length && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle className="h-8 w-8 text-emerald-500 mb-2" />
                <p className="text-xs text-muted-foreground">No active alerts</p>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate("/app/gst/reconciliation")}
            className="mt-3 w-full text-xs text-center text-primary hover:underline flex items-center justify-center gap-1"
          >
            View all exceptions <ArrowRight className="h-3 w-3" />
          </button>
        </Card>
      </div>
    </div>
  );
}
