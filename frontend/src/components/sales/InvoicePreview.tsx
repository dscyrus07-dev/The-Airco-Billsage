import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Download, Eye, Send, X, Printer, FileText } from "lucide-react";
import type { Party } from "@/types/party";
import type { Company } from "@/services/companyService";

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

interface InvoiceTotals {
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  grandTotal: number;
}

interface ContactPerson {
  name: string;
  phone: string;
  email: string;
}

interface InvoicePreviewProps {
  open: boolean;
  onClose: () => void;
  onRaiseInvoice: (style: string) => void;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  selectedCustomer: Party | null;
  companyData: Company | null;
  contactPerson: ContactPerson;
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  narration: string;
  isInterstate: boolean;
  isLoading?: boolean;
}

const INVOICE_STYLES = [
  { id: "gst-tax-invoice", name: "GST Tax Invoice", description: "Premium Indian GST compliant invoice" },
  { id: "classic-business", name: "Classic Business", description: "Traditional professional layout" },
  { id: "modern-branded", name: "Modern Branded", description: "Contemporary with emphasis" },
];

const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtN = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const lineCalc = (line: InvoiceLine) => {
  const amount = line.quantity * line.rate;
  const discountAmount = amount * (line.discountPercent / 100);
  const taxableValue = amount - discountAmount;
  const gstAmount = taxableValue * (line.gstPercent / 100);
  const totalAmount = taxableValue + gstAmount;
  
  return {
    amount,
    discountAmount,
    taxableValue,
    gstAmount,
    totalAmount,
    cgstAmount: line.gstPercent > 0 ? gstAmount / 2 : 0,
    sgstAmount: line.gstPercent > 0 ? gstAmount / 2 : 0,
    igstAmount: line.gstPercent > 0 ? gstAmount : 0,
  };
};

const getCompanyAddress = (company: Company): string => {
  const parts = [
    company.address_line1,
    company.address_line2,
    company.landmark,
    company.city,
    company.district,
    company.state,
    company.postal_code,
    company.country
  ].filter(Boolean);
  
  return parts.length > 0 ? parts.join(", ") : "";
};

const getCustomerAddress = (customer: Party | null | undefined): string => {
  if (!customer) return "";
  
  const parts = [
    customer.address,
    customer.city,
    customer.state,
    customer.pinCode
  ].filter(Boolean);
  
  return parts.length > 0 ? parts.join(", ") : "";
};

const numberToWords = (num: number): string => {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const tens = ["", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const twenties = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
  if (num === 0) return "Zero";
  
  const convert = (n: number): string => {
    if (n < 20) return tens[n] || ones[n];
    if (n < 100) return twenties[Math.floor(n / 10)] + " " + ones[n % 10];
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred " + convert(n % 100);
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand " + convert(n % 1000);
    if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh " + convert(n % 100000);
    return convert(Math.floor(n / 10000000)) + " Crore " + convert(n % 10000000);
  };
  
  return convert(num) + " Rupees Only";
};

// Main GST Tax Invoice Component
const GSTTaxInvoice = ({ 
  companyData, 
  selectedCustomer, 
  contactPerson, 
  invoiceNumber, 
  invoiceDate, 
  dueDate,
  lines,
  totals,
  narration,
  isInterstate
}: {
  companyData: Company | null;
  selectedCustomer: Party | null;
  contactPerson: ContactPerson;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  narration: string;
  isInterstate: boolean;
}) => {
  const placeOfSupply = selectedCustomer?.state || companyData?.state || "";
  const supplyType = isInterstate ? "Inter-State Supply" : "Intra-State Supply";
  
  return (
    <div className="bg-white text-gray-900 print:bg-white print:text-black" id="invoice-content">
      {/* Header Section */}
      <div className="border-b-4 border-blue-600 pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-3">
              {companyData?.logo_url && (
                <img src={companyData.logo_url} alt="Company Logo" className="h-16 w-auto" />
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{companyData?.trade_name || companyData?.legal_name || "Company Name"}</h1>
                {companyData?.display_name && companyData.display_name !== companyData.trade_name && (
                  <p className="text-sm text-gray-600">{companyData.display_name}</p>
                )}
              </div>
            </div>
            
            {/* Company Details */}
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
              <div>
                {companyData?.legal_name && <p><strong>Legal Name:</strong> {companyData.legal_name}</p>}
                {companyData?.trade_name && <p><strong>Trade Name:</strong> {companyData.trade_name}</p>}
                {getCompanyAddress(companyData) && <p><strong>Address:</strong> {getCompanyAddress(companyData)}</p>}
                {companyData?.primary_phone && <p><strong>Phone:</strong> {companyData.primary_phone}</p>}
                {companyData?.primary_email && <p><strong>Email:</strong> {companyData.primary_email}</p>}
                {companyData?.website && <p><strong>Website:</strong> {companyData.website}</p>}
              </div>
              <div>
                {companyData?.gstin && <p><strong>GSTIN:</strong> {companyData.gstin}</p>}
                {companyData?.pan && <p><strong>PAN:</strong> {companyData.pan}</p>}
                {companyData?.cin && <p><strong>CIN:</strong> {companyData.cin}</p>}
                {companyData?.tan && <p><strong>TAN:</strong> {companyData.tan}</p>}
                {companyData?.state && <p><strong>State:</strong> {companyData.state}</p>}
                {companyData?.country && <p><strong>Country:</strong> {companyData.country}</p>}
              </div>
            </div>
          </div>
          
          {/* Invoice Title */}
          <div className="text-center">
            <div className="bg-blue-600 text-white px-6 py-3 rounded-lg">
              <h2 className="text-xl font-bold">TAX INVOICE</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">Original for Recipient</p>
            <div className="mt-3 text-xs">
              <p><strong>Invoice No:</strong> {invoiceNumber}</p>
              <p><strong>Date:</strong> {new Date(invoiceDate).toLocaleDateString('en-IN')}</p>
              <p><strong>Due Date:</strong> {new Date(dueDate).toLocaleDateString('en-IN')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Details */}
      <div className="mb-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-sm mb-3 text-gray-900">BILLING TO</h3>
            <div className="text-xs space-y-1">
              <p className="font-semibold text-sm">{selectedCustomer?.partyName || "N/A"}</p>
              {selectedCustomer?.displayName && selectedCustomer.displayName !== selectedCustomer.partyName && (
                <p>{selectedCustomer.displayName}</p>
              )}
              <p>{getCustomerAddress(selectedCustomer)}</p>
              <p><strong>GSTIN:</strong> {selectedCustomer?.gstin || "N/A"}</p>
              <p><strong>PAN:</strong> {selectedCustomer?.pan || "N/A"}</p>
              <p><strong>State:</strong> {selectedCustomer?.state || "N/A"}</p>
              <p><strong>Phone:</strong> {selectedCustomer?.phone || "N/A"}</p>
              <p><strong>Email:</strong> {selectedCustomer?.email || "N/A"}</p>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-sm mb-3 text-gray-900">SHIPPING TO</h3>
            <div className="text-xs space-y-1">
              <p className="font-semibold text-sm">{selectedCustomer?.partyName || "N/A"}</p>
              <p>{getCustomerAddress(selectedCustomer)}</p>
              <p><strong>State:</strong> {selectedCustomer?.state || "N/A"}</p>
            </div>
            
            {(contactPerson.name || contactPerson.phone || contactPerson.email) && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <h4 className="font-semibold text-xs mb-2">CONTACT PERSON</h4>
                <p className="text-xs"><strong>Name:</strong> {contactPerson.name || "N/A"}</p>
                <p className="text-xs"><strong>Phone:</strong> {contactPerson.phone || "N/A"}</p>
                <p className="text-xs"><strong>Email:</strong> {contactPerson.email || "N/A"}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Metadata */}
      <div className="mb-6">
        <div className="grid grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-gray-600">Place of Supply</p>
            <p className="font-semibold">{placeOfSupply}</p>
          </div>
          <div>
            <p className="text-gray-600">Supply Type</p>
            <p className="font-semibold">{supplyType}</p>
          </div>
          <div>
            <p className="text-gray-600">PO/Ref No</p>
            <p className="font-semibold">-</p>
          </div>
          <div>
            <p className="text-gray-600">IRN</p>
            <p className="font-semibold">-</p>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-6">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100 border">
              <th className="border p-2 text-left">#</th>
              <th className="border p-2 text-left">Description of Goods</th>
              <th className="border p-2 text-center">HSN/SAC</th>
              <th className="border p-2 text-center">Qty</th>
              <th className="border p-2 text-center">Unit</th>
              <th className="border p-2 text-right">Rate</th>
              <th className="border p-2 text-right">Discount</th>
              <th className="border p-2 text-right">Taxable Value</th>
              <th className="border p-2 text-center">GST %</th>
              <th className="border p-2 text-right">CGST</th>
              <th className="border p-2 text-right">SGST</th>
              <th className="border p-2 text-right">IGST</th>
              <th className="border p-2 text-right">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => {
              const calc = lineCalc(line);
              return (
                <tr key={line.id} className="border">
                  <td className="border p-2 text-center">{idx + 1}</td>
                  <td className="border p-2 text-left">{line.description}</td>
                  <td className="border p-2 text-center">{line.hsnSac}</td>
                  <td className="border p-2 text-center">{fmtN(line.quantity)}</td>
                  <td className="border p-2 text-center">{line.unit}</td>
                  <td className="border p-2 text-right">{fmt(line.rate)}</td>
                  <td className="border p-2 text-right">{line.discountPercent > 0 ? `${line.discountPercent}%` : "-"}</td>
                  <td className="border p-2 text-right">{fmt(calc.taxableValue)}</td>
                  <td className="border p-2 text-center">{line.gstPercent}%</td>
                  <td className="border p-2 text-right">{fmt(calc.cgstAmount)}</td>
                  <td className="border p-2 text-right">{fmt(calc.sgstAmount)}</td>
                  <td className="border p-2 text-right">{fmt(calc.igstAmount)}</td>
                  <td className="border p-2 text-right font-semibold">{fmt(calc.totalAmount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totals Section */}
      <div className="mb-6">
        <div className="flex justify-end">
          <div className="w-1/2">
            <table className="w-full text-xs border-collapse">
              <tbody>
                <tr className="border">
                  <td className="border p-2 text-left font-semibold">Subtotal</td>
                  <td className="border p-2 text-right">{fmt(totals.taxableAmount)}</td>
                </tr>
                <tr className="border">
                  <td className="border p-2 text-left">Discount</td>
                  <td className="border p-2 text-right">-</td>
                </tr>
                <tr className="border bg-gray-50">
                  <td className="border p-2 text-left font-semibold">Taxable Amount</td>
                  <td className="border p-2 text-right font-semibold">{fmt(totals.taxableAmount)}</td>
                </tr>
                <tr className="border">
                  <td className="border p-2 text-left">CGST</td>
                  <td className="border p-2 text-right">{fmt(totals.cgst)}</td>
                </tr>
                <tr className="border">
                  <td className="border p-2 text-left">SGST</td>
                  <td className="border p-2 text-right">{fmt(totals.sgst)}</td>
                </tr>
                <tr className="border">
                  <td className="border p-2 text-left">IGST</td>
                  <td className="border p-2 text-right">{fmt(totals.igst)}</td>
                </tr>
                <tr className="border bg-gray-50">
                  <td className="border p-2 text-left font-semibold">Total Tax</td>
                  <td className="border p-2 text-right font-semibold">{fmt(totals.totalTax)}</td>
                </tr>
                <tr className="border">
                  <td className="border p-2 text-left">Round Off</td>
                  <td className="border p-2 text-right">-</td>
                </tr>
                <tr className="border bg-blue-50">
                  <td className="border p-2 text-left font-bold text-blue-800">Grand Total</td>
                  <td className="border p-2 text-right font-bold text-blue-800">{fmt(totals.grandTotal)}</td>
                </tr>
                <tr className="border">
                  <td className="border p-2 text-left">Amount Paid</td>
                  <td className="border p-2 text-right">-</td>
                </tr>
                <tr className="border bg-green-50">
                  <td className="border p-2 text-left font-semibold text-green-800">Balance Due</td>
                  <td className="border p-2 text-right font-semibold text-green-800">{fmt(totals.grandTotal)}</td>
                </tr>
              </tbody>
            </table>
            
            <div className="mt-3 p-3 bg-gray-50 rounded text-xs">
              <p className="font-semibold">Amount in Words:</p>
              <p>{numberToWords(Math.round(totals.grandTotal))}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Details */}
      <div className="mb-6">
        {(() => {
          const hasBankDetails = companyData?.bank_account_name || companyData?.bank_name || 
                                companyData?.bank_account_number_masked || companyData?.ifsc_code;
          const hasUpiDetails = companyData?.upi_id;
          const hasPaymentDetails = hasBankDetails || hasUpiDetails;
          
          if (!hasPaymentDetails) {
            return (
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <h3 className="font-semibold text-sm mb-2">PAYMENT DETAILS</h3>
                <p className="text-xs text-gray-500">Payment details not configured</p>
              </div>
            );
          }
          
          return (
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-sm mb-3">PAYMENT DETAILS</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                {hasBankDetails && (
                  <div>
                    <p className="font-semibold text-xs mb-2 text-gray-700">Bank Transfer</p>
                    {companyData?.bank_account_name && (
                      <p><strong>Account Holder:</strong> {companyData.bank_account_name}</p>
                    )}
                    {companyData?.bank_name && (
                      <p><strong>Bank Name:</strong> {companyData.bank_name}</p>
                    )}
                    {companyData?.bank_branch && (
                      <p><strong>Branch:</strong> {companyData.bank_branch}</p>
                    )}
                    {companyData?.bank_account_number_masked && (
                      <p><strong>Account Number:</strong> {companyData.bank_account_number_masked}</p>
                    )}
                    {companyData?.ifsc_code && (
                      <p><strong>IFSC Code:</strong> {companyData.ifsc_code}</p>
                    )}
                  </div>
                )}
                {hasUpiDetails && (
                  <div>
                    <p className="font-semibold text-xs mb-2 text-gray-700">UPI Payment</p>
                    <p><strong>UPI ID:</strong> {companyData.upi_id}</p>
                    {(companyData?.primary_phone || companyData?.alternate_phone) && (
                      <p className="text-xs text-gray-600 mt-2">
                        UPI apps supported on registered mobile number
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Notes and Terms */}
      <div className="mb-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-sm mb-2">NOTES</h3>
            <div className="text-xs space-y-1">
              <p>{narration || "Thank you for your business!"}</p>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-2">TERMS & CONDITIONS</h3>
            <div className="text-xs space-y-1">
              <p>1. Goods once sold will not be taken back.</p>
              <p>2. Interest @ 18% p.a. will be charged if payment is not made within the stipulated time.</p>
              <p>3. Subject to [City] jurisdiction only.</p>
              <p>4. E. & O.E.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Declaration and Signature */}
      <div className="border-t pt-4 mb-4">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-sm mb-2">DECLARATION</h3>
            <div className="text-xs">
              <p>We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
            </div>
          </div>
          <div className="text-center">
            <div className="h-16 border-b-2 border-gray-300 mb-2"></div>
            <p className="text-xs font-semibold">Authorized Signatory</p>
            <p className="text-xs">{companyData?.trade_name || companyData?.legal_name}</p>
          </div>
        </div>
      </div>
      
      {/* Computer Generated Note */}
      <div className="border-t pt-3 text-center">
        <p className="text-xs text-gray-500 italic">This is a computer generated invoice and does not require a physical signature.</p>
      </div>
    </div>
  );
};

export default function InvoicePreview({
  open,
  onClose,
  onRaiseInvoice,
  invoiceNumber,
  invoiceDate,
  dueDate,
  selectedCustomer,
  companyData,
  contactPerson,
  lines,
  totals,
  narration,
  isInterstate,
  isLoading = false,
}: InvoicePreviewProps) {
  const [selectedStyle, setSelectedStyle] = useState("gst-tax-invoice");

  const handleRaiseInvoice = () => {
    onRaiseInvoice(selectedStyle);
  };

  const handlePrint = () => {
    const printContent = document.getElementById('invoice-content');
    if (printContent) {
      const printWindow = window.open('', '', 'width=210mm,height=297mm');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>TAX INVOICE - ${invoiceNumber}</title>
              <style>
                @media print {
                  @page { 
                    margin: 0.5in;
                    size: A4;
                  }
                  body { 
                    margin: 0;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                  }
                  .no-print { display: none !important; }
                }
                * { box-sizing: border-box; }
                body { 
                  font-family: 'Segoe UI', Arial, sans-serif;
                  font-size: 12px;
                  line-height: 1.4;
                  color: #000;
                }
                table { 
                  border-collapse: collapse;
                  width: 100%;
                  page-break-inside: avoid;
                }
                th, td { 
                  border: 1px solid #333;
                  padding: 8px;
                  text-align: left;
                }
                th { 
                  background-color: #f5f5f5;
                  font-weight: bold;
                }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .font-bold { font-weight: bold; }
                .font-semibold { font-weight: 600; }
                .border { border: 1px solid #333; }
                .border-t { border-top: 1px solid #333; }
                .border-b { border-bottom: 1px solid #333; }
                .border-b-2 { border-bottom: 2px solid #333; }
                .border-b-4 { border-bottom: 4px solid #2563eb; }
                .border-blue-600 { border-color: #2563eb; }
                .border-gray-200 { border-color: #e5e7eb; }
                .border-gray-300 { border-color: #d1d5db; }
                .p-2 { padding: 8px; }
                .p-3 { padding: 12px; }
                .p-4 { padding: 16px; }
                .pt-3 { padding-top: 12px; }
                .pt-4 { padding-top: 16px; }
                .pb-4 { padding-bottom: 16px; }
                .mb-2 { margin-bottom: 8px; }
                .mb-3 { margin-bottom: 12px; }
                .mb-4 { margin-bottom: 16px; }
                .mb-6 { margin-bottom: 24px; }
                .mt-1 { margin-top: 4px; }
                .mt-2 { margin-top: 8px; }
                .mt-3 { margin-top: 12px; }
                .grid { display: grid; }
                .grid-cols-2 { grid-template-columns: 1fr 1fr; gap: 16px; }
                .grid-cols-4 { grid-template-columns: repeat(4, 1fr); gap: 8px; }
                .bg-gray-50 { background-color: #f9fafb; }
                .bg-blue-50 { background-color: #eff6ff; }
                .bg-green-50 { background-color: #f0fdf4; }
                .bg-gray-100 { background-color: #f3f4f6; }
                .bg-blue-600 { background-color: #2563eb; color: white; }
                .text-blue-800 { color: #1e40af; }
                .text-green-800 { color: #166534; }
                .text-gray-500 { color: #6b7280; }
                .text-gray-600 { color: #4b5563; }
                .text-gray-700 { color: #374151; }
                .text-gray-900 { color: #111827; }
                .text-white { color: white; }
                .text-xs { font-size: 11px; }
                .text-sm { font-size: 12px; }
                .text-xl { font-size: 20px; }
                .text-2xl { font-size: 24px; }
                .italic { font-style: italic; }
                .w-full { width: 100%; }
                .w-1/2 { width: 50%; }
                .h-16 { height: 64px; }
                .h-auto { height: auto; }
                .rounded-lg { border-radius: 8px; }
                .flex { display: flex; }
                .flex-1 { flex: 1; }
                .justify-between { justify-content: space-between; }
                .justify-end { justify-content: flex-end; }
                .items-start { align-items: flex-start; }
                .items-center { align-items: center; }
                .gap-4 { gap: 16px; }
                .gap-6 { gap: 24px; }
                .space-y-1 > * + * { margin-top: 4px; }
                .space-y-2 > * + * { margin-top: 8px; }
                strong { font-weight: 600; }
              </style>
            </head>
            <body>
              ${printContent.innerHTML}
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }
    }
  };

  const renderInvoiceContent = () => {
    switch (selectedStyle) {
      case "gst-tax-invoice":
        return (
          <GSTTaxInvoice
            companyData={companyData}
            selectedCustomer={selectedCustomer}
            contactPerson={contactPerson}
            invoiceNumber={invoiceNumber}
            invoiceDate={invoiceDate}
            dueDate={dueDate}
            lines={lines}
            totals={totals}
            narration={narration}
            isInterstate={isInterstate}
          />
        );
      default:
        return (
          <GSTTaxInvoice
            companyData={companyData}
            selectedCustomer={selectedCustomer}
            contactPerson={contactPerson}
            invoiceNumber={invoiceNumber}
            invoiceDate={invoiceDate}
            dueDate={dueDate}
            lines={lines}
            totals={totals}
            narration={narration}
            isInterstate={isInterstate}
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Invoice Preview</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="gap-1"
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="gap-1"
              >
                <Download className="h-4 w-4" />
                PDF
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Style Selection */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <Label className="text-sm font-medium">Invoice Style:</Label>
            <RadioGroup value={selectedStyle} onValueChange={setSelectedStyle} className="flex gap-4">
              {INVOICE_STYLES.map((style) => (
                <div key={style.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={style.id} id={style.id} />
                  <Label htmlFor={style.id} className="text-sm">
                    {style.name}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Invoice Content */}
          <div className="border rounded-lg overflow-hidden">
            {renderInvoiceContent()}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
            <Button
              onClick={handleRaiseInvoice}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Send className="h-4 w-4 mr-2" />
              {isLoading ? "Processing..." : "Issue Invoice"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
