import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { purchaseService } from "@/services/purchaseService";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Download, Edit2, CheckCircle2, CreditCard,
  AlertTriangle, FileText, User, Calendar, Building2, Hash, Info,
} from "lucide-react";
import { toast } from "sonner";
import ApprovalPanel from "@/components/approvals/ApprovalPanel";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const statusCls = (s: string) => {
  const m: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
    approved: "bg-blue-100 text-blue-700 border-blue-200",
    confirmed: "bg-blue-100 text-blue-700 border-blue-200",
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    draft: "bg-slate-100 text-slate-600 border-slate-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
    matched: "bg-emerald-100 text-emerald-700 border-emerald-200",
    mismatch: "bg-red-100 text-red-700 border-red-200",
  };
  return m[s] || "bg-slate-100 text-slate-600 border-slate-200";
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{children}</h3>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2 border-b last:border-0">
      <span className="text-xs text-muted-foreground w-40 flex-shrink-0">{label}</span>
      <span className={`text-xs font-medium text-right flex-1 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

export default function PurchaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: purchase, isLoading, error } = useQuery({
    queryKey: ["purchase", id],
    queryFn: () => purchaseService.getPurchaseInvoice(id!),
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

  if (!purchase) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-base font-semibold mb-1">Invoice not found</h2>
        <p className="text-sm text-muted-foreground mb-4">Purchase ID "{id}" does not exist in the register.</p>
        <Button onClick={() => navigate("/app/purchases/register")} variant="outline" className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back to Register
        </Button>
      </div>
    );
  }

  const hasMismatch = purchase.gstStatus === "mismatch";
  const isOverdue = purchase.status !== "paid" && new Date(purchase.dueDate) < new Date();

  const handleDownloadBill = async () => {
    try {
      await purchaseService.downloadPurchaseBill(purchase.id, purchase.sourceFileName || `${purchase.invoiceNo}.json`);
      toast.success("Bill downloaded successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download bill");
    }
  };

  const handleOpenPayables = () => {
    navigate('/app/purchases/payables');
  };

  const handleDownloadOriginalBill = async () => {
    if (!purchase.hasOriginalFile) {
      toast.error("Original uploaded bill is not available for this entry");
      return;
    }

    try {
      await purchaseService.downloadOriginalBill(purchase.id, purchase.sourceFileName || `${purchase.invoiceNo}.pdf`);
      toast.success("Original bill downloaded successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download original bill");
    }
  };

  const handleEditEntry = () => {
    navigate(`/app/purchases/${purchase.id}/edit`);
  };

  const refreshPurchase = () => {
    queryClient.invalidateQueries({ queryKey: ["purchase", id] });
    queryClient.invalidateQueries({ queryKey: ["purchases"] });
    queryClient.invalidateQueries({ queryKey: ["purchase-kpis"] });
  };

  const handleApprovePurchase = async () => {
    try {
      await purchaseService.approvePurchaseInvoice(purchase.id);
      toast.success("Invoice approved successfully");
      refreshPurchase();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve invoice");
    }
  };

  const handleRejectPurchase = async (reason: string) => {
    try {
      await purchaseService.rejectPurchaseInvoice(purchase.id, reason);
      toast.success("Invoice rejected successfully");
      refreshPurchase();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject invoice");
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/app/purchases/register")} className="gap-1.5 -ml-1">
            <ArrowLeft className="h-4 w-4" /> Register
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold font-mono">{purchase.invoiceNo}</h1>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusCls(purchase.status)}`}>
                {purchase.status}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusCls(purchase.gstStatus)}`}>
                GST: {purchase.gstStatus}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{purchase.vendor} · {purchase.invoiceDate}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadBill}>
            <Download className="h-3.5 w-3.5" /> Download Bill
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleEditEntry}>
            <Edit2 className="h-3.5 w-3.5" /> Edit Entry
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleApprovePurchase}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {(hasMismatch || isOverdue) && (
        <div className="space-y-2">
          {hasMismatch && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700">GST Mismatch Detected</p>
                <p className="text-[10px] text-amber-600 mt-0.5">{purchase.notes || "Tax amount differs from GSTR-2B filing. Review and reconcile before claiming ITC."}</p>
              </div>
            </div>
          )}
          {isOverdue && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-700">Payment Overdue</p>
                <p className="text-[10px] text-red-600 mt-0.5">
                  Due date was {purchase.dueDate}. Payment of {fmt(purchase.totalAmount)} is outstanding.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: Invoice + Financial */}
        <div className="lg:col-span-2 space-y-4">
          {/* Invoice Overview */}
          <Card className="p-4">
            <SectionLabel>Invoice Overview</SectionLabel>
            <div className="grid grid-cols-2 gap-x-8">
              <div>
                <InfoRow label="Vendor Name" value={<span className="font-semibold">{purchase.vendor}</span>} />
                <InfoRow label="Vendor GSTIN" value={purchase.gstin} mono />
                <InfoRow label="Invoice Number" value={purchase.invoiceNo} mono />
                <InfoRow label="Invoice Date" value={purchase.invoiceDate} />
                <InfoRow label="Due Date" value={
                  <span className={isOverdue ? "text-red-600 font-semibold" : ""}>{purchase.dueDate}</span>
                } />
              </div>
              <div>
                <InfoRow label="Category" value={purchase.category} />
                <InfoRow label="Cost Center" value={purchase.costCenter} />
                <InfoRow label="Place of Supply" value="Maharashtra (27)" />
                <InfoRow label="Payment Terms" value={purchase.paymentTerms || "Not specified"} />
                <InfoRow label="Entry Method" value={
                  <span className="flex items-center gap-1">
                    <Info className="h-3 w-3" /> Manual Entry
                  </span>
                } />
              </div>
            </div>
          </Card>

          {/* Financial Summary */}
          <Card className="p-4">
            <SectionLabel>Financial Summary</SectionLabel>
            <div className="grid grid-cols-2 gap-x-8">
              <div>
                <InfoRow label="Taxable Value" value={fmt(purchase.taxableAmount)} />
                <InfoRow label="CGST" value={fmt(purchase.cgst)} />
                <InfoRow label="SGST" value={fmt(purchase.sgst)} />
                <InfoRow label="IGST" value={fmt(purchase.igst)} />
              </div>
              <div>
                <InfoRow label="Total Tax" value={fmt(purchase.totalTax)} />
                <InfoRow label="Freight" value="—" />
                <InfoRow label="TDS" value="—" />
                <div className="flex items-start justify-between py-2">
                  <span className="text-xs font-semibold w-40">Grand Total</span>
                  <span className="text-sm font-bold text-right">{fmt(purchase.totalAmount)}</span>
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
                  {purchase.lineItems.map((item, i) => (
                    <tr key={item.id || i} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2 pl-1 font-medium">{item.description}</td>
                      <td className="py-2 font-mono">{item.hsn}</td>
                      <td className="py-2 text-right tabular-nums">{item.qty}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(item.rate)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(item.taxableAmount)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(item.cgst)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(item.sgst)}</td>
                      <td className="py-2 text-right tabular-nums">{fmt(item.igst)}</td>
                      <td className="py-2 text-right tabular-nums font-semibold pr-1">{fmt(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/30 font-semibold">
                    <td colSpan={4} className="py-2 pl-1 text-xs">Totals</td>
                    <td className="py-2 text-right tabular-nums text-xs">{fmt(purchase.taxableAmount)}</td>
                    <td className="py-2 text-right tabular-nums text-xs">{fmt(purchase.cgst)}</td>
                    <td className="py-2 text-right tabular-nums text-xs">{fmt(purchase.sgst)}</td>
                    <td className="py-2 text-right tabular-nums text-xs">{fmt(purchase.igst)}</td>
                    <td className="py-2 text-right tabular-nums text-sm font-bold pr-1">{fmt(purchase.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>

        {/* Right column: Source doc + Audit */}
        <div className="space-y-4">
          {/* Source Document */}
          <Card className="p-4">
            <SectionLabel>Source Document</SectionLabel>
            <div className="rounded-lg bg-muted/30 border-2 border-dashed p-6 flex flex-col items-center text-center mb-3">
              <FileText className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-xs font-medium">{purchase.sourceFileName || `${purchase.invoiceNo}.pdf`}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {purchase.hasOriginalFile ? "Uploaded document" : "No uploaded source document linked"}
              </p>
            </div>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5 text-xs"
                onClick={handleDownloadOriginalBill}
                disabled={!purchase.hasOriginalFile}
              >
                <Download className="h-3.5 w-3.5" /> Download Original Bill
              </Button>
            </div>
          </Card>

          {/* Audit Metadata */}
          <Card className="p-4">
            <SectionLabel>Audit Metadata</SectionLabel>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Recorded by</p>
                  <p className="text-xs font-medium">{purchase.recordedBy}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Entry date</p>
                  <p className="text-xs font-medium">{purchase.invoiceDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Entry method</p>
                  <p className="text-xs font-medium">Manual Entry</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Internal ID</p>
                  <p className="text-xs font-mono font-medium">{purchase.id}</p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Validation flags</p>
                <div className="space-y-1">
                  {hasMismatch ? (
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      <span className="text-[10px] text-amber-700">GST mismatch with GSTR-2B</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span className="text-[10px] text-emerald-700">No issues detected</span>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-[10px] text-muted-foreground mb-1.5">Status history</p>
                <div className="space-y-1.5">
                  {[
                    { status: "Created", date: purchase.invoiceDate, by: purchase.recordedBy },
                    { status: purchase.status === "paid" ? "Paid" : "Approved", date: purchase.invoiceDate, by: "System" },
                  ].map((h, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">{h.status} by {h.by}</span>
                      <span className="text-muted-foreground">{h.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Approval Panel */}
          <ApprovalPanel
            status={(() => {
              // Map purchase status to ApprovalPanel expected status
              switch (purchase.status) {
                case 'pending':
                  return 'pending_approval';
                case 'approved':
                case 'confirmed':
                  return 'approved';
                case 'rejected':
                case 'cancelled':
                  return 'rejected';
                case 'draft':
                  return 'pending_approval';
                default:
                  return 'pending_approval';
              }
            })()}
            approvalStatus={purchase.approvalStatus}
            onApprove={handleApprovePurchase}
            onReject={handleRejectPurchase}
            onRequestCorrection={(comment) => {
              toast.info(comment ? `Correction requested: ${comment}` : "Correction request captured");
            }}
            currentUser="Current User"
            canApprove={true}
          />

          {/* Payment Status */}
          <Card className="p-4">
            <SectionLabel>Payment Status</SectionLabel>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total Amount</span>
                <span className="text-sm font-bold">{fmt(purchase.totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Paid Amount</span>
                <span className="text-sm font-semibold text-emerald-600">{fmt(purchase.paidAmount || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Outstanding</span>
                <span className="text-sm font-bold text-amber-600">{fmt(purchase.totalAmount - (purchase.paidAmount || 0))}</span>
              </div>
              <Separator />
              <div className="flex items-center gap-2">
                <Badge className={`text-xs ${statusCls(purchase.status)}`}>
                  {purchase.status === "paid" ? "Fully Paid" : purchase.status === "partial" ? "Partially Paid" : "Unpaid"}
                </Badge>
                {isOverdue && (
                  <Badge variant="destructive" className="text-xs">Overdue</Badge>
                )}
              </div>
              {purchase.status !== "paid" && (purchase.status === "approved" || purchase.status === "confirmed") && (
                <Button size="sm" className="w-full gap-1.5 text-xs" onClick={handleOpenPayables}>
                  <CreditCard className="h-3.5 w-3.5" /> Record Payment
                </Button>
              )}
              {purchase.status !== "approved" && purchase.status !== "confirmed" && purchase.status !== "paid" && (
                <div className="text-center p-2 bg-amber-50 rounded text-xs text-amber-700">
                  Payment blocked: Invoice not approved
                </div>
              )}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-4">
            <SectionLabel>Quick Actions</SectionLabel>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs"
                onClick={handleOpenPayables}>
                <CreditCard className="h-3.5 w-3.5" /> View Payment History
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs"
                onClick={() => navigate("/app/gst/reconciliation")}>
                <AlertTriangle className="h-3.5 w-3.5" /> View GST Reconciliation
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs"
                onClick={() => navigate(`/app/purchases/vendors`)}>
                <Building2 className="h-3.5 w-3.5" /> View Vendor Profile
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
