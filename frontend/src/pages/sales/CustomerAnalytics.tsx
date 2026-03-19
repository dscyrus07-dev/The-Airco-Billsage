import { useQuery } from "@tanstack/react-query";
import { salesService } from "@/services/salesService";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { useNavigate } from "react-router-dom";
import { ArrowRight, TrendingUp, AlertCircle, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const fmt = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
};

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function CustomerAnalytics() {
  const navigate = useNavigate();

  const { data: analytics, isLoading } = useQuery({
    queryKey: ["salesAnalytics"],
    queryFn: () => salesService.getAnalytics(),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const topCustomers = analytics?.top_customers || [];
  const totalRevenue = analytics?.total_sales || 0;
  const invoiceCount = analytics?.invoice_count || 0;
  const averageValue = analytics?.average_value || 0;
  const paymentStatus = analytics?.payment_status || { paid: 0, partially_paid: 0, unpaid: 0 };

  // Calculate concentration metrics
  const top3Revenue = topCustomers.slice(0, 3).reduce((sum, c) => sum + c.total_amount, 0);
  const top3Percentage = totalRevenue > 0 ? ((top3Revenue / totalRevenue) * 100).toFixed(1) : "0";
  const concentrationRisk = parseFloat(top3Percentage) > 60;

  // Payment status for pie chart
  const paymentData = [
    { name: "Paid", value: paymentStatus.paid, color: "#10b981" },
    { name: "Partially Paid", value: paymentStatus.partially_paid, color: "#f59e0b" },
    { name: "Unpaid", value: paymentStatus.unpaid, color: "#ef4444" },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">Customer Analytics</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Revenue concentration and customer insights</p>
        </div>
        <button
          onClick={() => navigate("/app/sales/register")}
          className="text-xs text-primary flex items-center gap-1 hover:underline"
        >
          View Register <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3.5">
          <p className="text-xs text-muted-foreground">Total Revenue</p>
          <p className="text-xl font-bold mt-1 tabular-nums">{fmt(totalRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-1">{invoiceCount} invoices</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-xs text-muted-foreground">Top Customer Share</p>
          <p className="text-xl font-bold mt-1 tabular-nums">{top3Percentage}%</p>
          <p className="text-xs text-muted-foreground mt-1">Top 3 customers</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-xs text-muted-foreground">Average Invoice</p>
          <p className="text-xl font-bold mt-1 tabular-nums">{fmt(averageValue)}</p>
          <p className="text-xs text-muted-foreground mt-1">per invoice</p>
        </Card>
        <Card className="p-3.5">
          <p className="text-xs text-muted-foreground">Active Customers</p>
          <p className="text-xl font-bold mt-1 tabular-nums">{topCustomers.length}</p>
          <p className="text-xs text-muted-foreground mt-1">with sales</p>
        </Card>
      </div>

      {/* Insights */}
      {concentrationRisk && (
        <Card className="p-4 border-amber-300 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Revenue Concentration Risk</p>
              <p className="text-xs text-amber-700 mt-1">
                Top 3 customers account for {top3Percentage}% of total revenue. Consider diversifying your customer base to reduce
                dependency risk.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by Customer */}
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Revenue by Customer</h3>
          <div className="h-64">
            {topCustomers.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCustomers.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    type="category"
                    dataKey="customer_name"
                    width={120}
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="total_amount" fill="#10b981" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">No customer data available</p>
              </div>
            )}
          </div>
        </Card>

        {/* Payment Status Distribution */}
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Payment Status Distribution</h3>
          <div className="h-64">
            {paymentData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => v} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">No payment data available</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Top Customers Table */}
      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Top Customers by Revenue</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="pb-2 text-left font-medium text-muted-foreground">Rank</th>
                <th className="pb-2 text-left font-medium text-muted-foreground">Customer</th>
                <th className="pb-2 text-right font-medium text-muted-foreground">Revenue</th>
                <th className="pb-2 text-right font-medium text-muted-foreground">Invoices</th>
                <th className="pb-2 text-right font-medium text-muted-foreground">Share %</th>
              </tr>
            </thead>
            <tbody>
              {topCustomers.length > 0 ? (
                topCustomers.map((customer, idx) => {
                  const sharePercentage = totalRevenue > 0 ? ((customer.total_amount / totalRevenue) * 100).toFixed(1) : "0";
                  return (
                    <tr key={customer.customer_id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2">{idx + 1}</td>
                      <td className="py-2 font-medium">{customer.customer_name}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(customer.total_amount)}</td>
                      <td className="py-2 text-right tabular-nums">{customer.invoice_count}</td>
                      <td className="py-2 text-right tabular-nums">
                        <span className={parseFloat(sharePercentage) > 20 ? "text-amber-600 font-semibold" : ""}>
                          {sharePercentage}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No customer data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="flex items-center gap-3 text-xs">
        <button onClick={() => navigate("/app/sales/kpis")} className="text-primary hover:underline flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          View KPIs
        </button>
        <span className="text-muted-foreground">·</span>
        <button onClick={() => navigate("/app/sales/receivables")} className="text-primary hover:underline flex items-center gap-1">
          <Users className="h-3 w-3" />
          Receivables Aging
        </button>
      </div>
    </div>
  );
}
