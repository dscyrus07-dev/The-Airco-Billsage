import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchReconciliation } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, HelpCircle, ExternalLink, Search } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const statusIcon = (s: string) => {
  if (s === "matched") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (s === "mismatch") return <AlertTriangle className="h-3.5 w-3.5 text-red-500" />;
  return <HelpCircle className="h-3.5 w-3.5 text-amber-500" />;
};

const statusCls = (s: string) => {
  if (s === "matched") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (s === "mismatch") return "bg-red-100 text-red-700 border-red-200";
  return "bg-amber-100 text-amber-700 border-amber-200";
};

export default function Reconciliation() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { data, isLoading } = useQuery({ queryKey: ["reconciliation"], queryFn: fetchReconciliation });

  const filtered = data?.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search && !r.party.toLowerCase().includes(search.toLowerCase()) && !r.invoiceRef.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const summary = {
    matched: data?.filter(r => r.status === "matched").length || 0,
    mismatch: data?.filter(r => r.status === "mismatch").length || 0,
    missing: data?.filter(r => r.status === "missing").length || 0,
    unresolved: data?.filter(r => !r.resolved).length || 0,
    itcAtRisk: data?.filter(r => r.status !== "matched" && !r.resolved).reduce((a, r) => a + r.tax, 0) || 0,
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">GST Reconciliation Workspace</h1>
          <p className="text-xs text-muted-foreground mt-0.5">GSTR-2B vs Books · Dec 2024</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => toast.info("Downloading reconciliation report…")}>
          <ExternalLink className="h-3.5 w-3.5" /> Export
        </Button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Matched", val: summary.matched, cls: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
          { label: "Mismatch", val: summary.mismatch, cls: "text-red-600", bg: summary.mismatch > 0 ? "bg-red-50 border-red-200" : "" },
          { label: "Missing", val: summary.missing, cls: "text-amber-600", bg: summary.missing > 0 ? "bg-amber-50 border-amber-200" : "" },
          { label: "Unresolved", val: summary.unresolved, cls: summary.unresolved > 0 ? "text-red-600" : "text-emerald-600", bg: summary.unresolved > 0 ? "bg-red-50 border-red-200" : "" },
          { label: "ITC at Risk", val: fmt(summary.itcAtRisk), cls: summary.itcAtRisk > 0 ? "text-red-700" : "text-emerald-600", bg: summary.itcAtRisk > 0 ? "bg-red-50 border-red-200" : "" },
        ].map((s, i) => (
          <Card key={i} className={`p-3 ${s.bg}`}>
            <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
            <p className={`text-xl font-bold mt-0.5 ${s.cls}`}>{s.val}</p>
          </Card>
        ))}
      </div>

      {/* ITC Risk Alert */}
      {summary.itcAtRisk > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-red-700">ITC at Risk: {fmt(summary.itcAtRisk)}</p>
            <p className="text-[10px] text-red-600 mt-0.5">
              {summary.unresolved} invoices have unresolved GST mismatches. Resolve before claiming ITC to avoid reversal.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search party or invoice…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-xs pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="matched">Matched</SelectItem>
            <SelectItem value="mismatch">Mismatch</SelectItem>
            <SelectItem value="missing">Missing</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => { setSearch(""); setStatusFilter("all"); }}>
          Clear
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs font-semibold">Invoice Ref</TableHead>
              <TableHead className="text-xs font-semibold">Party</TableHead>
              <TableHead className="text-xs font-semibold">GSTIN</TableHead>
              <TableHead className="text-xs font-semibold text-right">Taxable</TableHead>
              <TableHead className="text-xs font-semibold text-right">Tax</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold">Reason</TableHead>
              <TableHead className="text-xs font-semibold">Resolved</TableHead>
              <TableHead className="text-xs font-semibold">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                </TableRow>
              ))
            ) : (filtered || []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-sm text-muted-foreground">No reconciliation items match filters</TableCell>
              </TableRow>
            ) : (filtered || []).map((r) => (
              <TableRow key={r.id} className={!r.resolved && r.status !== "matched" ? "bg-red-50/50" : ""}>
                <TableCell className="font-mono text-xs font-medium">{r.invoiceRef}</TableCell>
                <TableCell className="text-sm font-medium">{r.party}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.partyGstin}</TableCell>
                <TableCell className="text-right tabular-nums text-xs">{fmt(r.taxable)}</TableCell>
                <TableCell className="text-right tabular-nums text-xs font-semibold">{fmt(r.tax)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {statusIcon(r.status)}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${statusCls(r.status)}`}>{r.status}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{r.reason || "—"}</TableCell>
                <TableCell>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${r.resolved ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                    {r.resolved ? "Resolved" : "Open"}
                  </span>
                </TableCell>
                <TableCell>
                  {!r.resolved && r.status !== "matched" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => toast.success(`Marked ${r.invoiceRef} as resolved`)}
                    >
                      Resolve
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {filtered && (
        <p className="text-xs text-muted-foreground px-1">
          {filtered.length} of {data?.length || 0} items · ITC at risk: {fmt(summary.itcAtRisk)}
        </p>
      )}
    </div>
  );
}
