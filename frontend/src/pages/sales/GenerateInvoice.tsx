import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Eye, Send, Download, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { salesService } from "@/services/salesService";
import { getParties } from "@/services/partyService";
import { getProducts, searchProducts } from "@/services/productService";
import { companyService, type Company } from "@/services/companyService";
import InvoicePreview from "@/components/sales/InvoicePreview";
import type { Party } from "@/types/party";
import type { Product } from "@/types/product";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const fmtN = (n: number) => n.toLocaleString("en-IN");

interface ContactPerson {
  name: string;
  phone: string;
  email: string;
}

interface InvoiceLine {
  id: number;
  productId?: string;
  description: string;
  hsnSac: string;
  quantity: number;
  unit: string;
  rate: number;
  discountPercent: number;
  gstPercent: number;
}

export default function GenerateInvoice() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Preview modal state
  const [showPreview, setShowPreview] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState("classic-business");

  // Fetch company data (only when authenticated)
  const { data: companyData, isLoading: isLoadingCompany, error: companyError } = useQuery({
    queryKey: ["company", "me"],
    queryFn: () => companyService.getMyCompany(),
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Contact person state
  const [contactPerson, setContactPerson] = useState<ContactPerson>({
    name: "",
    phone: "",
    email: "",
  });

  // Fetch real customers from parties API
  const { data: partiesData } = useQuery({
    queryKey: ["parties", "customers"],
    queryFn: () => getParties({ partyType: "customer" }),
  });

  // Fetch real products
  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: () => getProducts({ pageSize: 1000 }),
  });

  const customers = partiesData?.filter(party => party.partyType === 'customer' || party.partyType === 'both') || [];
  const products = productsData?.products || [];

  // Form state
  const [customerId, setCustomerId] = useState<string>("");
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [paymentTerms, setPaymentTerms] = useState("net30");
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<InvoiceLine[]>([
    {
      id: Date.now(),
      description: "",
      hsnSac: "",
      quantity: 1,
      unit: "NOS",
      rate: 0,
      discountPercent: 0,
      gstPercent: 18,
    },
  ]);

  // Get selected customer
  const selectedCustomer = customers.find((c) => c.id === customerId);

  // Auto-select first customer if available
  useEffect(() => {
    if (customers.length > 0 && !customerId) {
      setCustomerId(customers[0].id);
    }
  }, [customers, customerId]);

  // Auto-fill contact person and payment terms when customer changes
  useEffect(() => {
    if (selectedCustomer) {
      // Auto-fill contact person details from party information
      // Use displayName as contact name if available, otherwise use partyName
      const contactName = selectedCustomer.displayName || selectedCustomer.partyName;
      
      setContactPerson({
        name: contactName,
        phone: selectedCustomer.phone || "",
        email: selectedCustomer.email || "",
      });
      
      // Auto-fill payment terms from customer's default
      if (selectedCustomer.paymentTermsDays) {
        const days = selectedCustomer.paymentTermsDays;
        if (days <= 15) setPaymentTerms("net15");
        else if (days <= 30) setPaymentTerms("net30");
        else if (days <= 45) setPaymentTerms("net45");
        else setPaymentTerms("net60");
      }
    }
  }, [selectedCustomer]);

  // Calculate due date from invoice date + payment terms
  const dueDate = (() => {
    const d = new Date(invoiceDate);
    const days = paymentTerms === "net15" ? 15 : paymentTerms === "net30" ? 30 : paymentTerms === "net45" ? 45 : 60;
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  })();

  // Determine if interstate (IGST) or intrastate (CGST+SGST)
  const customerState = selectedCustomer?.state || "";
  const companyState = companyData?.state || "";
  const isInterstate = customerState !== companyState && customerState !== "";

  // Generate invoice number (backend should control this)
  // For now, use timestamp-based approach until backend sequence is implemented
  const invoiceNumber = `SI-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

  // Line item calculations
  const lineCalc = (line: InvoiceLine) => {
    const taxableValue = line.quantity * line.rate * (1 - line.discountPercent / 100);
    const totalTax = taxableValue * (line.gstPercent / 100);
    return {
      taxableValue,
      cgstAmount: isInterstate ? 0 : totalTax / 2,
      sgstAmount: isInterstate ? 0 : totalTax / 2,
      igstAmount: isInterstate ? totalTax : 0,
      totalAmount: taxableValue + totalTax,
    };
  };

  // Invoice totals
  const baseTotals = lines.reduce(
    (acc, line) => {
      const calc = lineCalc(line);
      return {
        taxableAmount: acc.taxableAmount + calc.taxableValue,
        cgst: acc.cgst + calc.cgstAmount,
        sgst: acc.sgst + calc.sgstAmount,
        igst: acc.igst + calc.igstAmount,
        totalAmount: acc.totalAmount + calc.totalAmount,
      };
    },
    { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, totalAmount: 0 }
  );

  const totalTax = baseTotals.cgst + baseTotals.sgst + baseTotals.igst;
  const grandTotal = baseTotals.totalAmount;

  // Complete totals object for InvoicePreview
  const totals = {
    ...baseTotals,
    totalTax,
    grandTotal,
  };

  // Line item operations
  const updateLine = (id: number, field: keyof InvoiceLine, value: any) => {
    setLines((prev) => prev.map((line) => (line.id === id ? { ...line, [field]: value } : line)));
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        id: Date.now(),
        description: "",
        hsnSac: "",
        quantity: 1,
        unit: "NOS",
        rate: 0,
        discountPercent: 0,
        gstPercent: 18,
      },
    ]);
  };

  const removeLine = (id: number) => {
    if (lines.length > 1) {
      setLines((prev) => prev.filter((line) => line.id !== id));
    }
  };

  // Product selection - autofill line item
  const selectProduct = (lineId: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setLines((prev) =>
        prev.map((line) =>
          line.id === lineId
            ? {
                ...line,
                productId: product.id,
                description: product.name,
                hsnSac: product.hsnSac || "",
                unit: product.unit,
                rate: product.salePrice,
                gstPercent: product.gstPercent,
              }
            : line
        )
      );
    }
  };

  // Create invoice mutation (for Save Draft - creates as draft)
  const createInvoiceMutation = useMutation({
    mutationFn: async (style?: string) => {
      if (!customerId) {
        throw new Error("Please select a customer");
      }

      // Filter out invalid lines (empty description or quantity <= 0)
      const validLines = lines.filter(line => 
        line.description.trim() !== "" && line.quantity > 0
      );

      if (validLines.length === 0) {
        throw new Error("Please add at least one valid item with description and quantity > 0");
      }

      const invoiceData = {
        party_id: customerId,
        voucher_date: invoiceDate,
        supply_type: isInterstate ? "Interstate" : "Intrastate",
        place_of_supply: customerState || companyState,
        notes: [
          narration,
          style ? `Invoice Style: ${style}` : null,
          contactPerson.name ? `Contact: ${contactPerson.name}` : null,
          contactPerson.phone ? `Phone: ${contactPerson.phone}` : null,
          contactPerson.email ? `Email: ${contactPerson.email}` : null,
        ].filter(Boolean).join(' | '),
        items: validLines.map((line, idx) => {
          const calc = lineCalc(line);
          const amount = line.quantity * line.rate;
          const discountAmount = amount * (line.discountPercent / 100);
          const taxableAmount = amount - discountAmount;
          
          return {
            line_number: idx + 1,
            product_id: line.productId || null,
            description: line.description,
            hsn_sac_code: line.hsnSac || "",
            quantity: line.quantity,
            rate: line.rate,
            discount_pct: line.discountPercent,
            discount_amount: discountAmount,
            taxable_amount: taxableAmount,
            cgst_rate: isInterstate ? 0 : line.gstPercent / 2,
            cgst_amount: isInterstate ? 0 : calc.cgstAmount,
            sgst_rate: isInterstate ? 0 : line.gstPercent / 2,
            sgst_amount: isInterstate ? 0 : calc.sgstAmount,
            igst_rate: isInterstate ? line.gstPercent : 0,
            igst_amount: isInterstate ? calc.igstAmount : 0,
            cess_rate: 0,
            cess_amount: 0,
            line_total: calc.totalAmount,
          };
        }),
      };

      console.log('Draft Invoice Payload:', JSON.stringify(invoiceData, null, 2));
      return salesService.generateInvoice(invoiceData);
    },
    onSuccess: (data, style) => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["salesKPIs"] });
      queryClient.invalidateQueries({ queryKey: ["salesAnalytics"] });
      toast.success("Draft saved successfully", {
        description: `Invoice ${invoiceNumber} has been saved as draft`,
      });
      setShowPreview(false);
      navigate("/app/sales/register");
    },
    onError: (error: any) => {
      toast.error("Failed to save draft", {
        description: error.message || "Please check all fields and try again",
      });
    },
  });

  // Generate invoice mutation (for Issue Invoice - creates as approved)
  const generateInvoiceMutation = useMutation({
    mutationFn: async (style?: string) => {
      if (!customerId) {
        throw new Error("Please select a customer");
      }

      // Filter out invalid lines (empty description or quantity <= 0)
      const validLines = lines.filter(line => 
        line.description.trim() !== "" && line.quantity > 0
      );

      if (validLines.length === 0) {
        throw new Error("Please add at least one valid item with description and quantity > 0");
      }

      const invoiceData = {
        party_id: customerId,
        voucher_date: invoiceDate,
        supply_type: isInterstate ? "Interstate" : "Intrastate",
        place_of_supply: customerState || companyState,
        notes: [
          narration,
          style ? `Invoice Style: ${style}` : null,
          contactPerson.name ? `Contact: ${contactPerson.name}` : null,
          contactPerson.phone ? `Phone: ${contactPerson.phone}` : null,
          contactPerson.email ? `Email: ${contactPerson.email}` : null,
        ].filter(Boolean).join(' | '),
        items: validLines.map((line, idx) => {
          const calc = lineCalc(line);
          const amount = line.quantity * line.rate;
          const discountAmount = amount * (line.discountPercent / 100);
          const taxableAmount = amount - discountAmount;
          
          return {
            line_number: idx + 1,
            product_id: line.productId || null,
            description: line.description,
            hsn_sac_code: line.hsnSac || "",
            quantity: line.quantity,
            rate: line.rate,
            discount_pct: line.discountPercent,
            discount_amount: discountAmount,
            taxable_amount: taxableAmount,
            cgst_rate: isInterstate ? 0 : line.gstPercent / 2,
            cgst_amount: isInterstate ? 0 : calc.cgstAmount,
            sgst_rate: isInterstate ? 0 : line.gstPercent / 2,
            sgst_amount: isInterstate ? 0 : calc.sgstAmount,
            igst_rate: isInterstate ? line.gstPercent : 0,
            igst_amount: isInterstate ? calc.igstAmount : 0,
            cess_rate: 0,
            cess_amount: 0,
            line_total: calc.totalAmount,
          };
        }),
      };

      console.log('Invoice Generation Payload:', JSON.stringify(invoiceData, null, 2));
      return salesService.generateInvoice(invoiceData);
    },
    onSuccess: (data, style) => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["salesKPIs"] });
      queryClient.invalidateQueries({ queryKey: ["salesAnalytics"] });
      toast.success("Invoice generated successfully", {
        description: `Invoice ${invoiceNumber} has been issued with ${style || "default"} style`,
      });
      setShowPreview(false);
      navigate("/app/sales/register");
    },
    onError: (error: any) => {
      toast.error("Failed to generate invoice", {
        description: error.message || "Please check all fields and try again",
      });
    },
  });

  const handleSaveDraft = () => createInvoiceMutation.mutate(undefined);
  const handleIssueInvoice = () => {
    if (!customerId) {
      toast.error("Please select a customer first");
      return;
    }
    if (lines.length === 0) {
      toast.error("Please add at least one item");
      return;
    }
    if (!contactPerson.name.trim()) {
      toast.error("Please enter contact person name");
      return;
    }
    if (!contactPerson.phone.trim()) {
      toast.error("Please enter contact person phone");
      return;
    }
    setShowPreview(true);
  };

  const handleRaiseInvoice = (style: string) => {
    setSelectedStyle(style);
    generateInvoiceMutation.mutate(style);  // Use generateInvoiceMutation for issuing
  };

  const handleClosePreview = () => {
    setShowPreview(false);
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-base font-semibold">Generate Sales Invoice</h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">{invoiceNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleSaveDraft}
            disabled={createInvoiceMutation.isPending}
          >
            <Save className="h-3.5 w-3.5" /> Save Draft
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleIssueInvoice}
            disabled={generateInvoiceMutation.isPending || !customerId}
          >
            <Send className="h-3.5 w-3.5" /> Issue Invoice
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Customer & Invoice Details */}
          <Card className="p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Customer & Invoice Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Customer *</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.partyName} {customer.gstin ? `(${customer.gstin})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCustomer && (
                <>
                  <div>
                    <Label className="text-xs">Customer GSTIN</Label>
                    <Input value={selectedCustomer.gstin || "—"} readOnly className="mt-1 h-8 text-sm font-mono bg-muted" />
                  </div>
                  <div>
                    <Label className="text-xs">State / Place of Supply</Label>
                    <Input value={selectedCustomer.state || "—"} readOnly className="mt-1 h-8 text-sm bg-muted" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Billing Address</Label>
                    <Input
                      value={selectedCustomer.address ? `${selectedCustomer.address}, ${selectedCustomer.city || ""} ${selectedCustomer.pinCode || ""}`.trim() : "—"}
                      readOnly
                      className="mt-1 h-8 text-sm bg-muted"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Phone</Label>
                    <Input value={selectedCustomer.phone || "—"} readOnly className="mt-1 h-8 text-sm bg-muted" />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input value={selectedCustomer.email || "—"} readOnly className="mt-1 h-8 text-sm bg-muted" />
                  </div>
                </>
              )}

              <div>
                <Label className="text-xs">Invoice Date</Label>
                <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Payment Terms</Label>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                  <SelectTrigger className="mt-1 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
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
                <Input
                  value={isInterstate ? "IGST (Inter-state)" : "CGST + SGST (Intra-state)"}
                  readOnly
                  className="mt-1 h-8 text-sm bg-muted"
                />
              </div>
            </div>
          </Card>

          {/* Contact Person Details */}
          <Card className="p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Recipient Contact Person
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3">
                <Label className="text-xs">Contact Person Name *</Label>
                <Input
                  value={contactPerson.name}
                  onChange={(e) => setContactPerson(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter contact person name"
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Phone/Mobile *</Label>
                <Input
                  value={contactPerson.phone}
                  onChange={(e) => setContactPerson(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+91 9876543210"
                  className="mt-1 h-8 text-sm"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Email (Optional)</Label>
                <Input
                  value={contactPerson.email}
                  onChange={(e) => setContactPerson(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="contact@customer.com"
                  type="email"
                  className="mt-1 h-8 text-sm"
                />
              </div>
            </div>
          </Card>

          {/* Line Items */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Line Items</h3>
              <Button variant="outline" size="sm" className="h-6 text-xs gap-1 px-2" onClick={addLine}>
                <Plus className="h-3 w-3" /> Add Row
              </Button>
            </div>
            <div className="space-y-3">
              {lines.map((line, idx) => {
                const calc = lineCalc(line);
                return (
                  <div key={line.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Line {idx + 1}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeLine(line.id)}
                        disabled={lines.length === 1}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <Label className="text-xs">Product (optional)</Label>
                        <Select value={line.productId || ""} onValueChange={(val) => selectProduct(line.id, val)}>
                          <SelectTrigger className="mt-1 h-8 text-sm">
                            <SelectValue placeholder="Select product to autofill" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} - {product.hsnSac}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-2">
                        <Label className="text-xs">Description *</Label>
                        <Input
                          value={line.description}
                          onChange={(e) => updateLine(line.id, "description", e.target.value)}
                          className="mt-1 h-8 text-sm"
                          placeholder="Item description"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">HSN/SAC</Label>
                        <Input
                          value={line.hsnSac}
                          onChange={(e) => updateLine(line.id, "hsnSac", e.target.value)}
                          className="mt-1 h-8 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unit</Label>
                        <Input
                          value={line.unit}
                          onChange={(e) => updateLine(line.id, "unit", e.target.value)}
                          className="mt-1 h-8 text-sm"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Quantity</Label>
                        <Input
                          type="number"
                          value={line.quantity}
                          onChange={(e) => updateLine(line.id, "quantity", parseFloat(e.target.value) || 0)}
                          className="mt-1 h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Rate</Label>
                        <Input
                          type="number"
                          value={line.rate}
                          onChange={(e) => updateLine(line.id, "rate", parseFloat(e.target.value) || 0)}
                          className="mt-1 h-8 text-sm"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Discount %</Label>
                        <Input
                          type="number"
                          value={line.discountPercent}
                          onChange={(e) => updateLine(line.id, "discountPercent", parseFloat(e.target.value) || 0)}
                          className="mt-1 h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">GST %</Label>
                        <Select
                          value={line.gstPercent.toString()}
                          onValueChange={(val) => updateLine(line.id, "gstPercent", parseFloat(val))}
                        >
                          <SelectTrigger className="mt-1 h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0%</SelectItem>
                            <SelectItem value="5">5%</SelectItem>
                            <SelectItem value="12">12%</SelectItem>
                            <SelectItem value="18">18%</SelectItem>
                            <SelectItem value="28">28%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-2 pt-2 border-t">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Taxable:</span>
                            <span className="font-medium">{fmt(calc.taxableValue)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Tax:</span>
                            <span className="font-medium">{fmt(calc.cgstAmount + calc.sgstAmount + calc.igstAmount)}</span>
                          </div>
                          <div className="flex justify-between col-span-2 font-semibold">
                            <span>Line Total:</span>
                            <span>{fmt(calc.totalAmount)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Narration */}
          <Card className="p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Notes</h3>
            <div>
              <Label className="text-xs">Narration / Terms</Label>
              <Input
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="Payment terms, special instructions…"
                className="mt-1 h-8 text-sm"
              />
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
                <span className="tabular-nums font-medium">{fmt(totals.taxableAmount)}</span>
              </div>
              {!isInterstate && (
                <>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">CGST</span>
                    <span className="tabular-nums">{fmt(totals.cgst)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">SGST</span>
                    <span className="tabular-nums">{fmt(totals.sgst)}</span>
                  </div>
                </>
              )}
              {isInterstate && (
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">IGST</span>
                  <span className="tabular-nums">{fmt(totals.igst)}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b">
                <span className="text-muted-foreground">Total Tax</span>
                <span className="tabular-nums">{fmt(totalTax)}</span>
              </div>
              <div className="flex justify-between py-2 bg-muted/30 -mx-1 px-1 rounded font-semibold">
                <span>Grand Total</span>
                <span className="tabular-nums text-sm">{fmt(grandTotal)}</span>
              </div>
            </div>

            <Separator className="my-3" />

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice No</span>
                <span className="font-mono font-medium">{invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium truncate ml-2">{selectedCustomer?.tradeName || selectedCustomer?.legalName || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice Date</span>
                <span>{invoiceDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due Date</span>
                <span className="font-medium">{dueDate}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Invoice Preview Modal */}
      <InvoicePreview
        open={showPreview}
        onClose={handleClosePreview}
        onRaiseInvoice={handleRaiseInvoice}
        invoiceNumber={invoiceNumber}
        invoiceDate={invoiceDate}
        dueDate={dueDate}
        selectedCustomer={selectedCustomer}
        companyData={companyData}
        contactPerson={contactPerson}
        lines={lines}
        totals={totals}
        narration={narration}
        isInterstate={isInterstate}
        isLoading={generateInvoiceMutation.isPending}
      />
    </div>
  );
}
