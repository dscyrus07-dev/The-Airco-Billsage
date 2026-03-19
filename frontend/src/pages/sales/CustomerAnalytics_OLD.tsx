import { useQuery } from "@tanstack/react-query";
import { fetchCustomers, fetchSales } from "@/services/api";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const fmt = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
};

const healthScore = (paymentDelay: number, hasOverdue: boolean) => {
  let score = 100;
  if (paymentDelay > 20) score -= 30;
  else if (paymentDelay > 10) score -= 15;
  if (hasOverdue) score -= 20;
  return Math.max(score, 10);
};

export default function CustomerAnalytics() {
  const navigate = useNavigate();
  const { data: customers, isLoading } = useQuery({ queryKey: ["customers"], queryFn: fetchCustomers });
  const { data: salesData } = useQuery({ queryKey: ["sales"], queryFn: () => fetchSales() });

  const totalRevenue = salesData?.reduce((a, s) => a + s.totalAmount, 0) || 0;

  const enriched = customers?.map((c) => {
    const cSales = salesData?.filter((s) => s.customerId === c.id) || [];
    const revenue = cSales.reduce((s, r) => s + r.totalAmount, 0);
    const outstanding = cSales.filter((s) => s.status !== "paid").reduce((a, s) => a + (s.totalAmount - s.paidAmount), 0);
    const hasOverdue = cSales.some(s => s.status === "overdue");
    const concentrationPct = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
    const health = healthScore(c.paymentDelayScore, hasOverdue);
    return {
      ...c, revenue, outstanding, invoiceCount: cSales.length,
      hasOverdue, concentrationPct, healthScore: health,
      riskLevel: health < 60 ? "high" : health < 80 ? "medium" : "low",
    };
  }).sort((a, b) => b.revenue - a.revenue) || [];

  const top3Pct = enriched.length >= 3
    ? ((enriched.slice(0, 3).reduce((s, c) => s + c.revenue, 0) / totalRevenue) * 100).toFixed(1)
    : "0";

  const riskFlags = [
    parseFloat(top3Pct) > 60 && { msg: `Top 3 customers = ${top3Pct}% of revenue — concentration risk`, sev: "high" },
    enriched.filter(c => c.hasOverdue).length > 0 && {
      msg: `${enriched.filter(c => c.hasOverdue).map(c => c.name).join(", ")} — overdue invoices outstanding`,
      sev: "medium"
    },
    { msg: `${enriched.length} active customers · ${fmt(totalRevenue)} total revenue`, sev: "info" },
  ].filter(Boolean) as { msg: string; sev: string }[];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-base font-semibold">Customer Intelligence</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Revenue concentration, payment behavior, and customer health</p>
      </div>

      {/* Concentration KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Top Customer", pct: enriched[0] ? `${enriched[0].concentrationPct.toFixed(1)}%` : "—", name: enriched[0]?.name || "—" },
          { label: "Top 3 Revenue Share", pct: `${top3Pct}%`, name: `${Math.min(3, enriched.length)} customers` },
          { label: "Overdue Accounts", pct: `${enriched.filter(c => c.hasOverdue).length}`, name: "need follow-up" },
          { label: "Avg Payment Delay", pct: `${(customers?.reduce((a, c) => a + c.paymentDelayScore, 0) || 0) / (customers?.length || 1) | 0} days`, name: "across customers" },
        ].map((c, i) => (
          <Card key={i} className="p-3.5">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`text-xl font-bold mt-0.5 tabular-nums ${parseFloat(c.pct) > 40 ? "text-red-600" : ""}`}>{c.pct}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.name}</p>
          </Card>
        ))}
      </div>

      {/* Chart + Risk Flags */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <h3 className="text-sm font-medium mb-3">Revenue by Customer</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enriched} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 100000).toFixed(0)}L`} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="revenue" fill="#10b981" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Risk & Alerts</h3>
          <div className="space-y-2">
            {riskFlags.map((flag, i) => (
              <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                flag.sev === "high" ? "bg-red-50 border border-red-200" :
                flag.sev === "medium" ? "bg-amber-50 border border-amber-200" :
                "bg-blue-50 border border-blue-200"
              }`}>
                <Zap className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${flag.sev === "high" ? "text-red-600" : flag.sev === "medium" ? "text-amber-600" : "text-blue-600"}`} />
                <span className={flag.sev === "high" ? "text-red-700" : flag.sev === "medium" ? "text-amber-700" : "text-blue-700"}>{flag.msg}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Customer Table */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">All Customers</h2>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold">Customer</TableHead>
                <TableHead className="text-xs font-semibold">Segment</TableHead>
                <TableHead className="text-xs font-semibold text-right">Revenue</TableHead>
                <TableHead className="text-xs font-semibold text-right">Rev Share</TableHead>
                <TableHead className="text-xs font-semibold text-right">Outstanding</TableHead>
                <TableHead className="text-xs font-semibold text-right">Invoices</TableHead>
                <TableHead className="text-xs font-semibold text-right">Avg Delay</TableHead>
                <TableHead className="text-xs font-semibold">Health</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : enriched.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50 group" onClick={() => navigate("/app/sales/register")}>
                  <TableCell className="font-medium text-sm">{c.name}</TableCell>
                  <TableCell className="text-xs">{c.segment}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-semibold">{fmt(c.revenue)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    <span className={c.concentrationPct > 30 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                      {c.concentrationPct.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {c.outstanding > 0 ? (
                      <span className={c.hasOverdue ? "text-red-600 font-semibold" : "text-amber-600"}>
                        {fmt(c.outstanding)}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{c.invoiceCount}</TableCell>
                  <TableCell className="text-right text-xs">
                    <span className={c.paymentDelayScore > 15 ? "text-red-600" : c.paymentDelayScore > 7 ? "text-amber-600" : "text-emerald-600"}>
                      {c.paymentDelayScore} days
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-12 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${c.healthScore >= 80 ? "bg-emerald-500" : c.healthScore >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${c.healthScore}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-medium ${c.healthScore >= 80 ? "text-emerald-600" : c.healthScore >= 60 ? "text-amber-600" : "text-red-600"}`}>
                        {c.healthScore}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
