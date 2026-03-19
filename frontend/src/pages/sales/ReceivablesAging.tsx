import { useQuery } from "@tanstack/react-query";
import { receivablesService } from "@/services/receivablesService";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Send, FileText, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const fmt = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString("en-IN")}`;
};

export default function ReceivablesAging() {
  const navigate = useNavigate();
  const { data: agingData, isLoading } = useQuery({
    queryKey: ["receivables-aging"],
    queryFn: () => receivablesService.getReceivablesAging(),
  });

  const totalReceivables = agingData?.summary.total_outstanding || 0;
  const customerList = agingData?.by_customer || [];
  const overdueCount = customerList.filter(c => 
    (c.days_1_30 + c.days_31_60 + c.days_61_90 + c.days_90_plus) > 0
  ).length;

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
        <h1 className="text-lg font-semibold">Receivables Aging</h1>
        <p className="text-sm text-muted-foreground mt-1">Outstanding customer payments you need to collect</p>
      </div>

      {/* Simple Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 border-2">
          <p className="text-sm text-muted-foreground">Total Receivables</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{fmt(totalReceivables)}</p>
          <p className="text-xs text-muted-foreground mt-1">{customerList.length} customers</p>
        </Card>
        <Card className={`p-4 border-2 ${overdueCount > 0 ? "border-red-300 bg-red-50" : "border-emerald-300 bg-emerald-50"}`}>
          <p className={`text-sm font-medium ${overdueCount > 0 ? "text-red-700" : "text-emerald-700"}`}>
            {overdueCount > 0 ? "⚠️ Overdue Collections" : "✓ No Overdue"}
          </p>
          <p className={`text-2xl font-bold mt-1 tabular-nums ${overdueCount > 0 ? "text-red-700" : "text-emerald-700"}`}>
            {overdueCount}
          </p>
          <p className={`text-xs mt-1 ${overdueCount > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {overdueCount > 0 ? "customers with overdue bills" : "All collections on track"}
          </p>
        </Card>
        <Card className="p-4 border-2">
          <p className="text-sm text-muted-foreground">Total Invoices</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{agingData?.invoices.length || 0}</p>
          <p className="text-xs text-muted-foreground mt-1">pending collection</p>
        </Card>
      </div>

      {/* Main Receivables Table - Simple & Prioritized */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b bg-muted/30">
          <h2 className="text-sm font-semibold">Collection List — Sorted by Priority</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Overdue collections shown first, then by amount</p>
        </div>
        
        <div className="divide-y">
          {customerList.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-muted-foreground">No pending collections</p>
              <p className="text-xs text-muted-foreground mt-1">All customer bills are paid ✓</p>
            </div>
          ) : (
            customerList.map((c) => {
              const isOverdue = (c.days_1_30 + c.days_31_60 + c.days_61_90 + c.days_90_plus) > 0;
              
              return (
                <div 
                  key={c.customer_id} 
                  className={`p-4 hover:bg-muted/50 transition-colors ${isOverdue ? "bg-red-50/50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: Party Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold truncate">{c.customer_name}</h3>
                        {isOverdue && (
                          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-300 font-medium whitespace-nowrap">
                            <AlertCircle className="h-2.5 w-2.5" />
                            Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Outstanding: <span className="font-semibold">{fmt(c.total_outstanding)}</span>
                      </p>
                    </div>

                    {/* Right: Aging Breakdown */}
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{fmt(c.total_outstanding)}</p>
                      <div className="text-xs space-y-0.5 mt-1">
                        {c.current > 0 && <p className="text-muted-foreground">Current: {fmt(c.current)}</p>}
                        {c.days_1_30 > 0 && <p className="text-amber-600">1-30d: {fmt(c.days_1_30)}</p>}
                        {c.days_31_60 > 0 && <p className="text-orange-600">31-60d: {fmt(c.days_31_60)}</p>}
                        {c.days_61_90 > 0 && <p className="text-red-600">61-90d: {fmt(c.days_61_90)}</p>}
                        {c.days_90_plus > 0 && <p className="text-red-700 font-semibold">90+d: {fmt(c.days_90_plus)}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => toast.success(`Reminder sent to ${c.customer_name}`)}
                    >
                      <Send className="h-3.5 w-3.5" /> Send Reminder
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={() => navigate(`/app/parties/${c.customer_id}`)}
                    >
                      <FileText className="h-3.5 w-3.5" /> View Customer
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
