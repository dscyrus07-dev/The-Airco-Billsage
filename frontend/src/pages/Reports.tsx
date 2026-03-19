import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPurchases, fetchReconciliation } from "@/services/api";
import { salesService } from "@/services/salesService";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { Purchase } from "@/types/api";
import type { SalesInvoiceListItem } from "@/services/salesService";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const statusCls = (s: string) => {
  const m: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
    approved: "bg-blue-100 text-blue-700 border-blue-200",
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    overdue: "bg-red-100 text-red-700 border-red-200",
    matched: "bg-emerald-100 text-emerald-700 border-emerald-200",
    mismatch: "bg-red-100 text-red-700 border-red-200",
    draft: "bg-slate-100 text-slate-600 border-slate-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
    issued: "bg-blue-100 text-blue-700 border-blue-200",
    partial: "bg-purple-100 text-purple-700 border-purple-200",
  };
  return m[s] || "bg-slate-100 text-slate-600 border-slate-200";
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${statusCls(status)}`}>{status}</span>
  );
}

// Audit trail will be implemented when backend audit logging is ready
const AUDIT_TRAIL_AVAILABLE = false;

function LoadingRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState("purchase-register");
  const { data: purchases, isLoading: loadingP } = useQuery({ queryKey: ["purchases"], queryFn: () => fetchPurchases() });
  const { data: sales, isLoading: loadingS } = useQuery({ queryKey: ["sales"], queryFn: () => salesService.listInvoices() });
  const { data: recon, isLoading: loadingR } = useQuery({ queryKey: ["reconciliation"], queryFn: fetchReconciliation });

  const totalPurchases = purchases?.reduce((a, p) => a + p.totalAmount, 0) || 0;
  const totalSales = sales?.reduce((a, s) => a + s.total_amount, 0) || 0;
  const totalInputGST = purchases?.reduce((a, p) => a + p.totalTax, 0) || 0;
  const totalOutputGST = 0; // total_tax not available in SalesInvoiceListItem

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">Reports & Audit Center</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Financial registers, GST reports, audit trail, and export</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => toast.info("Preparing export…")}>
            <Download className="h-3.5 w-3.5" /> Export Current View
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {[
            ["purchase-register", "Purchase Register"],
            ["sales-register", "Sales Register"],
            ["gst-summary", "GST Summary"],
            ["reconciliation", "Reconciliation"],
            ["audit-trail", "Audit Trail"],
          ].map(([val, label]) => (
            <TabsTrigger key={val} value={val} className="text-xs">{label}</TabsTrigger>
          ))}
        </TabsList>

        {/* Purchase Register */}
        <TabsContent value="purchase-register">
          <div className="flex items-center justify-between mb-3 mt-1">
            <p className="text-xs text-muted-foreground">{purchases?.length || 0} invoices · Total: {fmt(totalPurchases)} · Input GST: {fmt(totalInputGST)}</p>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => toast.info("Downloading Purchase Register…")}>
              <Download className="h-3 w-3" /> Download Excel
            </Button>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {["Invoice No", "Vendor", "Date", "Taxable", "CGST", "SGST", "IGST", "Total Tax", "Total", "Status", "GST Status", "Recorded By"].map(h => (
                    <TableHead key={h} className="text-xs font-semibold">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingP ? <LoadingRows cols={12} /> : (purchases || []).map((p: Purchase) => (
                  <TableRow key={p.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-medium">{p.invoiceNo}</TableCell>
                    <TableCell className="text-xs max-w-[120px] truncate">{p.vendor}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.invoiceDate}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{fmt(p.taxableAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{fmt(p.cgst)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{fmt(p.sgst)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{fmt(p.igst)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs">{fmt(p.totalTax)}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs font-semibold">{fmt(p.totalAmount)}</TableCell>
                    <TableCell><StatusPill status={p.status} /></TableCell>
                    <TableCell><StatusPill status={p.gstStatus} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.recordedBy}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Sales Register */}
        <TabsContent value="sales-register">
          <div className="flex items-center justify-between mb-3 mt-1">
            <p className="text-xs text-muted-foreground">{sales?.length || 0} invoices · Total: {fmt(totalSales)} · Output GST: {fmt(totalOutputGST)}</p>
            <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => toast.info("Downloading Sales Register…")}>
              <Download className="h-3 w-3" /> Download Excel
            </Button>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {["Invoice No", "Customer", "Date", "Taxable", "CGST", "SGST", "IGST", "Total Tax", "Total", "Paid", "Outstanding", "Status"].map(h => (
                    <TableHead key={h} className="text-xs font-semibold">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingS ? <LoadingRows cols={12} /> : (sales || []).map((s: SalesInvoiceListItem) => {
                  const outstanding = s.total_amount - s.paid_amount;
                  const taxableApprox = s.total_amount / 1.18;
                  const taxApprox = s.total_amount - taxableApprox;
                  return (
                    <TableRow key={s.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs font-medium">{s.invoice_number}</TableCell>
                      <TableCell className="text-xs max-w-[120px] truncate">Customer {s.customer_id.substring(0, 8)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.invoice_date}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{fmt(taxableApprox)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">—</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">—</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">—</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{fmt(taxApprox)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs font-semibold">{fmt(s.total_amount)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-emerald-600">{fmt(s.paid_amount)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {outstanding > 0 ? <span className={s.status === "overdue" ? "text-red-600 font-semibold" : "text-amber-600"}>{fmt(outstanding)}</span> : "—"}
                      </TableCell>
                      <TableCell><StatusPill status={s.status} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* GST Summary */}
        <TabsContent value="gst-summary">
          <div className="mt-1 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Input GST", val: fmt(totalInputGST), cls: "text-emerald-600" },
                { label: "Total Output GST", val: fmt(totalOutputGST), cls: "text-blue-600" },
                { label: "Net Payable", val: fmt(totalOutputGST - totalInputGST), cls: totalOutputGST > totalInputGST ? "text-red-600" : "text-emerald-600" },
                { label: "ITC Available", val: fmt(totalInputGST), cls: "text-emerald-600" },
              ].map((s, i) => (
                <Card key={i} className="p-3">
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  <p className={`text-lg font-bold mt-0.5 tabular-nums ${s.cls}`}>{s.val}</p>
                </Card>
              ))}
            </div>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    {["Invoice No", "Party", "Type", "Taxable", "CGST", "SGST", "IGST", "Total Tax", "GST Status"].map(h => (
                      <TableHead key={h} className="text-xs font-semibold">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingP ? <LoadingRows cols={9} /> : (purchases || []).map((p: Purchase) => (
                    <TableRow key={p.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs">{p.invoiceNo}</TableCell>
                      <TableCell className="text-xs max-w-[120px] truncate">{p.vendor}</TableCell>
                      <TableCell className="text-xs"><span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 border border-violet-200 font-medium">Purchase</span></TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{fmt(p.taxableAmount)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{fmt(p.cgst)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{fmt(p.sgst)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{fmt(p.igst)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs font-semibold">{fmt(p.totalTax)}</TableCell>
                      <TableCell><StatusPill status={p.gstStatus} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Reconciliation */}
        <TabsContent value="reconciliation">
          <div className="mt-1">
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    {["Invoice Ref", "Party", "GSTIN", "Taxable", "Tax", "Status", "Reason", "Resolved"].map(h => (
                      <TableHead key={h} className="text-xs font-semibold">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingR ? <LoadingRows cols={8} /> : (recon || []).map((r) => (
                    <TableRow key={r.id} className={!r.resolved && r.status !== "matched" ? "bg-red-50/30" : ""}>
                      <TableCell className="font-mono text-xs">{r.invoiceRef}</TableCell>
                      <TableCell className="text-xs font-medium">{r.party}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{r.partyGstin}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{fmt(r.taxable)}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs font-semibold">{fmt(r.tax)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {r.status === "matched" ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <AlertTriangle className="h-3 w-3 text-red-500" />}
                          <StatusPill status={r.status} />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">{r.reason || "—"}</TableCell>
                      <TableCell>
                        <StatusPill status={r.resolved ? "resolved" : "open"} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* Audit Trail */}
        <TabsContent value="audit-trail">
          <div className="mt-1">
            {!AUDIT_TRAIL_AVAILABLE ? (
              <Card className="p-8 text-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Audit Trail Coming Soon</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Comprehensive audit logging is being implemented and will be available in the next release.
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      {["Timestamp", "Action", "Entity", "User", "Type"].map(h => (
                        <TableHead key={h} className="text-xs font-semibold">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                        No audit trail entries
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
