import { useState, useMemo, useEffect } from "react";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Plus, Trash2, Upload, AlertCircle, Check, Loader2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { getParties } from "@/services/partyService";
import type { Party } from "@/types/party";
import { purchaseService } from "@/services/purchaseService";

// GST Rates
const GST_RATES = [0, 5, 12, 18, 28];

// Validation Schema
const lineItemSchema = z.object({
  id: z.string(),
  description: z.string().min(1, "Description is required"),
  hsnSac: z.string().min(1, "HSN/SAC is required"),
  quantity: z.number().min(0.01, "Quantity must be greater than 0"),
  unit: z.string().min(1, "Unit is required"),
  rate: z.number().min(0, "Rate must be non-negative"),
  discountPercent: z.number().min(0).max(100, "Discount must be between 0-100"),
  gstPercent: z.number().refine(val => GST_RATES.includes(val), {
    message: "Invalid GST rate",
  }),
});

const formSchema = z.object({
  metadata: z.object({
    vendorId: z.string().min(1, "Vendor is required"),
    vendorGstin: z.string().optional(),
    invoiceNumber: z.string().min(1, "Invoice number is required"),
    invoiceDate: z.string().min(1, "Invoice date is required"),
    dueDate: z.string().optional(),
    placeOfSupply: z.string().min(1, "Place of supply is required"),
    reverseCharge: z.boolean(),
    costCenter: z.string().optional(),
    paymentTerms: z.string().optional(),
  }),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
  additionalCharges: z.object({
    freight: z.number().min(0),
    otherCharges: z.number().min(0),
    tds: z.number().min(0),
    roundOff: z.number(),
  }),
  narration: z.string().optional(),
  attachment: z.any().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const createEmptyLineItem = () => ({
  id: Date.now().toString(),
  description: "",
  hsnSac: "",
  quantity: 1,
  unit: "",
  rate: 0,
  discountPercent: 0,
  gstPercent: 18,
});

const createDefaultFormValues = (): FormValues => ({
  metadata: {
    vendorId: "",
    vendorGstin: "",
    invoiceNumber: "",
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: "",
    placeOfSupply: "",
    reverseCharge: false,
    costCenter: "",
    paymentTerms: "",
  },
  lineItems: [createEmptyLineItem()],
  additionalCharges: {
    freight: 0,
    otherCharges: 0,
    tds: 0,
    roundOff: 0,
  },
  narration: "",
  attachment: null,
});

const mapPurchaseToFormValues = (purchase: any): FormValues => ({
  metadata: {
    vendorId: purchase.vendorId || "",
    vendorGstin: purchase.gstin || "",
    invoiceNumber: purchase.invoiceNo || "",
    invoiceDate: purchase.invoiceDate || new Date().toISOString().split('T')[0],
    dueDate: purchase.dueDate || "",
    placeOfSupply: purchase.placeOfSupply || "Maharashtra",
    reverseCharge: false,
    costCenter: purchase.costCenter || "",
    paymentTerms: purchase.paymentTerms || "",
  },
  lineItems: (purchase.lineItems || []).length > 0
    ? purchase.lineItems.map((item: any, index: number) => {
        const grossAmount = (item.qty || 0) * (item.rate || 0);
        const taxableAmount = item.taxableAmount || 0;
        const discountAmount = Math.max(grossAmount - taxableAmount, 0);
        const totalTax = (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0);
        return {
          id: item.id || `${index}`,
          description: item.description || "",
          hsnSac: item.hsn || "",
          quantity: item.qty || 1,
          unit: "Nos",
          rate: item.rate || 0,
          discountPercent: grossAmount > 0 ? Number(((discountAmount / grossAmount) * 100).toFixed(2)) : 0,
          gstPercent: taxableAmount > 0 ? Number(((totalTax / taxableAmount) * 100).toFixed(2)) : 0,
        };
      })
    : [createEmptyLineItem()],
  additionalCharges: {
    freight: 0,
    otherCharges: 0,
    tds: purchase.tdsAmount || 0,
    roundOff: 0,
  },
  narration: purchase.notes || "",
  attachment: null,
});

// Indian states for place of supply (legitimate domain constants)
const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan",
  "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

// Common units for recommendations
const COMMON_UNITS = [
  "Nos", "kg", "liters", "litre", "ltr", "L", "grams", "g", "tonnes", "ton",
  "dozens", "dozen", "pcs", "pieces", "pair", "sets", "box", "boxes",
  "meter", "meters", "m", "sqm", "sq.m", "sq.ft", "feet", "ft", "inch", "inches",
  "hours", "hour", "hrs", "day", "days", "week", "weeks", "month", "months",
  "service", "services", "job", "jobs", "contract", "consultation",
  "pack", "packs", "carton", "cartons", "bundle", "bundles", "lot", "lots",
  "kgm", "kgs", "ml", "milliliters", "millilitre", "gms", "grammes",
  "unit", "units", "item", "items", "each", "ea"
];

// Component: Invoice Metadata Section
interface InvoiceMetadataSectionProps {
  form: any;
  vendors: Party[];
  vendorsLoading: boolean;
  vendorsError: any;
}

function InvoiceMetadataSection({ form, vendors, vendorsLoading, vendorsError }: InvoiceMetadataSectionProps) {
  const selectedVendorId = form.watch("metadata.vendorId");
  const selectedVendor = vendors.find((v: Party) => v.id === selectedVendorId);

  // Auto-fill GSTIN and payment terms when vendor changes
  const handleVendorChange = (vendorId: string) => {
    const vendor = vendors.find((v: Party) => v.id === vendorId);
    if (vendor) {
      form.setValue("metadata.vendorGstin", vendor.gstin || "");
      
      // Auto-fill payment terms based on vendor's payment terms days
      if (vendor.paymentTermsDays) {
        if (vendor.paymentTermsDays === 15) form.setValue("metadata.paymentTerms", "NET 15");
        else if (vendor.paymentTermsDays === 30) form.setValue("metadata.paymentTerms", "NET 30");
        else if (vendor.paymentTermsDays === 45) form.setValue("metadata.paymentTerms", "NET 45");
        else if (vendor.paymentTermsDays === 60) form.setValue("metadata.paymentTerms", "NET 60");
        else if (vendor.paymentTermsDays === 90) form.setValue("metadata.paymentTerms", "NET 90");
        else form.setValue("metadata.paymentTerms", `NET ${vendor.paymentTermsDays}`);
      }
      
      // Auto-calculate due date based on payment terms
      if (vendor.paymentTermsDays && form.getValues("metadata.invoiceDate")) {
        const invoiceDate = new Date(form.getValues("metadata.invoiceDate"));
        const dueDate = new Date(invoiceDate);
        dueDate.setDate(dueDate.getDate() + vendor.paymentTermsDays);
        form.setValue("metadata.dueDate", dueDate.toISOString().split('T')[0]);
      }
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Invoice Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="metadata.vendorId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vendor *</FormLabel>
              <Select onValueChange={(value) => {
                field.onChange(value);
                handleVendorChange(value);
              }} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {vendorsLoading ? (
                    <div className="flex items-center justify-center py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="ml-2 text-sm">Loading vendors...</span>
                    </div>
                  ) : vendorsError ? (
                    <div className="py-2 text-center text-sm text-destructive">
                      Error loading vendors
                    </div>
                  ) : vendors.length === 0 ? (
                    <div className="py-2 text-center text-sm text-muted-foreground">
                      No vendors found. <br />
                      <span className="text-xs">Please create a vendor first</span>
                    </div>
                  ) : (
                    vendors.map((vendor: Party) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        <div className="flex flex-col">
                          <span>{vendor.partyName}</span>
                          {vendor.displayName && vendor.displayName !== vendor.partyName && (
                            <span className="text-xs text-muted-foreground">{vendor.displayName}</span>
                          )}
                          {vendor.gstin && (
                            <span className="text-xs text-muted-foreground">GSTIN: {vendor.gstin}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="metadata.vendorGstin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vendor GSTIN</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Auto-filled" readOnly className="bg-muted" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="metadata.invoiceNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Invoice Number *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Enter invoice number" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="metadata.invoiceDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Invoice Date *</FormLabel>
              <FormControl>
                <Input {...field} type="date" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="metadata.dueDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Due Date</FormLabel>
              <FormControl>
                <Input {...field} type="date" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="metadata.placeOfSupply"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Place of Supply *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select place" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {INDIAN_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="metadata.costCenter"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cost Center</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g., Manufacturing" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="metadata.paymentTerms"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payment Terms</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment terms" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="NET 15">NET 15</SelectItem>
                  <SelectItem value="NET 30">NET 30</SelectItem>
                  <SelectItem value="NET 45">NET 45</SelectItem>
                  <SelectItem value="NET 60">NET 60</SelectItem>
                  <SelectItem value="NET 90">NET 90</SelectItem>
                  <SelectItem value="Advance">Advance</SelectItem>
                  <SelectItem value="COD">COD</SelectItem>
                  <SelectItem value="Others">Others</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="metadata.reverseCharge"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Reverse Charge</FormLabel>
                <div className="text-sm text-muted-foreground">
                  Apply reverse charge mechanism
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </Card>
  );
}

// Component: Unit Select Dropdown
function UnitSelect({ value, onChange, placeholder = "Select unit" }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  const standardUnits = [
    "Nos", "Unit", "Kg", "Gram", "Litre", "Liter", "Meter", "Box", 
    "Pack", "Service", "Day", "Month", "Hour", "Set", "Pair"
  ];

  const handleSelect = (selectedUnit: string) => {
    onChange(selectedUnit);
    setOpen(false);
  };

  return (
    <Select open={open} onOpenChange={setOpen} value={value} onValueChange={handleSelect}>
      <SelectTrigger className="h-10">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-60">
        <div className="max-h-60 overflow-y-auto">
          {standardUnits.map((unit) => (
            <SelectItem key={unit} value={unit}>
              <div className="flex items-center justify-between w-full">
                <span>{unit}</span>
                {unit === value && <Check className="h-3 w-3 text-green-600 ml-2" />}
              </div>
            </SelectItem>
          ))}
        </div>
      </SelectContent>
    </Select>
  );
}

// Component: Line Item Card
function LineItemCard({ form, index, item, onRemove, onDuplicate }: {
  form: any;
  index: number;
  item: any;
  onRemove: (index: number) => void;
  onDuplicate: (index: number) => void;
}) {
  const calculateTaxableValue = (item: any) => {
    const taxable = item.quantity * item.rate;
    const discount = (taxable * item.discountPercent) / 100;
    return taxable - discount;
  };

  const calculateTax = (taxableValue: number, gstPercent: number) => {
    return (taxableValue * gstPercent) / 100;
  };

  const formatCurrency = (value: number) => {
    return `₹${value.toFixed(2)}`;
  };

  const taxableValue = calculateTaxableValue(item);
  const totalGST = calculateTax(taxableValue, item.gstPercent);
  const cgst = item.gstPercent <= 0 ? 0 : totalGST / 2;
  const sgst = item.gstPercent <= 0 ? 0 : totalGST / 2;
  const igst = 0; // Use CGST/SGST by default to avoid database constraint
  const lineTotal = taxableValue + totalGST;

  return (
    <Card className="p-4 mb-4 border-2">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
          <Badge variant="outline" className="text-xs">
            {item.description || 'New Item'}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDuplicate(index)}
            className="h-8 w-8 p-0"
            title="Duplicate item"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(index)}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            title="Remove item"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* First Row: Description, HSN/SAC, Quantity, Unit, Rate */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
        <FormField
          control={form.control}
          name={`lineItems.${index}.description`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">Description *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Enter item description" className="h-10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`lineItems.${index}.hsnSac`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">HSN/SAC *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g., 9983" className="h-10" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`lineItems.${index}.quantity`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">Quantity *</FormLabel>
              <FormControl>
                <Input
                  value={field.value || ""}
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-10 text-center"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || value === "-") {
                      field.onChange(value);
                    } else {
                      const numValue = parseFloat(value);
                      field.onChange(isNaN(numValue) ? 0 : numValue);
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === "" || value === "-") {
                      field.onChange(0);
                    }
                    field.onBlur();
                  }}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`lineItems.${index}.unit`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">Unit *</FormLabel>
              <FormControl>
                <UnitSelect
                  value={field.value || ""}
                  onChange={field.onChange}
                  placeholder="Select unit"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`lineItems.${index}.rate`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium">Rate (₹) *</FormLabel>
              <FormControl>
                <Input
                  value={field.value || ""}
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-10 text-right"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || value === "-") {
                      field.onChange(value);
                    } else {
                      const numValue = parseFloat(value);
                      field.onChange(isNaN(numValue) ? 0 : numValue);
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === "" || value === "-") {
                      field.onChange(0);
                    }
                    field.onBlur();
                  }}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Second Row: Discount, GST, Calculated Values */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <FormField
            control={form.control}
            name={`lineItems.${index}.discountPercent`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium">Discount %</FormLabel>
                <FormControl>
                  <Input
                    value={field.value || ""}
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    className="h-10 text-right"
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || value === "-") {
                        field.onChange(value);
                      } else {
                        const numValue = parseFloat(value);
                        field.onChange(isNaN(numValue) ? 0 : Math.min(100, Math.max(0, numValue)));
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      if (value === "" || value === "-") {
                        field.onChange(0);
                      }
                      field.onBlur();
                    }}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`lineItems.${index}.gstPercent`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium">GST % *</FormLabel>
                <Select onValueChange={(value) => field.onChange(value ? parseInt(value) : 0)} value={field.value?.toString() || ""}>
                  <FormControl>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select GST rate" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {GST_RATES.map((rate) => (
                      <SelectItem key={rate} value={rate.toString()}>
                        {rate}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="bg-muted/30 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-3">Calculated Values</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taxable Value:</span>
              <span className="font-medium">{formatCurrency(taxableValue)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST:</span>
              <span className="font-medium">{formatCurrency(totalGST)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">CGST:</span>
              <span className="font-medium">{formatCurrency(cgst)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">SGST:</span>
              <span className="font-medium">{formatCurrency(sgst)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">IGST:</span>
              <span className="font-medium">{formatCurrency(igst)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-base font-semibold">
              <span>Line Total:</span>
              <span className="text-primary">{formatCurrency(lineTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Component: Line Items Container
function LineItemsContainer({ form }: { form: any }) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lineItems",
  });

  const lineItems = useWatch({ control: form.control, name: "lineItems" });

  const addLineItem = () => {
    const newItem = {
      id: Date.now().toString(),
      description: "",
      hsnSac: "",
      quantity: 1,
      unit: "",
      rate: 0,
      discountPercent: 0,
      gstPercent: 18,
    };
    append(newItem);
  };

  const removeLineItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    } else {
      toast.error("At least one line item is required");
    }
  };

  const duplicateLineItem = (index: number) => {
    const itemToDuplicate = lineItems[index];
    if (itemToDuplicate) {
      const duplicatedItem = {
        ...itemToDuplicate,
        id: Date.now().toString(),
        description: itemToDuplicate.description ? `${itemToDuplicate.description} (Copy)` : "",
      };
      append(duplicatedItem);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Line Items</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add items to your purchase invoice. Each item requires description, HSN/SAC, quantity, unit, and rate.
          </p>
        </div>
        <Button onClick={addLineItem} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Line Item
        </Button>
      </div>

      <div className="space-y-4">
        {fields.map((field, index) => {
          const item = lineItems[index] || {};
          return (
            <LineItemCard
              key={field.id}
              form={form}
              index={index}
              item={item}
              onRemove={removeLineItem}
              onDuplicate={duplicateLineItem}
            />
          );
        })}
      </div>

      {fields.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-muted-foreground/25 rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">No line items added</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Add Line Item" to start building your invoice
              </p>
            </div>
            <Button onClick={addLineItem} size="sm" variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Add First Line Item
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function AdditionalChargesSection({ form }: { form: any }) {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Additional Charges</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FormField
          control={form.control}
          name="additionalCharges.freight"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Freight</FormLabel>
              <FormControl>
                <Input
                  value={field.value || ""}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || value === "-") {
                      field.onChange(value);
                    } else {
                      const numValue = parseFloat(value);
                      field.onChange(isNaN(numValue) ? 0 : numValue);
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === "" || value === "-") {
                      field.onChange(0);
                    }
                    field.onBlur();
                  }}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="additionalCharges.otherCharges"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Other Charges</FormLabel>
              <FormControl>
                <Input
                  value={field.value || ""}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || value === "-") {
                      field.onChange(value);
                    } else {
                      const numValue = parseFloat(value);
                      field.onChange(isNaN(numValue) ? 0 : numValue);
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === "" || value === "-") {
                      field.onChange(0);
                    }
                    field.onBlur();
                  }}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="additionalCharges.tds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>TDS</FormLabel>
              <FormControl>
                <Input
                  value={field.value || ""}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || value === "-") {
                      field.onChange(value);
                    } else {
                      const numValue = parseFloat(value);
                      field.onChange(isNaN(numValue) ? 0 : numValue);
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === "" || value === "-") {
                      field.onChange(0);
                    }
                    field.onBlur();
                  }}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="additionalCharges.roundOff"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Round Off</FormLabel>
              <FormControl>
                <Input
                  value={field.value || ""}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || value === "-") {
                      field.onChange(value);
                    } else {
                      const numValue = parseFloat(value);
                      field.onChange(isNaN(numValue) ? 0 : numValue);
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === "" || value === "-") {
                      field.onChange(0);
                    }
                    field.onBlur();
                  }}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </Card>
  );
}

// Component: Summary Card
function SummaryCard({ form }: { form: any }) {
  const lineItems = useWatch({ control: form.control, name: "lineItems" });
  const additionalCharges = useWatch({ control: form.control, name: "additionalCharges" });

  const summary = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    lineItems.forEach((item: any) => {
      const taxable = item.quantity * item.rate;
      const discount = (taxable * item.discountPercent) / 100;
      const taxableValue = taxable - discount;
      const totalGST = (taxableValue * item.gstPercent) / 100;

      subtotal += taxable;
      totalDiscount += discount;
      
      if (item.gstPercent <= 0) {
        cgstTotal += 0;
        sgstTotal += 0;
        igstTotal += 0;
      } else {
        cgstTotal += totalGST / 2;
        sgstTotal += totalGST / 2;
        igstTotal += 0; // Use CGST/SGST by default to avoid database constraint
      }
    });

    const grandTotal = (subtotal - totalDiscount) + cgstTotal + sgstTotal + igstTotal + 
                      additionalCharges.freight + additionalCharges.otherCharges - 
                      additionalCharges.tds + additionalCharges.roundOff;

    return {
      subtotal,
      totalDiscount,
      cgstTotal,
      sgstTotal,
      igstTotal,
      grandTotal,
    };
  }, [lineItems, additionalCharges]);

  const formatCurrency = (value: number) => {
    return `₹${value.toFixed(2)}`;
  };

  return (
    <Card className="p-6 sticky top-6">
      <h3 className="text-lg font-semibold mb-4">Invoice Summary</h3>
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">{formatCurrency(summary.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total Discount</span>
          <span className="font-medium text-destructive">
            -{formatCurrency(summary.totalDiscount)}
          </span>
        </div>
        <Separator />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">CGST Total</span>
          <span className="font-medium">{formatCurrency(summary.cgstTotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">SGST Total</span>
          <span className="font-medium">{formatCurrency(summary.sgstTotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">IGST Total</span>
          <span className="font-medium">{formatCurrency(summary.igstTotal)}</span>
        </div>
        <Separator />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Freight</span>
          <span className="font-medium">{formatCurrency(additionalCharges.freight)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Other Charges</span>
          <span className="font-medium">{formatCurrency(additionalCharges.otherCharges)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">TDS</span>
          <span className="font-medium text-destructive">
            -{formatCurrency(additionalCharges.tds)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Round Off</span>
          <span className="font-medium">{formatCurrency(additionalCharges.roundOff)}</span>
        </div>
        <Separator />
        <div className="flex justify-between">
          <span className="text-lg font-semibold">Grand Total</span>
          <span className="text-lg font-bold text-primary">
            {formatCurrency(summary.grandTotal)}
          </span>
        </div>
      </div>
    </Card>
  );
}

// Component: Narration Section
function NarrationSection({ form }: { form: any }) {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Narration & Attachments</h3>
      <div className="space-y-4">
        <FormField
          control={form.control}
          name="narration"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Narration</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Enter any additional notes or remarks..."
                  rows={4}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
          <div className="flex flex-col items-center space-y-2 text-center">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              <Button variant="ghost" className="text-primary underline">
                Click to upload
              </Button>{" "}
              or drag and drop
            </div>
            <div className="text-xs text-muted-foreground">
              PDF, JPG, PNG up to 10MB
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Main Component
export default function ManualPurchaseEntry() {
  const navigate = useNavigate();
  const { id: purchaseId } = useParams<{ id: string }>();
  const isEditMode = !!purchaseId;
  
  // Fetch vendors from backend
  const { data: vendors = [], isLoading: vendorsLoading, error: vendorsError } = useQuery({
    queryKey: ['vendors', 'supplier'],
    queryFn: () => getParties({ partyType: 'supplier' })
  });

  const { data: existingPurchase, isLoading: purchaseLoading, error: purchaseError } = useQuery({
    queryKey: ['purchase-edit', purchaseId],
    queryFn: () => purchaseService.getPurchaseInvoice(purchaseId!),
    enabled: isEditMode,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: createDefaultFormValues(),
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (existingPurchase) {
      form.reset(mapPurchaseToFormValues(existingPurchase));
    }
  }, [existingPurchase, form]);

  if (isEditMode && purchaseLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Edit Purchase Entry" description="Loading purchase invoice..." />
        <Card className="p-6">Loading purchase invoice...</Card>
      </div>
    );
  }

  if (isEditMode && purchaseError) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Edit Purchase Entry" description="Unable to load purchase invoice" />
        <Card className="p-6 space-y-4">
          <div className="text-sm text-destructive">{purchaseError instanceof Error ? purchaseError.message : "Failed to load purchase invoice"}</div>
          <Button variant="outline" onClick={() => navigate('/app/purchases/register')}>Back to Register</Button>
        </Card>
      </div>
    );
  }

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      // Calculate totals for each line item
      const lineItems = data.lineItems.map((item, index) => {
        const grossAmount = item.quantity * item.rate;
        const discountAmount = grossAmount * (item.discountPercent / 100);
        const taxableValue = grossAmount - discountAmount;
        const totalGST = (taxableValue * item.gstPercent) / 100;
        
        // GST logic: Use IGST for inter-state, CGST/SGST for intra-state
        // For now, default to CGST/SGST (intra-state)
        const cgstRate = item.gstPercent > 0 ? item.gstPercent / 2 : 0;
        const sgstRate = item.gstPercent > 0 ? item.gstPercent / 2 : 0;
        const cgstAmount = item.gstPercent > 0 ? totalGST / 2 : 0;
        const sgstAmount = item.gstPercent > 0 ? totalGST / 2 : 0;
        const igstRate = 0;
        const igstAmount = 0;
        const lineTotal = taxableValue + totalGST;

        return {
          line_number: index + 1,
          description: item.description,
          hsn_sac_code: item.hsnSac,
          quantity: item.quantity,
          rate: item.rate,
          discount_pct: item.discountPercent,
          discount_amount: discountAmount,
          taxable_amount: taxableValue,
          cgst_rate: cgstRate,
          cgst_amount: cgstAmount,
          sgst_rate: sgstRate,
          sgst_amount: sgstAmount,
          igst_rate: igstRate,
          igst_amount: igstAmount,
          cess_rate: 0,
          cess_amount: 0,
          line_total: lineTotal
        };
      });

      // Calculate invoice totals
      const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
      const discountAmount = lineItems.reduce((sum, item) => sum + item.discount_amount, 0);
      const taxableAmount = lineItems.reduce((sum, item) => sum + item.taxable_amount, 0);
      const cgstAmount = lineItems.reduce((sum, item) => sum + item.cgst_amount, 0);
      const sgstAmount = lineItems.reduce((sum, item) => sum + item.sgst_amount, 0);
      const igstAmount = lineItems.reduce((sum, item) => sum + item.igst_amount, 0);
      const cessAmount = 0;
      const tdsAmount = data.additionalCharges.tds;
      const roundOff = data.additionalCharges.roundOff;
      
      const totalAmount = taxableAmount + cgstAmount + sgstAmount + igstAmount + cessAmount - tdsAmount + roundOff;

      // Transform form data to match backend PurchaseCreate schema
      const purchaseData = {
        party_id: data.metadata.vendorId,
        voucher_number: data.metadata.invoiceNumber,
        voucher_date: data.metadata.invoiceDate,
        ref_number: data.metadata.invoiceNumber,
        ref_date: data.metadata.dueDate || data.metadata.invoiceDate,
        items: lineItems,
        subtotal: subtotal,
        discount_amount: discountAmount,
        taxable_amount: taxableAmount,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        igst_amount: igstAmount,
        cess_amount: cessAmount,
        tds_amount: tdsAmount,
        round_off: roundOff,
        total_amount: totalAmount,
        supply_type: 'B2B',
        place_of_supply: data.metadata.placeOfSupply,
        reverse_charge: data.metadata.reverseCharge,
        notes: data.narration || undefined,
        terms_and_conditions: undefined
      };

      // Get vendor name for success message
      const selectedVendor = vendors.find(v => v.id === data.metadata.vendorId);
      const vendorName = selectedVendor?.partyName || selectedVendor?.displayName || 'Unknown Vendor';

      if (isEditMode && purchaseId) {
        await purchaseService.updatePurchaseInvoice(purchaseId, purchaseData as any);
        toast.success("Purchase invoice updated successfully", {
          description: `Invoice ${data.metadata.invoiceNumber} from ${vendorName} has been updated.`,
          duration: 5000,
        });
        setTimeout(() => {
          navigate(`/app/purchases/${purchaseId}`);
        }, 1200);
      } else {
        await purchaseService.createPurchaseInvoice(purchaseData as any);
        toast.success("Purchase invoice created successfully", {
          description: `Invoice ${data.metadata.invoiceNumber} from ${vendorName} has been recorded.`,
          duration: 5000,
        });
        setTimeout(() => {
          navigate('/app/purchases/register');
        }, 1500);
      }
      
    } catch (error) {
      console.error('Error saving purchase invoice:', error);
      toast.error(isEditMode ? "Failed to update purchase invoice" : "Failed to create purchase invoice", {
        description: error instanceof Error ? error.message : "An unexpected error occurred. Please check all required fields.",
        duration: 7000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const lineItems = form.watch("lineItems");
  const hasValidLineItems = lineItems.some(item => 
    item.description && 
    item.description.trim() !== "" &&
    item.hsnSac && 
    item.hsnSac.trim() !== "" &&
    item.quantity >= 0.01 && 
    item.rate > 0 && 
    item.unit && item.unit.trim() !== ""
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader 
        title={isEditMode ? "Edit Purchase Entry" : "Manual Purchase Entry"}
        description={isEditMode ? "Update an existing purchase invoice with detailed line items" : "Create a GST-compliant purchase invoice with detailed line items"}
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <InvoiceMetadataSection 
                form={form} 
                vendors={vendors} 
                vendorsLoading={vendorsLoading} 
                vendorsError={vendorsError} 
              />
              <LineItemsContainer form={form} />
              <AdditionalChargesSection form={form} />
              <NarrationSection form={form} />
            </div>
            
            <div className="space-y-6">
              <SummaryCard form={form} />
              
              <Card className="p-6">
                <div className="space-y-3">
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={!hasValidLineItems || isSubmitting || vendors.length === 0 || purchaseLoading}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        {isEditMode ? "Updating Invoice..." : "Creating Invoice..."}
                      </>
                    ) : (
                      isEditMode ? "Update Invoice" : "Create Invoice"
                    )}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full"
                    onClick={() => form.reset(isEditMode && existingPurchase ? mapPurchaseToFormValues(existingPurchase) : createDefaultFormValues())}
                  >
                    {isEditMode ? "Reset Changes" : "Clear Form"}
                  </Button>
                </div>
                
                {(!hasValidLineItems || vendors.length === 0) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
                    <AlertCircle className="h-4 w-4" />
                    {vendors.length === 0 
                      ? "Please create vendors first to proceed" 
                      : "Add at least one valid line item to proceed"
                    }
                  </div>
                )}
              </Card>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
