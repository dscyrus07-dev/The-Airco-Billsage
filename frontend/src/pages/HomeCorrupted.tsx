import { useQuery } from "@tanstack/react-query";
import { salesService } from "@/services/salesService";
import { fetchDashboardData } from "@/services/dashboardService";
import { purchaseService } from "@/services/purchaseService";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, TrendingDown, ShoppingCart, DollarSign, Receipt,
  AlertTriangle, Clock, ArrowRight, CheckCircle, XCircle, Info,
  CreditCard, Wallet,
} from "lucide-react";

const fmt = (n: number | undefined) => {
  if (n === undefined || n === null) return "₹0";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
};

const fmtFull = (n: number | undefined) => {
  if (n === undefined || n === null) return "₹0";
  return `₹${n.toLocaleString("en-IN")}`;
};

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

export default function HomePage() {
  const navigate = useNavigate();
  // Fix: Use dashboard function directly per Parties standard
  const { data: kpis, isLoading: kpiLoading } = useQuery({ queryKey: ["homeKPIs"], queryFn: fetchDashboardData });
  const { data: salesData } = useQuery({ queryKey: ["sales"], queryFn: () => salesService.listInvoices() });
  const { data: purchases } = useQuery({ queryKey: ["purchases"], queryFn: () => purchaseService.listPurchaseInvoices() });
  
  // TODO: Replace these with proper service implementations when available
  // const { data: alertsData } = useQuery({ queryKey: ["alerts"], queryFn: () => alertService.getAlerts() });
  // const { data: aging } = useQuery({ queryKey: ["aging"], queryFn: () => receivablesService.getReceivablesAging() });
  // const { data: gstSummaries } = useQuery({ queryKey: ["gstSummaries"], queryFn: () => gstService.getSummaries() });
  
  const alertsData = []; // Placeholder
  const aging = { receivables: [], payables: [] }; // Placeholder with proper structure
  const gstSummaries = []; // Placeholder

  const latestGST = gstSummaries?.[gstSummaries.length - 1];
  const netGSTPayable = latestGST ? latestGST.totalOutput - latestGST.totalInput : 0;

  const recentTransactions = [
    ...(purchases || []).map(p => ({
      id: p.id, type: "purchase" as const, ref: p.invoiceNo,
      party: p.vendor, date: p.invoiceDate, amount: p.totalAmount || 0,
      gst: p.totalTax || 0, status: p.status, gstStatus: p.gstStatus,
    })),
    ...(salesData || []).map(s => ({
      id: s.id, type: "sale" as const, ref: s.invoice_number,
      party: `Customer ${s.customer_id}`, date: s.invoice_date, amount: s.total_amount || 0,
      gst: 0, status: s.status, gstStatus: s.gst_status,
    })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10);

  const cashPosition = kpis ? kpis.cash_position : 0;

  const overdueReceivables = salesData?.filter(s => s.status === "overdue")
    .reduce((a, s) => a + (s.total_amount - s.paid_amount), 0) || 0;

  const dueSoon = purchases?.filter(p => {
    if (p.status === "paid") return false;
    const due = new Date(p.dueDate);
    const now = new Date();
    const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  }).reduce((a, p) => a + p.totalAmount, 0) || 0;

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
      <div>
        <h1 className="text-lg font-semibold">Financial Control Panel</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Daily snapshot · Dec 2024</p>
      </div>

      {/* 6 Primary KPI Cards */}
      {kpiLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard title="Total Revenue" value={fmt(kpis.total_revenue)} change={0}
            icon={DollarSign} accent="bg-emerald-100 text-emerald-700" sub="Current period" />
          <KPICard title="Total Expenses" value={fmt(kpis.total_expenses)} change={0}
            icon={ShoppingCart} accent="bg-blue-100 text-blue-700" sub="Current period" />
          <KPICard
            title="Net Profit"
            value={fmt(kpis.net_profit)}
            icon={TrendingUp}
            accent={kpis.net_profit >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}
            sub="Revenue - Expenses"
          />
          <KPICard title="Receivables" value={fmt(kpis.outstanding_receivables)} change={0}
            icon={TrendingUp} accent="bg-violet-100 text-violet-700"
            sub="Outstanding" />
          <KPICard title="Payables" value={fmt(kpis.outstanding_payables)} change={0}
            icon={CreditCard} accent="bg-red-100 text-red-700"
            sub="Outstanding" />
          <KPICard
            title="Cash Position"
            value={fmt(kpis.cash_position)}
            icon={Wallet}
            accent={kpis.cash_position >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}
            sub="Available cash"
          />
        </div>
      ) : null}

      {/* Middle row: Aging Table + GST Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Aging Summary */}
        <Card className="lg:col-span-3 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Receivables & Payables</h3>
            <button onClick={() => navigate("/app/sales/receivables")} className="text-xs text-primary flex items-center gap-0.5 hover:underline">
              View details <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Outstanding Receivables</span>
              <span className="text-sm font-medium">{fmt(kpis?.outstanding_receivables || 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Outstanding Payables</span>
              <span className="text-sm font-medium">{fmt(kpis?.outstanding_payables || 0)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-xs font-medium">Net Position</span>
              <span className={`text-sm font-bold ${kpis?.cash_position >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {fmt(kpis?.cash_position || 0)}
              </span>
            </div>
          </div>
        </Card>

        {/* GST Summary */}
        <Card className="lg:col-span-2 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">GST Compliance</h3>
            <button onClick={() => navigate("/app/gst/dashboard")} className="text-xs text-primary flex items-center gap-0.5 hover:underline">
              Details <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs text-muted-foreground">Compliance Rate</span>
              <span className="text-xs font-semibold tabular-nums text-emerald-700">{kpis?.gst_compliance_rate || 0}%</span>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              GST returns and compliance tracking
            </div>
          </div>
        </Card>
                <span className="text-xs font-medium">Net GST {netGSTPayable >= 0 ? "Payable" : "Refundable"}</span>
                <span className={`text-sm font-bold tabular-nums ${netGSTPayable >= 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {fmtFull(Math.abs(netGSTPayable))}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 mt-1">
                <span className="text-xs text-muted-foreground">Reconciliation</span>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-20 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${latestGST.reconciliationPct >= 90 ? "bg-emerald-500" : "bg-amber-500"}`}
                      style={{ width: `${latestGST.reconciliationPct}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${latestGST.reconciliationPct >= 90 ? "text-emerald-600" : "text-amber-600"}`}>
                    {latestGST.reconciliationPct}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">CGST / SGST / IGST</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {fmt(latestGST.outputCGST)} / {fmt(latestGST.outputSGST)} / {fmt(latestGST.outputIGST)}
                </span>
              </div>
            </div>
          ) : (
            <Skeleton className="h-32" />
          )}
        </Card>
      </div>

      {/* Recent Transactions + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Transactions */}
        <Card className="lg:col-span-1 p-4">
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
            {alertsData && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {alertsData.filter(a => a.severity === "high").length} high
              </Badge>
            )}
          </div>
          {kpis ? (
            <div className="space-y-2">
              {alertsData?.sort((a, b) => {
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
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{alert.message}</p>
                  </div>
                </div>
              ))}
              {!alertsData?.length && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-8 w-8 text-emerald-500 mb-2" />
                  <p className="text-xs text-muted-foreground">No active alerts</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Skeleton className="h-8 w-8 mb-2" />
                <p className="text-xs text-muted-foreground">Loading alerts...</p>
              </div>
            </div>
          )}
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
