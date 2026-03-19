import { useQuery } from "@tanstack/react-query";
import { fetchVendors, fetchPurchases } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, TrendingUp, TrendingDown, ChevronRight, Zap } from "lucide-react";
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

const scoreCls = (s: number) =>
  s >= 90 ? "text-emerald-600" : s >= 75 ? "text-amber-600" : "text-red-600";

export default function VendorAnalytics() {
  const navigate = useNavigate();
  const { data: vendors, isLoading } = useQuery({ queryKey: ["vendors"], queryFn: fetchVendors });
  const { data: purchases } = useQuery({ queryKey: ["purchases"], queryFn: () => fetchPurchases() });

  const totalSpend = purchases?.reduce((s, p) => s + p.totalAmount, 0) || 0;

  const enriched = vendors?.map((v) => {
    const vp = purchases?.filter((p) => p.vendorId === v.id) || [];
    const spend = vp.reduce((s, p) => s + p.totalAmount, 0);
    const hasMismatch = vp.some(p => p.gstStatus === "mismatch");
    const concentrationPct = totalSpend > 0 ? (spend / totalSpend) * 100 : 0;
    return {
      ...v,
      totalSpend: spend,
      invoiceCount: vp.length,
      hasMismatch,
      concentrationPct,
      riskLevel: concentrationPct > 30 ? "high" : concentrationPct > 15 ? "medium" : "low",
    };
  }).sort((a, b) => b.totalSpend - a.totalSpend) || [];

  const top1Pct = enriched[0] ? enriched[0].concentrationPct.toFixed(1) : "0";
  const top3Pct = enriched.length >= 3
    ? ((enriched.slice(0, 3).reduce((s, v) => s + v.totalSpend, 0) / totalSpend) * 100).toFixed(1)
    : "0";
  const top5Pct = enriched.length >= 5
    ? ((enriched.slice(0, 5).reduce((s, v) => s + v.totalSpend, 0) / totalSpend) * 100).toFixed(1)
    : "0";

  const mismatchVendors = enriched.filter(v => v.hasMismatch);

  const riskFlags = [
    parseFloat(top1Pct) > 30 && { msg: `${enriched[0]?.name} accounts for ${top1Pct}% of total spend — high dependency`, sev: "high" },
    parseFloat(top3Pct) > 60 && { msg: `Top 3 vendors = ${top3Pct}% of total spend — concentration risk`, sev: "high" },
    mismatchVendors.length > 0 && { msg: `${mismatchVendors.map(v => v.name).join(", ")} — frequent GST mismatches`, sev: "medium" },
    { msg: `${enriched.length} active vendors · ${fmt(totalSpend)} total spend this period`, sev: "info" },
  ].filter(Boolean) as { msg: string; sev: string }[];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">Vendor Intelligence</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Supplier performance, risk exposure, and compliance</p>
        </div>
      </div>

      {/* Concentration KPIs */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Vendor Concentration</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Top 1 Vendor", pct: top1Pct, name: enriched[0]?.name || "—" },
            { label: "Top 3 Vendors", pct: top3Pct, name: `${enriched.slice(0, 3).length} vendors` },
            { label: "Top 5 Vendors", pct: top5Pct, name: `${enriched.slice(0, 5).length} vendors` },
            { label: "Total Vendors", pct: null, name: `${enriched.length} active` },
          ].map((c, i) => (
            <Card key={i} className="p-3.5">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              {c.pct !== null ? (
                <>
                  <p className={`text-xl font-bold mt-0.5 tabular-nums ${parseFloat(c.pct) > 40 ? "text-red-600" : "text-foreground"}`}>
                    {c.pct}%
                  </p>
                  {parseFloat(c.pct) > 40 && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                      <span className="text-[10px] text-red-600">High risk</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xl font-bold mt-0.5">{c.name}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.name}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Chart + Risk Flags */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <h3 className="text-sm font-medium mb-3">Top Vendors by Spend</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enriched.slice(0, 6)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 100000).toFixed(0)}L`} stroke="hsl(var(--muted-foreground))" />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="totalSpend" fill="#6366f1" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Risk Flags & Alerts</h3>
          <div className="space-y-2">
            {riskFlags.map((flag, i) => (
              <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                flag.sev === "high" ? "bg-red-50 border border-red-200" :
                flag.sev === "medium" ? "bg-amber-50 border border-amber-200" :
                "bg-blue-50 border border-blue-200"
              }`}>
                <Zap className={`h-3.5 w-3.5 flex-shrink-0 mt-0.5 ${
                  flag.sev === "high" ? "text-red-600" :
                  flag.sev === "medium" ? "text-amber-600" : "text-blue-600"
                }`} />
                <span className={flag.sev === "high" ? "text-red-700" : flag.sev === "medium" ? "text-amber-700" : "text-blue-700"}>
                  {flag.msg}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Vendor Table */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">All Vendors</h2>
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold">Vendor</TableHead>
                <TableHead className="text-xs font-semibold">GSTIN</TableHead>
                <TableHead className="text-xs font-semibold">Category</TableHead>
                <TableHead className="text-xs font-semibold text-right">Total Spend</TableHead>
                <TableHead className="text-xs font-semibold text-right">Concentration</TableHead>
                <TableHead className="text-xs font-semibold text-right">Invoices</TableHead>
                <TableHead className="text-xs font-semibold text-right">Compliance</TableHead>
                <TableHead className="text-xs font-semibold text-right">Price Consistency</TableHead>
                <TableHead className="text-xs font-semibold">Risk</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : enriched.map((v) => (
                <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50 group" onClick={() => navigate("/app/purchases/register")}>
                  <TableCell className="font-medium text-sm">{v.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{v.gstin}</TableCell>
                  <TableCell className="text-xs">{v.category}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-semibold">{fmt(v.totalSpend)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className={`text-xs font-medium ${v.concentrationPct > 30 ? "text-red-600" : "text-muted-foreground"}`}>
                      {v.concentrationPct.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs">{v.invoiceCount}</TableCell>
                  <TableCell className="text-right">
                    <span className={`text-xs font-semibold ${scoreCls(v.complianceScore)}`}>{v.complianceScore}%</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={`text-xs font-semibold ${scoreCls(v.priceConsistencyScore)}`}>{v.priceConsistencyScore}%</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {v.hasMismatch && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                        v.riskLevel === "high" ? "bg-red-100 text-red-700 border-red-200" :
                        v.riskLevel === "medium" ? "bg-amber-100 text-amber-700 border-amber-200" :
                        "bg-emerald-100 text-emerald-700 border-emerald-200"
                      }`}>{v.riskLevel}</span>
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
