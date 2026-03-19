import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Eye, Send, Download, Save } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface InvoiceLine {
  id: number; description: string; hsn: string; qty: number; rate: number;
  discount: number; gstPct: number; isIgst: boolean;
}

const CUSTOMERS: Record<string, { gstin: string; address: string; state: string; email: string; pan: string }> = {
  "C001": { gstin: "27AAACH1234A1ZM", address: "Hindustan Unilever Ltd, Andheri East, Mumbai", state: "Maharashtra (27)", email: "ap@hul.com", pan: "AAACH1234A" },
  "C002": { gstin: "29AABCW5678B1ZP", address: "Wipro Technologies, Sarjapur Road, Bangalore", state: "Karnataka (29)", email: "accounts@wipro.com", pan: "AABCW5678B" },
  "C003": { gstin: "27AABCL9012C1ZQ", address: "L&T Construction, Powai, Mumbai", state: "Maharashtra (27)", email: "payments@lnt.com", pan: "AABCL9012C" },
  "C004": { gstin: "24AABCA3456D1ZR", address: "Adani Enterprises, Ahmedabad", state: "Gujarat (24)", email: "billing@adani.com", pan: "AABCA3456D" },
  "C005": { gstin: "19AABCI7890E1ZS", address: "ITC Limited, Virginia House, Kolkata", state: "West Bengal (19)", email: "payables@itc.com", pan: "AABCI7890E" },
};

const SELLER_GSTIN = "27ABCDE1234F1ZB";
const SELLER_STATE = "Maharashtra (27)";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const fmtN = (n: number) => n.toLocaleString("en-IN");

const generateInvoiceNo = () => `SI-2025-${Date.now().toString().slice(-6)}`;

export default function GenerateInvoice() {
  const navigate = useNavigate();
  const [invoiceNo] = useState(generateInvoiceNo);
  const [customerId, setCustomerId] = useState("C001");
  const [invoiceDate, setInvoiceDate] = useState("2025-01-10");
  const [paymentTerms, setPaymentTerms] = useState("net30");
  const [narration, setNarration] = useState("");
  const [freight, setFreight] = useState(0);
  const [status, setStatus] = useState<"draft" | "issued">("draft");
  const [lines, setLines] = useState<InvoiceLine[]>([
    { id: 1, description: "Custom Fabrication Assembly", hsn: "7308", qty: 5, rate: 80000, discount: 0, gstPct: 18, isIgst: false },
  ]);

  const customer = CUSTOMERS[customerId];
  const isInterstate = customer?.state !== SELLER_STATE;

  const dueDate = (() => {
    const d = new Date(invoiceDate);
    const days = paymentTerms === "net15" ? 15 : paymentTerms === "net30" ? 30 : paymentTerms === "net45" ? 45 : 60;
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  })();

  const updateLine = (id: number, field: keyof InvoiceLine, value: number | string | boolean) =>
    setLines(l => l.map(li => li.id === id ? { ...li, [field]: value } : li));
  const addLine = () => setLines(l => [...l, { id: Date.now(), description: "", hsn: "", qty: 1, rate: 0, discount: 0, gstPct: 18, isIgst: isInterstate }]);
  const removeLine = (id: number) => setLines(l => l.filter(li => li.id !== id));

  const lineCalc = (l: InvoiceLine) => {
    const taxable = l.qty * l.rate * (1 - l.discount / 100);
    const totalTax = taxable * (l.gstPct / 100);
    const isIgstLine = isInterstate;
    return {
      taxable, cgst: isIgstLine ? 0 : totalTax / 2, sgst: isIgstLine ? 0 : totalTax / 2,
      igst: isIgstLine ? totalTax : 0, total: taxable + totalTax,
    };
  };

  const totals = lines.reduce((acc, l) => {
    const c = lineCalc(l);
    return {
      taxable: acc.taxable + c.taxable, cgst: acc.cgst + c.cgst,
      sgst: acc.sgst + c.sgst, igst: acc.igst + c.igst, total: acc.total + c.total,
    };
  }, { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });

  const grandTotal = totals.total + freight;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-base font-semibold">Generate Tax Invoice</h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{invoiceNo} · {status === "draft" ? "Draft" : "Issued"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => toast.success("Draft saved")}>
            <Save className="h-3.5 w-3.5" /> Save Draft
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => toast.info("Generating preview…")}>
            <Eye className="h-3.5 w-3.5" /> Preview
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => { setStatus("issued"); toast.success("Invoice issued", { description: `${invoiceNo} has been issued.` }); navigate("/app/sales/register"); }}>
            <Send className="h-3.5 w-3.5" /> Issue Invoice
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">

          {/* Section: Customer & Invoice Details */}
          <Card className="p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Customer & Invoice Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="C001">Hindustan Unilever</SelectItem>
                    <SelectItem value="C002">Wipro Technologies</SelectItem>
                    <SelectItem value="C003">Larsen &amp; Toubro</SelectItem>
                    <SelectItem value="C004">Adani Enterprises</SelectItem>
                    <SelectItem value="C005">ITC Limited</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Customer GSTIN</Label>
                <Input value={customer?.gstin || ""} readOnly className="mt-1 h-8 text-sm font-mono bg-muted" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Billing Address</Label>
                <Input value={customer?.address || ""} readOnly className="mt-1 h-8 text-sm bg-muted" />
              </div>
              <div>
                <Label className="text-xs">State / Place of Supply</Label>
                <Input value={customer?.state || ""} readOnly className="mt-1 h-8 text-sm bg-muted" />
              </div>
              <div>
                <Label className="text-xs">Customer PAN</Label>
                <Input value={customer?.pan || ""} readOnly className="mt-1 h-8 text-sm font-mono bg-muted" />
              </div>
              <div>
                <Label className="text-xs">Invoice Date</Label>
                <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Payment Terms</Label>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                  <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="net15">Net 15</SelectItem>
                    <SelectItem value="net30">Net 30</SelectItem>
                    <SelectItem value="net45">Net 45</SelectItem>
                    <SelectItem value="net60">Net 60</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Due Date (auto)</Label>
                <Input value={dueDate} readOnly className="mt-1 h-8 text-sm bg-muted" />
              </div>
              <div>
                <Label className="text-xs">Tax Type</Label>
                <Input value={isInterstate ? "IGST (Inter-state)" : "CGST + SGST (Intra-state)"} readOnly className="mt-1 h-8 text-sm bg-muted" />
              </div>
            </div>
          </Card>

          {/* Section: Line Items */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Line Items</h3>
              <Button variant="outline" size="sm" className="h-6 text-xs gap-1 px-2" onClick={addLine}>
                <Plus className="h-3 w-3" /> Add Row
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b">
                    {["#", "Description", "HSN", "Qty", "Rate", "Disc%", "GST%", "Taxable", isInterstate ? "IGST" : "CGST", isInterstate ? "" : "SGST", "Total", ""].map((h, i) => (
                      <th key={i} className={`pb-2 text-left font-medium text-muted-foreground pr-1 ${h === "" ? "w-6" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const c = lineCalc(line);
                    return (
                      <tr key={line.id} className="border-b last:border-0">
                        <td className="py-1 pr-1 text-muted-foreground">{idx + 1}</td>
                        <td className="py-1 pr-1"><Input value={line.description} onChange={e => updateLine(line.id, "description", e.target.value)} className="h-6 text-[11px] px-1 w-32" /></td>
                        <td className="py-1 pr-1"><Input value={line.hsn} onChange={e => updateLine(line.id, "hsn", e.target.value)} className="h-6 text-[11px] px-1 w-14 font-mono" /></td>
                        <td className="py-1 pr-1"><Input type="number" value={line.qty} onChange={e => updateLine(line.id, "qty", +e.target.value)} className="h-6 text-[11px] px-1 w-12 text-right" /></td>
                        <td className="py-1 pr-1"><Input type="number" value={line.rate} onChange={e => updateLine(line.id, "rate", +e.target.value)} className="h-6 text-[11px] px-1 w-20 text-right" /></td>
                        <td className="py-1 pr-1"><Input type="number" value={line.discount} onChange={e => updateLine(line.id, "discount", +e.target.value)} className="h-6 text-[11px] px-1 w-10 text-right" /></td>
                        <td className="py-1 pr-1"><Input type="number" value={line.gstPct} onChange={e => updateLine(line.id, "gstPct", +e.target.value)} className="h-6 text-[11px] px-1 w-10 text-right" /></td>
                        <td className="py-1 pr-1 text-right tabular-nums">{fmtN(Math.round(c.taxable))}</td>
                        <td className="py-1 pr-1 text-right tabular-nums">{fmtN(Math.round(isInterstate ? c.igst : c.cgst))}</td>
                        {!isInterstate && <td className="py-1 pr-1 text-right tabular-nums">{fmtN(Math.round(c.sgst))}</td>}
                        <td className="py-1 pr-1 text-right tabular-nums font-medium">{fmtN(Math.round(c.total))}</td>
                        <td className="py-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLine(line.id)} disabled={lines.length === 1}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Section: Additional Charges & Narration */}
          <Card className="p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Additional Charges & Notes</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Freight / Shipping</Label>
                <Input type="number" value={freight} onChange={e => setFreight(+e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Other Charges</Label>
                <Input type="number" defaultValue={0} className="mt-1 h-8 text-sm" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Narration / Notes</Label>
                <Input value={narration} onChange={e => setNarration(e.target.value)} placeholder="Payment terms, special instructions…" className="mt-1 h-8 text-sm" />
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Invoice Summary */}
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Invoice Summary</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Taxable Value</span>
                <span className="tabular-nums font-medium">{fmt(Math.round(totals.taxable))}</span>
              </div>
              {!isInterstate && (
                <>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">CGST</span>
                    <span className="tabular-nums">{fmt(Math.round(totals.cgst))}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">SGST</span>
                    <span className="tabular-nums">{fmt(Math.round(totals.sgst))}</span>
                  </div>
                </>
              )}
              {isInterstate && (
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">IGST</span>
                  <span className="tabular-nums">{fmt(Math.round(totals.igst))}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Total Tax</span>
                <span className="tabular-nums">{fmt(Math.round(totals.cgst + totals.sgst + totals.igst))}</span>
              </div>
              {freight > 0 && (
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Freight</span>
                  <span className="tabular-nums">{fmt(freight)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 bg-muted/30 -mx-1 px-1 rounded font-semibold">
                <span>Grand Total</span>
                <span className="tabular-nums text-sm">{fmt(Math.round(grandTotal))}</span>
              </div>
            </div>

            <Separator className="my-3" />

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice No</span>
                <span className="font-mono font-medium">{invoiceNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium truncate ml-2">{Object.entries({ C001: "HUL", C002: "Wipro", C003: "L&T", C004: "Adani", C005: "ITC" })[parseInt(customerId.replace("C", "")) - 1]?.[1]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice Date</span>
                <span>{invoiceDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span className="font-medium">{dueDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seller GSTIN</span>
                <span className="font-mono text-[10px]">{SELLER_GSTIN}</span>
              </div>
            </div>
          </Card>

          {/* Actions */}
          <Card className="p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Actions</h3>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={() => toast.success("Draft saved")}>
                <Save className="h-3.5 w-3.5" /> Save Draft
              </Button>
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={() => toast.info("Generating PDF preview…")}>
                <Eye className="h-3.5 w-3.5" /> Preview PDF
              </Button>
              <Button size="sm" className="w-full gap-1.5"
                onClick={() => { setStatus("issued"); toast.success("Invoice issued", { description: `${invoiceNo} issued to ${customerId}` }); navigate("/app/sales/register"); }}>
                <Send className="h-3.5 w-3.5" /> Issue Invoice
              </Button>
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={() => toast.info("Downloading PDF…")}>
                <Download className="h-3.5 w-3.5" /> Download PDF
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
