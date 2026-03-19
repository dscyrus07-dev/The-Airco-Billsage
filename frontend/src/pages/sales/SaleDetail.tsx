import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { salesService } from "@/services/salesService";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Download, Edit2, CreditCard, AlertTriangle,
  FileText, User, Calendar, Send, CheckCircle2, Hash,
} from "lucide-react";
import { toast } from "sonner";
import RecordPaymentModal from "@/components/payments/RecordPaymentModal";
import { useState } from "react";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const statusCls = (s: string) => {
  const m: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
    issued: "bg-blue-100 text-blue-700 border-blue-200",
    partial: "bg-purple-100 text-purple-700 border-purple-200",
    overdue: "bg-red-100 text-red-700 border-red-200",
    draft: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return m[s] || "bg-slate-100 text-slate-600 border-slate-200";
};

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2 border-b last:border-0">
      <span className="text-xs text-muted-foreground w-40 flex-shrink-0">{label}</span>
      <span className={`text-xs font-medium text-right flex-1 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{children}</h3>;
}

export default function SaleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const { data: sale, isLoading } = useQuery({
    queryKey: ["sales", id],
    queryFn: () => salesService.getInvoice(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-base font-semibold mb-1">Invoice not found</h2>
        <p className="text-sm text-muted-foreground mb-4">Sales invoice ID "{id}" does not exist in the register.</p>
        <Button onClick={() => navigate("/app/sales/register")} variant="outline" className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to Register
        </Button>
      </div>
    );
  }

  const handlePaymentSuccess = () => {
    // Refresh invoice data to show updated payment status
    queryClient.invalidateQueries({ queryKey: ["sales", id] });
    queryClient.invalidateQueries({ queryKey: ["sales"] });
    queryClient.invalidateQueries({ queryKey: ["sales-kpis"] });
  };

  const outstanding = sale ? (sale.total_amount - sale.paid_amount) : 0;
  const dueDate = sale.due_date ? new Date(sale.due_date) : null;
  const isOverdue = dueDate && dueDate < new Date() && outstanding > 0;
  const collectionRate = sale.total_amount > 0 ? (sale.paid_amount / sale.total_amount) * 100 : 0;

  const reminderEmail = sale.flags?.recipient_contact?.email || sale.customer_email;

  const handleDownloadInvoice = async () => {
    try {
      await salesService.downloadInvoice(sale.id, `${sale.invoice_number}.json`);
      toast.success("Invoice downloaded successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download invoice");
    }
  };

  const handleSendReminder = () => {
    if (!reminderEmail) {
      toast.error("Customer email is not available for this invoice");
      return;
    }

    const subject = encodeURIComponent(`Payment reminder for invoice ${sale.invoice_number}`);
    const body = encodeURIComponent(
      `Hello,\n\nThis is a reminder that invoice ${sale.invoice_number} dated ${sale.invoice_date} has an outstanding balance of ${fmt(outstanding)}.${sale.due_date ? ` The due date was ${sale.due_date}.` : ''}\n\nPlease let us know if payment has already been made.\n`
    );

    window.location.href = `mailto:${reminderEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/app/sales/register")} className="gap-1.5 -ml-1">
            <ArrowLeft className="h-4 w-4" /> Register
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold font-mono">{sale.invoice_number}</h1>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusCls(sale.status)}`}>
                {sale.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Customer {sale.customer_id ? sale.customer_id.substring(0, 8) : 'N/A'} · {sale.invoice_date}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadInvoice}>
            <Download className="h-3.5 w-3.5" /> Download PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSendReminder}>
            <Send className="h-3.5 w-3.5" /> Send Reminder
          </Button>
          {outstanding > 0 && (
            <Button size="sm" className="gap-1.5" onClick={() => setShowPaymentModal(true)}>
              <CreditCard className="h-3.5 w-3.5" /> Record Payment
            </Button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {isOverdue && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-red-700">Invoice Overdue</p>
            <p className="text-[10px] text-red-600 mt-0.5">
              Due date was {sale.due_date}. {fmt(outstanding)} is still outstanding. Consider sending a payment reminder.
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Invoice Overview */}
          <Card className="p-4">
            <SectionLabel>Invoice Overview</SectionLabel>
            <div className="grid grid-cols-2 gap-x-8">
              <div>
                <InfoRow label="Customer ID" value={<span className="font-semibold">{sale.customer_id || 'N/A'}</span>} mono />
                <InfoRow label="Invoice Number" value={sale.invoice_number} mono />
                <InfoRow label="Invoice Date" value={sale.invoice_date} />
                <InfoRow label="Due Date" value={
                  <span className={isOverdue ? "text-red-600 font-semibold" : ""}>{sale.due_date || "—"}</span>
                } />
                <InfoRow label="Place of Supply" value={sale.place_of_supply} />
              </div>
              <div>
                <InfoRow label="Status" value={sale.status} />
                <InfoRow label="Collection Rate" value={
                  <span className={collectionRate === 100 ? "text-emerald-600" : collectionRate > 0 ? "text-amber-600" : "text-red-600"}>
                    {collectionRate.toFixed(1)}%
                  </span>
                } />
                <InfoRow label="Amount Collected" value={<span className="text-emerald-600 font-semibold">{fmt(sale.paid_amount)}</span>} />
                <InfoRow label="Outstanding" value={
                  <span className={outstanding > 0 ? "text-red-600 font-semibold" : "text-emerald-600"}>{fmt(outstanding)}</span>
                } />
              </div>
            </div>
          </Card>

          {/* Contact Person */}
          {sale.flags?.recipient_contact && (
            <Card className="p-4">
              <SectionLabel>Recipient Contact Person</SectionLabel>
              <div className="grid grid-cols-2 gap-x-8">
                <div>
                  <InfoRow label="Contact Name" value={sale.flags.recipient_contact.name || "—"} />
                  <InfoRow label="Phone" value={sale.flags.recipient_contact.phone || "—"} />
                  <InfoRow label="Email" value={sale.flags.recipient_contact.email || "—"} />
                </div>
                <div>
                  <InfoRow label="Invoice Style" value={
                    sale.flags.invoice_style ? 
                      sale.flags.invoice_style.split("-").map((word: string) => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(" ") : "Classic Business"
                  } />
                </div>
              </div>
            </Card>
          )}

          {/* Financial Summary */}
          <Card className="p-4">
            <SectionLabel>Financial Summary</SectionLabel>
            <div className="grid grid-cols-2 gap-x-8">
              <div>
                <InfoRow label="Taxable Value" value={fmt(sale.taxable_amount)} />
                <InfoRow label="CGST" value={fmt(sale.cgst)} />
                <InfoRow label="SGST" value={fmt(sale.sgst)} />
                <InfoRow label="IGST" value={fmt(sale.igst)} />
              </div>
              <div>
                <InfoRow label="Total Tax" value={fmt(sale.total_tax)} />
                <InfoRow label="Freight" value="—" />
                <div className="flex items-start justify-between py-2">
                  <span className="text-xs font-semibold w-40">Grand Total</span>
                  <span className="text-sm font-bold text-right">{fmt(sale.total_amount)}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Line Items */}
          <Card className="p-4">
            <SectionLabel>Line Items</SectionLabel>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="pb-2 pt-1 text-left font-medium text-muted-foreground pl-1">Description</th>
                    <th className="pb-2 pt-1 text-left font-medium text-muted-foreground">HSN</th>
                    <th className="pb-2 pt-1 text-right font-medium text-muted-foreground">Qty</th>
                    <th className="pb-2 pt-1 text-right font-medium text-muted-foreground">Rate</th>
                    <th className="pb-2 pt-1 text-right font-medium text-muted-foreground">Taxable</th>
                    <th className="pb-2 pt-1 text-right font-medium text-muted-foreground">CGST</th>
                    <th className="pb-2 pt-1 text-right font-medium text-muted-foreground">SGST</th>
                    <th className="pb-2 pt-1 text-right font-medium text-muted-foreground">IGST</th>
                    <th className="pb-2 pt-1 text-right font-medium text-muted-foreground pr-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item, i) => (
                    <tr key={item.line_no || i} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2 pl-1 font-medium">{item.description}</td>
                      <td className="py-2 font-mono">{item.hsn_sac}</td>
                      <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(item.rate)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(item.taxable_value)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(item.cgst_amount)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(item.sgst_amount)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(item.igst_amount)}</td>
                      <td className="py-2 text-right tabular-nums font-semibold pr-1">{fmt(item.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-semibold">
                    <td colSpan={4} className="py-2 pl-1 text-xs">Totals</td>
                    <td className="py-2 text-right tabular-nums text-xs">{fmt(sale.taxable_amount)}</td>
                    <td className="py-2 text-right tabular-nums text-xs">{fmt(sale.cgst)}</td>
                    <td className="py-2 text-right tabular-nums text-xs">{fmt(sale.sgst)}</td>
                    <td className="py-2 text-right tabular-nums text-xs">{fmt(sale.igst)}</td>
                    <td className="py-2 text-right tabular-nums text-sm font-bold pr-1">{fmt(sale.total_amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>

        {/* Right: Audit + Actions */}
        <div className="space-y-4">
          {/* Collection Status */}
          <Card className="p-4">
            <SectionLabel>Collection Status</SectionLabel>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Invoice Total</span>
                <span className="font-semibold">{fmt(sale.total_amount)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Collected</span>
                <span className="text-emerald-600 font-semibold">{fmt(sale.paid_amount)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden mt-1">
                <div
                  className={`h-full rounded-full ${collectionRate === 100 ? "bg-emerald-500" : collectionRate > 0 ? "bg-amber-500" : "bg-red-400"}`}
                  style={{ width: `${collectionRate}%` }}
                />
              </div>
              <div className="flex justify-between text-xs pt-1 border-t">
                <span className={outstanding > 0 ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"}>
                  {outstanding > 0 ? `${fmt(outstanding)} outstanding` : "Fully collected"}
                </span>
                <span className="text-muted-foreground">{collectionRate.toFixed(0)}%</span>
              </div>
            </div>
          </Card>

          {/* Audit Metadata */}
          <Card className="p-4">
            <SectionLabel>Audit Metadata</SectionLabel>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Invoice date</p>
                  <p className="text-xs font-medium">{sale.invoice_date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Due date</p>
                  <p className={`text-xs font-medium ${isOverdue ? "text-red-600" : ""}`}>{sale.due_date || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Internal ID</p>
                  <p className="text-xs font-mono font-medium">{sale.id}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-1.5">
                {sale.status === "paid"
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                <span className="text-xs text-muted-foreground">
                  {sale.status === "paid" ? "Fully settled" : outstanding > 0 ? "Payment pending" : "In progress"}
                </span>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-4">
            <SectionLabel>Quick Actions</SectionLabel>
            <div className="space-y-2">
              {outstanding > 0 && (
                <Button size="sm" className="w-full gap-1.5 text-xs" onClick={() => setShowPaymentModal(true)}>
                  <CreditCard className="h-3.5 w-3.5" /> Record Payment
                </Button>
              )}
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" onClick={handleSendReminder}>
                <Send className="h-3.5 w-3.5" /> Send Payment Reminder
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" onClick={handleDownloadInvoice}>
                <Download className="h-3.5 w-3.5" /> Download Invoice PDF
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs" onClick={() => navigate("/app/sales/customers")}>
                <User className="h-3.5 w-3.5" /> View Customer Profile
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Payment Recording Modal */}
      {sale && (
        <RecordPaymentModal
          open={showPaymentModal}
          onOpenChange={setShowPaymentModal}
          invoice={{
            id: sale.id,
            invoice_number: sale.invoice_number,
            total_amount: sale.total_amount,
            paid_amount: sale.paid_amount,
            outstanding: outstanding,
          }}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
