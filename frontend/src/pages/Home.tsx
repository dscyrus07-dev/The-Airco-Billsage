import { useQuery } from "@tanstack/react-query";
import { salesService } from "@/services/salesService";
import { fetchDashboardData } from "@/services/dashboardService";
import { purchaseService } from "@/services/purchaseService";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import React from "react";
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
  const { data: kpis, isLoading: kpiLoading, error: kpiError } = useQuery({ 
    queryKey: ["homeKPIs"], 
    queryFn: fetchDashboardData,
    retry: false,
  });
  const { data: salesData, error: salesError } = useQuery({ 
    queryKey: ["sales"], 
    queryFn: () => salesService.listInvoices(),
    retry: false,
  });
  const { data: purchases, error: purchasesError } = useQuery({ 
    queryKey: ["purchases"], 
    queryFn: () => purchaseService.listPurchaseInvoices(),
    retry: false,
  });
  
  // Log errors for debugging
  React.useEffect(() => {
    if (kpiError) console.error('Failed to fetch dashboard data:', kpiError);
    if (salesError) console.error('Failed to fetch sales data:', salesError);
    if (purchasesError) console.error('Failed to fetch purchases data:', purchasesError);
  }, [kpiError, salesError, purchasesError]);
  
  const alertsData = [];
  const gstSummaries = [];

  const recentTransactions = [
    ...((purchases || []) as any[]).map(p => ({
      id: p.id, type: "purchase" as const, ref: p.invoiceNo,
      party: p.vendor, date: p.invoiceDate, amount: p.totalAmount || 0,
      gst: p.totalTax || 0, status: p.status, gstStatus: p.gstStatus,
    })),
    ...((salesData || []) as any[]).map(s => ({
      id: s.id, type: "sale" as const, ref: s.invoice_number,
      party: `Customer ${s.customer_id}`, date: s.invoice_date, amount: s.total_amount || 0,
      gst: 0, status: s.status, gstStatus: s.gst_status,
    })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10);

  const statusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-emerald-100 text-emerald-700";
      case "pending": return "bg-amber-100 text-amber-700";
      case "overdue": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "paid": return "Paid";
      case "pending": return "Pending";
      case "overdue": return "Overdue";
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your business overview.</p>
      </div>

      {/* 6 Primary KPI Cards */}
      {kpiLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      ) : kpiError ? (
        <Card className="p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-muted-foreground">Unable to load dashboard data</h3>
            <p className="text-sm text-muted-foreground mt-2">Please check your connection and try again</p>
          </div>
        </Card>
      ) : kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard title="Total Revenue" value={fmt((kpis as any)?.total_revenue)} change={0}
            icon={DollarSign} accent="bg-emerald-100 text-emerald-700" sub="Current period" />
          <KPICard title="Total Expenses" value={fmt((kpis as any)?.total_expenses)} change={0}
            icon={ShoppingCart} accent="bg-blue-100 text-blue-700" sub="Current period" />
          <KPICard
            title="Net Profit"
            value={fmt((kpis as any)?.net_profit)}
            icon={TrendingUp}
            accent={((kpis as any)?.net_profit || 0) >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}
            sub="Revenue - Expenses"
          />
          <KPICard title="Receivables" value={fmt((kpis as any)?.outstanding_receivables)} change={0}
            icon={TrendingUp} accent="bg-violet-100 text-violet-700"
            sub="Outstanding" />
          <KPICard title="Payables" value={fmt((kpis as any)?.outstanding_payables)} change={0}
            icon={CreditCard} accent="bg-red-100 text-red-700"
            sub="Outstanding" />
          <KPICard
            title="Cash Position"
            value={fmt((kpis as any)?.cash_position)}
            icon={Wallet}
            accent={((kpis as any)?.cash_position || 0) >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}
            sub="Available cash"
          />
        </div>
      ) : null}

      {/* Recent Transactions */}
      <Card className="p-4">
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
                <tr key={tx.id} className="border-b last:border-0">
                  <td className="py-2">
                    <div className="flex items-center gap-1">
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
    </div>
  );
}
