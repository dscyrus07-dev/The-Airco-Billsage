import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPurchases } from "@/services/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { ExportButton } from "@/components/shared/ExportButton";
import type { Purchase } from "@/types/api";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, ChevronRight } from "lucide-react";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const statusVariant = (s: string) => {
  const m: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
    approved: "bg-blue-100 text-blue-700 border-blue-200",
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    draft: "bg-slate-100 text-slate-600 border-slate-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
    matched: "bg-emerald-100 text-emerald-700 border-emerald-200",
    mismatch: "bg-red-100 text-red-700 border-red-200",
  };
  return m[s] || "bg-slate-100 text-slate-600 border-slate-200";
};

const filterConfig = [
  { key: "search", label: "Vendor", type: "search" as const, placeholder: "Search vendor..." },
  { key: "status", label: "Status", type: "select" as const, options: [
    { label: "Draft", value: "draft" }, { label: "Pending", value: "pending" },
    { label: "Approved", value: "approved" }, { label: "Paid", value: "paid" },
    { label: "Rejected", value: "rejected" },
  ]},
  { key: "gstStatus", label: "GST Status", type: "select" as const, options: [
    { label: "Matched", value: "matched" }, { label: "Mismatch", value: "mismatch" },
    { label: "Pending", value: "pending" },
  ]},
];

export default function PurchaseRegister() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { data, isLoading } = useQuery({
    queryKey: ["purchases", filters],
    queryFn: () => fetchPurchases({
      status: filters.status !== "all" ? filters.status : undefined,
      vendor: filters.search || undefined,
    }),
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Purchase Register" description="Click any row to view full invoice details" actions={
        <ExportButton 
          data={data || []} 
          filename="purchase_register"
          columns={[
            { key: 'invoiceNo', header: 'Invoice No' },
            { key: 'vendor', header: 'Vendor' },
            { key: 'invoiceDate', header: 'Invoice Date' },
            { key: 'taxableAmount', header: 'Taxable Amount' },
            { key: 'totalTax', header: 'Tax' },
            { key: 'totalAmount', header: 'Total Amount' },
            { key: 'status', header: 'Status' },
            { key: 'gstStatus', header: 'GST Status' },
            { key: 'dueDate', header: 'Due Date' },
            { key: 'recordedBy', header: 'Recorded By' },
          ]}
        />
      } />
      <FilterBar
        filters={filterConfig}
        values={filters}
        onChange={(k, v) => setFilters((p) => ({ ...p, [k]: v }))}
        onClear={() => setFilters({})}
      />

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs font-semibold">Invoice No</TableHead>
              <TableHead className="text-xs font-semibold">Vendor</TableHead>
              <TableHead className="text-xs font-semibold">Date</TableHead>
              <TableHead className="text-xs font-semibold text-right">Taxable</TableHead>
              <TableHead className="text-xs font-semibold text-right">Tax</TableHead>
              <TableHead className="text-xs font-semibold text-right">Total</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold">GST Match</TableHead>
              <TableHead className="text-xs font-semibold">Due Date</TableHead>
              <TableHead className="text-xs font-semibold">Recorded By</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 11 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : (data || []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-12">
                  No purchases found matching filters
                </TableCell>
              </TableRow>
            ) : (
              (data || []).map((row: Purchase) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors group"
                  onClick={() => navigate(`/app/purchases/${row.id}`)}
                >
                  <TableCell className="font-mono text-xs font-medium text-primary">{row.invoiceNo}</TableCell>
                  <TableCell className="text-sm max-w-[140px] truncate">{row.vendor}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.invoiceDate}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{fmt(row.taxableAmount)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{fmt(row.totalTax)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-semibold">{fmt(row.totalAmount)}</TableCell>
                  <TableCell>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusVariant(row.status)}`}>
                      {row.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {row.gstStatus === "mismatch" && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusVariant(row.gstStatus)}`}>
                        {row.gstStatus}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.dueDate}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.recordedBy}</TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {data && (
        <p className="text-xs text-muted-foreground px-1">
          {data.length} invoice{data.length !== 1 ? "s" : ""} · Total: {fmt(data.reduce((a, p) => a + p.totalAmount, 0))}
        </p>
      )}
    </div>
  );
}
