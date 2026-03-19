import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { salesService } from "@/services/salesService";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { ExportButton } from "@/components/shared/ExportButton";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, ChevronRight } from "lucide-react";

const fmt = (n: number) => {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
};
const fmtFull = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const statusCls = (s: string) => {
  const m: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
    approved: "bg-blue-100 text-blue-700 border-blue-200",  // Map approved to blue (issued color)
    issued: "bg-blue-100 text-blue-700 border-blue-200",
    partial: "bg-purple-100 text-purple-700 border-purple-200",
    overdue: "bg-red-100 text-red-700 border-red-200",
    draft: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return m[s] || "bg-slate-100 text-slate-600 border-slate-200";
};

const statusLabel = (s: string) => {
  const m: Record<string, string> = {
    paid: "Paid",
    approved: "Issued",  // Map approved to "Issued" for display
    issued: "Issued",
    partial: "Partial",
    overdue: "Overdue",
    draft: "Draft",
  };
  return m[s] || s;
};

const filterConfig = [
  { key: "search", label: "Customer", type: "search" as const, placeholder: "Search customer..." },
  { key: "status", label: "Status", type: "select" as const, options: [
    { label: "Issued", value: "approved" }, { label: "Partial", value: "partial" },
    { label: "Paid", value: "paid" }, { label: "Overdue", value: "overdue" }, { label: "Draft", value: "draft" },
  ]},
];

export default function SalesRegister() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { data, isLoading } = useQuery({
    queryKey: ["sales", filters],
    queryFn: () => salesService.listInvoices({ 
      status: filters.status && filters.status !== "all" ? filters.status : undefined, 
      search: filters.search || undefined 
    }),
  });

  const totalRevenue = data?.reduce((a, s) => a + s.total_amount, 0) || 0;
  const totalCollected = data?.reduce((a, s) => a + s.paid_amount, 0) || 0;
  const outstanding = totalRevenue - totalCollected;
  const overdueCount = data?.filter(s => {
    const dueDate = s.due_date ? new Date(s.due_date) : null;
    return dueDate && dueDate < new Date() && s.paid_amount < s.total_amount;
  }).length || 0;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">Sales Register</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Click any row to view full invoice details</p>
        </div>
        <ExportButton 
          data={data || []} 
          filename="sales_register"
          columns={[
            { key: 'invoice_number', header: 'Invoice No' },
            { key: 'customer_id', header: 'Customer ID' },
            { key: 'invoice_date', header: 'Invoice Date' },
            { key: 'total_amount', header: 'Total Amount' },
            { key: 'paid_amount', header: 'Collected' },
            { key: 'status', header: 'Status' },
            { key: 'due_date', header: 'Due Date' },
          ]}
        />
      </div>

      {/* Summary Strip */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Revenue", value: fmt(totalRevenue), cls: "text-foreground" },
            { label: "Collected", value: fmt(totalCollected), cls: "text-emerald-600" },
            { label: "Outstanding", value: fmt(outstanding), cls: outstanding > 0 ? "text-amber-600" : "text-foreground" },
            { label: "Overdue", value: `${overdueCount} invoices`, cls: overdueCount > 0 ? "text-red-600" : "text-foreground" },
          ].map((s, i) => (
            <Card key={i} className="px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
              <p className={`text-sm font-bold mt-0.5 tabular-nums ${s.cls}`}>{s.value}</p>
            </Card>
          ))}
        </div>
      )}

      <FilterBar filters={filterConfig} values={filters} onChange={(k, v) => setFilters(p => ({ ...p, [k]: v }))} onClear={() => setFilters({})} />

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs font-semibold">Invoice No</TableHead>
              <TableHead className="text-xs font-semibold">Customer</TableHead>
              <TableHead className="text-xs font-semibold">Date</TableHead>
              <TableHead className="text-xs font-semibold text-right">Taxable</TableHead>
              <TableHead className="text-xs font-semibold text-right">Tax</TableHead>
              <TableHead className="text-xs font-semibold text-right">Total</TableHead>
              <TableHead className="text-xs font-semibold text-right">Collected</TableHead>
              <TableHead className="text-xs font-semibold text-right">Outstanding</TableHead>
              <TableHead className="text-xs font-semibold">Status</TableHead>
              <TableHead className="text-xs font-semibold">Due Date</TableHead>
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
                <TableCell colSpan={11} className="text-center py-12 text-sm text-muted-foreground">No invoices found</TableCell>
              </TableRow>
            ) : (data || []).map((row) => {
              const outstandingAmt = row.total_amount - row.paid_amount;
              const dueDate = row.due_date ? new Date(row.due_date) : null;
              const isOverdue = dueDate && dueDate < new Date() && outstandingAmt > 0;
              const taxableAmount = row.total_amount - (row.total_amount * 0.18 / 1.18); // Approximate
              const totalTax = row.total_amount - taxableAmount;
              return (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors group"
                  onClick={() => navigate(`/app/sales/${row.id}`)}
                >
                  <TableCell className="font-mono text-xs font-medium text-primary">{row.invoice_number}</TableCell>
                  <TableCell className="text-sm max-w-[140px] truncate">Customer {row.customer_id.substring(0, 8)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.invoice_date}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{fmtFull(taxableAmount)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{fmtFull(totalTax)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm font-semibold">{fmtFull(row.total_amount)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs text-emerald-600">{fmtFull(row.paid_amount)}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {outstandingAmt > 0 ? (
                      <span className={isOverdue ? "text-red-600 font-semibold" : "text-amber-600"}>
                        {fmtFull(outstandingAmt)}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {isOverdue && <AlertTriangle className="h-3 w-3 text-red-500" />}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusCls(row.status)}`}>
                        {statusLabel(row.status)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className={`text-xs ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                    {row.due_date || "—"}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {data && (
        <p className="text-xs text-muted-foreground px-1">
          {data.length} invoice{data.length !== 1 ? "s" : ""} · Total: {fmt(totalRevenue)} · Outstanding: {fmt(outstanding)}
        </p>
      )}
    </div>
  );
}
