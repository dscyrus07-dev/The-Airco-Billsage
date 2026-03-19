import { useQuery } from "@tanstack/react-query";
import { fetchPurchases } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CreditCard, FileText, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import RecordPayment from "@/components/payments/RecordPayment";

const fmt = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
};

export default function PayablesAging() {
  const navigate = useNavigate();
  const { data: purchases, isLoading } = useQuery({
    queryKey: ["purchases"],
    queryFn: () => fetchPurchases(),
  });

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);

  const unpaidPurchases = purchases?.filter(p => p.status !== "paid" && p.status !== "draft") || [];
  
  const totalPayable = unpaidPurchases.reduce((sum, p) => sum + (p.totalAmount - p.paidAmount), 0);
  
  const vendorPayables = unpaidPurchases.reduce((acc, p) => {
    const outstanding = p.totalAmount - p.paidAmount;
    if (outstanding <= 0) return acc;
    
    if (!acc[p.vendorId]) {
      acc[p.vendorId] = { 
        vendorId: p.vendorId,
        vendor: p.vendor, 
        outstanding: 0, 
        invoiceCount: 0, 
        oldestDue: p.dueDate,
        isOverdue: false,
        invoices: []
      };
    }
    acc[p.vendorId].outstanding += outstanding;
    acc[p.vendorId].invoiceCount += 1;
    acc[p.vendorId].invoices.push(p);
    if (new Date(p.dueDate) < new Date(acc[p.vendorId].oldestDue)) {
      acc[p.vendorId].oldestDue = p.dueDate;
    }
    if (new Date(p.dueDate) < new Date()) {
      acc[p.vendorId].isOverdue = true;
    }
    return acc;
  }, {} as Record<string, { vendorId: string; vendor: string; outstanding: number; invoiceCount: number; oldestDue: string; isOverdue: boolean; invoices: any[] }>);

  const vendorList = Object.values(vendorPayables).sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return b.outstanding - a.outstanding;
  });

  const overdueCount = vendorList.filter(v => v.isOverdue).length;

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Simple Header */}
      <div>
        <h1 className="text-lg font-semibold">Payables Aging</h1>
        <p className="text-sm text-muted-foreground mt-1">Outstanding vendor payments you need to make</p>
      </div>

      {/* Simple Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-2">
          <p className="text-sm text-muted-foreground">Total Outstanding</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{fmt(totalPayable)}</p>
          <p className="text-xs text-muted-foreground mt-1">{vendorList.length} vendors</p>
        </Card>
        <Card className={`p-4 border-2 ${overdueCount > 0 ? "border-red-300 bg-red-50" : "border-emerald-300 bg-emerald-50"}`}>
          <p className={`text-sm font-medium ${overdueCount > 0 ? "text-red-700" : "text-emerald-700"}`}>
            {overdueCount > 0 ? "⚠️ Overdue Payments" : "✓ No Overdue"}
          </p>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${overdueCount > 0 ? "text-red-700" : "text-emerald-700"}`}>
            {overdueCount}
          </p>
          <p className={`text-xs mt-1 ${overdueCount > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {overdueCount > 0 ? "vendors with overdue bills" : "All payments on track"}
          </p>
        </Card>
        <Card className="p-4 border-2">
          <p className="text-sm text-muted-foreground">Total Invoices</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{unpaidPurchases.length}</p>
          <p className="text-xs text-muted-foreground mt-1">pending payment</p>
        </Card>
      </div>

      {/* Main Payables Table - Simple & Prioritized */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b bg-muted/30">
          <h2 className="text-sm font-semibold">Payment List — Sorted by Priority</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Overdue payments shown first, then by amount</p>
        </div>
        
        <div className="divide-y">
          {vendorList.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-muted-foreground">No pending payments</p>
              <p className="text-xs text-muted-foreground mt-1">All vendor bills are paid ✓</p>
            </div>
          ) : (
            vendorList.map((v) => {
              const daysOverdue = v.isOverdue 
                ? Math.ceil((new Date().getTime() - new Date(v.oldestDue).getTime()) / (1000 * 60 * 60 * 24))
                : 0;
              
              return (
                <div 
                  key={v.vendorId} 
                  className={`p-4 hover:bg-muted/50 transition-colors ${v.isOverdue ? "bg-red-50/50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Party Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold truncate">{v.vendor}</h3>
                        {v.isOverdue && (
                          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-300 font-medium whitespace-nowrap">
                            <AlertCircle className="h-2.5 w-2.5" />
                            {daysOverdue} days overdue
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{v.invoiceCount} {v.invoiceCount === 1 ? "invoice" : "invoices"}</span>
                        <span>·</span>
                        <span>Oldest due: {v.oldestDue}</span>
                      </div>
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Outstanding</p>
                        <p className={`text-lg font-bold tabular-nums ${v.isOverdue ? "text-red-700" : ""}`}>
                          {fmt(v.outstanding)}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Button 
                          size="sm" 
                          className="h-8 gap-1.5 text-xs whitespace-nowrap"
                          onClick={() => {
                            setSelectedVendor(v);
                            setPaymentDialogOpen(true);
                          }}
                        >
                          <CreditCard className="h-3.5 w-3.5" />
                          Record Payment
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-8 gap-1.5 text-xs whitespace-nowrap"
                          onClick={() => navigate(`/app/purchases/${v.invoices[0]?.id}`)}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          View Invoice
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Invoice List (optional - shown inline for simplicity) */}
                  {v.invoices.length > 1 && (
                    <details className="mt-3">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />
                        Show {v.invoices.length} invoices
                      </summary>
                      <div className="mt-2 ml-4 space-y-1">
                        {v.invoices.map(inv => (
                          <div key={inv.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                            <span className="font-mono">{inv.invoiceNo}</span>
                            <span className="text-muted-foreground">Due: {inv.dueDate}</span>
                            <span className="font-semibold tabular-nums">{fmt(inv.totalAmount - inv.paidAmount)}</span>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-6 text-xs"
                              onClick={() => navigate(`/app/purchases/${inv.id}`)}
                            >
                              View
                            </Button>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );

  return (
    <>
      <div className="space-y-5 animate-fade-in">
        {/* All the existing JSX content */}
        {/* Simple Header */}
        <div>
          <h1 className="text-lg font-semibold">Kitna Paisa Kis Ko Dena Hai</h1>
          <p className="text-sm text-muted-foreground mt-1">Outstanding vendor payments you need to make</p>
        </div>

        {/* Simple Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 border-2">
            <p className="text-sm text-muted-foreground">Total Outstanding</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{fmt(totalPayable)}</p>
            <p className="text-xs text-muted-foreground mt-1">{vendorList.length} vendors</p>
          </Card>
          <Card className={`p-4 border-2 ${overdueCount > 0 ? "border-red-300 bg-red-50" : "border-emerald-300 bg-emerald-50"}`}>
            <p className={`text-sm font-medium ${overdueCount > 0 ? "text-red-700" : "text-emerald-700"}`}>
              {overdueCount > 0 ? "⚠️ Overdue Payments" : "✓ No Overdue"}
            </p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${overdueCount > 0 ? "text-red-700" : "text-emerald-700"}`}>
              {overdueCount}
            </p>
            <p className={`text-xs mt-1 ${overdueCount > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {overdueCount > 0 ? "vendors with overdue bills" : "All payments on track"}
            </p>
          </Card>
          <Card className="p-4 border-2">
            <p className="text-sm text-muted-foreground">Total Invoices</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{unpaidPurchases.length}</p>
            <p className="text-xs text-muted-foreground mt-1">pending payment</p>
          </Card>
        </div>

        {/* Main Payables Table - Simple & Prioritized */}
        <Card className="p-0 overflow-hidden">
          <div className="p-4 border-b bg-muted/30">
            <h2 className="text-sm font-semibold">Payment List — Sorted by Priority</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Overdue payments shown first, then by amount</p>
          </div>
          
          <div className="divide-y">
            {vendorList.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm text-muted-foreground">No pending payments</p>
                <p className="text-xs text-muted-foreground mt-1">All vendor bills are paid ✓</p>
              </div>
            ) : (
              vendorList.map((v) => {
                const daysOverdue = v.isOverdue 
                  ? Math.ceil((new Date().getTime() - new Date(v.oldestDue).getTime()) / (1000 * 60 * 60 * 24))
                  : 0;
                
                return (
                  <div 
                    key={v.vendorId} 
                    className={`p-4 hover:bg-muted/50 transition-colors ${v.isOverdue ? "bg-red-50/50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Left: Party Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold truncate">{v.vendor}</h3>
                          {v.isOverdue && (
                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-300 font-medium whitespace-nowrap">
                              <AlertCircle className="h-2.5 w-2.5" />
                              {daysOverdue} days overdue
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{v.invoiceCount} {v.invoiceCount === 1 ? "invoice" : "invoices"}</span>
                          <span>·</span>
                          <span>Oldest due: {v.oldestDue}</span>
                        </div>
                      </div>

                      {/* Right: Amount & Actions */}
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Outstanding</p>
                          <p className={`text-lg font-bold tabular-nums ${v.isOverdue ? "text-red-700" : ""}`}>
                            {fmt(v.outstanding)}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <Button 
                            size="sm" 
                            className="h-8 gap-1.5 text-xs whitespace-nowrap"
                            onClick={() => {
                              setSelectedVendor(v);
                              setPaymentDialogOpen(true);
                            }}
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Record Payment
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="h-8 gap-1.5 text-xs whitespace-nowrap"
                            onClick={() => navigate(`/app/purchases/${v.invoices[0]?.id}`)}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            View Invoice
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Invoice List */}
                    {v.invoices.length > 1 && (
                      <details className="mt-3">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1">
                          <ChevronRight className="h-3 w-3" />
                          Show {v.invoices.length} invoices
                        </summary>
                        <div className="mt-2 ml-4 space-y-1">
                          {v.invoices.map(inv => (
                            <div key={inv.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                              <span className="font-mono">{inv.invoiceNo}</span>
                              <span className="text-muted-foreground">Due: {inv.dueDate}</span>
                              <span className="font-semibold tabular-nums">{fmt(inv.totalAmount - inv.paidAmount)}</span>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 text-xs"
                                onClick={() => navigate(`/app/purchases/${inv.id}`)}
                              >
                                View
                              </Button>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Record Payment Dialog */}
      {selectedVendor && (
        <RecordPayment
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          vendor={{
            id: selectedVendor.vendorId,
            name: selectedVendor.vendor,
            invoices: selectedVendor.invoices.map(inv => ({
              id: inv.id,
              invoiceNo: inv.invoiceNo,
              invoiceDate: inv.invoiceDate,
              dueDate: inv.dueDate,
              totalAmount: inv.totalAmount,
              paidAmount: inv.paidAmount,
              outstanding: inv.totalAmount - inv.paidAmount,
              isOverdue: new Date(inv.dueDate) < new Date(),
            }))
          }}
          onSuccess={() => {
            // Refresh data or update local state
            toast.success('Payment recorded successfully');
          }}
        />
      )}
    </>
  );
}
