import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Calendar, CreditCard, IndianRupee, FileText, AlertCircle } from 'lucide-react';

const paymentSchema = z.object({
  paymentDate: z.string().min(1, 'Payment date is required'),
  paymentMode: z.enum(['bank', 'cash', 'upi', 'cheque'], {
    required_error: 'Payment mode is required',
  }),
  referenceNumber: z.string().optional(),
  amount: z.number().min(1, 'Amount must be greater than 0'),
  notes: z.string().optional(),
  invoiceIds: z.array(z.string()).min(1, 'Select at least one invoice'),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  outstanding: number;
  isOverdue: boolean;
}

interface RecordPaymentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: {
    id: string;
    name: string;
    invoices: Invoice[];
  };
  onSuccess?: () => void;
}

const PAYMENT_MODES = [
  { value: 'bank', label: 'Bank Transfer', icon: CreditCard },
  { value: 'cash', label: 'Cash', icon: IndianRupee },
  { value: 'upi', label: 'UPI', icon: CreditCard },
  { value: 'cheque', label: 'Cheque', icon: FileText },
];

export default function RecordPayment({ open, onOpenChange, vendor, onSuccess }: RecordPaymentProps) {
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const totalSelectedAmount = vendor.invoices
    .filter(inv => selectedInvoices.includes(inv.id))
    .reduce((sum, inv) => sum + inv.outstanding, 0);

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMode: 'bank',
      amount: totalSelectedAmount,
      invoiceIds: [],
    },
  });

  const watchedAmount = form.watch('amount');
  const watchedPaymentMode = form.watch('paymentMode');

  // Auto-update amount when invoices are selected
  const handleInvoiceToggle = (invoiceId: string) => {
    const newSelection = selectedInvoices.includes(invoiceId)
      ? selectedInvoices.filter(id => id !== invoiceId)
      : [...selectedInvoices, invoiceId];
    
    setSelectedInvoices(newSelection);
    
    const newTotal = vendor.invoices
      .filter(inv => newSelection.includes(inv.id))
      .reduce((sum, inv) => sum + inv.outstanding, 0);
    
    form.setValue('amount', newTotal);
    form.setValue('invoiceIds', newSelection);
  };

  const handleSelectAll = () => {
    if (selectedInvoices.length === vendor.invoices.length) {
      setSelectedInvoices([]);
      form.setValue('amount', 0);
      form.setValue('invoiceIds', []);
    } else {
      const allInvoiceIds = vendor.invoices.map(inv => inv.id);
      setSelectedInvoices(allInvoiceIds);
      const totalOutstanding = vendor.invoices.reduce((sum, inv) => sum + inv.outstanding, 0);
      form.setValue('amount', totalOutstanding);
      form.setValue('invoiceIds', allInvoiceIds);
    }
  };

  const onSubmit = async (data: PaymentFormData) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Payment recorded:', {
        ...data,
        vendorId: vendor.id,
        vendorName: vendor.name,
      });

      toast.success(`Payment of ₹${data.amount.toLocaleString('en-IN')} recorded successfully`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error('Failed to record payment');
    }
  };

  const getReferenceLabel = () => {
    switch (watchedPaymentMode) {
      case 'bank': return 'UTR Number';
      case 'upi': return 'Transaction ID';
      case 'cheque': return 'Cheque Number';
      default: return 'Reference Number';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Record Payment - {vendor.name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Invoice Selection */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Select Invoices to Pay</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedInvoices.length} of {vendor.invoices.length} selected
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {selectedInvoices.length === vendor.invoices.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {vendor.invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedInvoices.includes(invoice.id)
                      ? 'bg-blue-50 border-blue-200'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => handleInvoiceToggle(invoice.id)}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedInvoices.includes(invoice.id)}
                      disabled
                    />
                    <div>
                      <p className="font-medium text-sm">{invoice.invoiceNo}</p>
                      <p className="text-xs text-muted-foreground">
                        Due: {invoice.dueDate}
                        {invoice.isOverdue && (
                          <Badge variant="destructive" className="ml-2 text-xs">
                            Overdue
                          </Badge>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">₹{invoice.outstanding.toLocaleString('en-IN')}</p>
                    <p className="text-xs text-muted-foreground">
                      Total: ₹{invoice.totalAmount.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="flex justify-between items-center">
              <span className="font-semibold">Total Selected Amount:</span>
              <span className="font-bold text-lg">₹{totalSelectedAmount.toLocaleString('en-IN')}</span>
            </div>
          </Card>

          {/* Payment Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-4">Payment Details</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="paymentDate">Payment Date *</Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    {...form.register('paymentDate')}
                  />
                </div>

                <div>
                  <Label htmlFor="paymentMode">Payment Mode *</Label>
                  <Select
                    value={watchedPaymentMode}
                    onValueChange={(value) => form.setValue('paymentMode', value as any)}
                  >
                    <SelectTrigger id="paymentMode">
                      <SelectValue placeholder="Select payment mode" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map((mode) => (
                        <SelectItem key={mode.value} value={mode.value}>
                          <div className="flex items-center gap-2">
                            <mode.icon className="h-4 w-4" />
                            {mode.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="referenceNumber">{getReferenceLabel()}</Label>
                  <Input
                    id="referenceNumber"
                    placeholder={`Enter ${getReferenceLabel().toLowerCase()}`}
                    {...form.register('referenceNumber')}
                  />
                </div>

                <div>
                  <Label htmlFor="amount">Payment Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    {...form.register('amount', { valueAsNumber: true })}
                  />
                  {watchedAmount > totalSelectedAmount && (
                    <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Amount exceeds selected invoices total
                    </p>
                  )}
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Additional Information</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any notes about this payment..."
                    className="min-h-[100px]"
                    {...form.register('notes')}
                  />
                </div>
              </div>
            </Card>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={selectedInvoices.length === 0 || watchedAmount <= 0 || watchedAmount > totalSelectedAmount}
            >
              Record Payment ₹{watchedAmount?.toLocaleString('en-IN') || 0}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
