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
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Calendar, CreditCard, IndianRupee, FileText, Upload, X, AlertCircle } from 'lucide-react';
import { paymentService, PaymentCreateData } from '@/services/paymentService';

const paymentSchema = z.object({
  payment_date: z.string().min(1, 'Payment date is required'),
  payment_mode: z.enum(['bank', 'cash', 'upi', 'cheque'], {
    required_error: 'Payment mode is required',
  }),
  amount: z.number().min(1, 'Amount must be greater than 0'),
  reference_number: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface Invoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
}

interface RecordPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  onSuccess?: () => void;
}

const PAYMENT_MODES = [
  { value: 'bank', label: 'Bank Transfer', icon: CreditCard },
  { value: 'cash', label: 'Cash', icon: IndianRupee },
  { value: 'upi', label: 'UPI', icon: CreditCard },
  { value: 'cheque', label: 'Cheque', icon: FileText },
];

const ALLOWED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default function RecordPaymentModal({ open, onOpenChange, invoice, onSuccess }: RecordPaymentModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      payment_date: new Date().toISOString().split('T')[0],
      payment_mode: 'bank',
      amount: invoice.outstanding,
      reference_number: undefined,
      notes: undefined,
    },
  });

  const watchedAmount = form.watch('amount');
  const watchedPaymentMode = form.watch('payment_mode');

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast.error('Invalid file type. Please upload PNG, JPEG, WebP, or PDF files only.');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size exceeds 10MB limit.');
      return;
    }

    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  const onSubmit = async (data: PaymentFormData) => {
    if (data.amount > invoice.outstanding) {
      toast.error(`Payment amount (${data.amount}) exceeds outstanding amount (${invoice.outstanding})`);
      return;
    }

    setIsSubmitting(true);

    try {
      const paymentData: PaymentCreateData = {
        payment_date: data.payment_date,
        payment_mode: data.payment_mode,
        amount: data.amount,
        reference_number: data.reference_number,
        notes: data.notes,
        sales_invoice_id: invoice.id,
        proof_file: selectedFile || undefined,
      };

      await paymentService.recordPayment(paymentData);
      
      toast.success('Payment recorded successfully!');
      onSuccess?.();
      onOpenChange(false);
      
      // Reset form
      form.reset();
      setSelectedFile(null);
      
    } catch (error: any) {
      console.error('Error recording payment:', error);
      toast.error(error?.detail || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Record Payment
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Invoice Details */}
          <Card className="p-3 bg-muted/30">
            <div className="text-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Invoice {invoice.invoice_number}</span>
                <Badge variant="outline">Outstanding</Badge>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Total Amount:</span>
                <span>₹{invoice.total_amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Already Paid:</span>
                <span>₹{invoice.paid_amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm font-medium text-emerald-600 pt-1 border-t">
                <span>Outstanding:</span>
                <span>₹{invoice.outstanding.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </Card>

          {/* Payment Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="payment_date">Payment Date *</Label>
              <Input
                id="payment_date"
                type="date"
                {...form.register('payment_date')}
                className="mt-1"
              />
              {form.formState.errors.payment_date && (
                <p className="text-xs text-red-600 mt-1">{form.formState.errors.payment_date.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="payment_mode">Payment Mode *</Label>
              <Select
                value={watchedPaymentMode}
                onValueChange={(value) => form.setValue('payment_mode', value as any)}
              >
                <SelectTrigger id="payment_mode" className="mt-1">
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
              {form.formState.errors.payment_mode && (
                <p className="text-xs text-red-600 mt-1">{form.formState.errors.payment_mode.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...form.register('amount', { valueAsNumber: true })}
              className="mt-1"
            />
            {form.formState.errors.amount && (
              <p className="text-xs text-red-600 mt-1">{form.formState.errors.amount.message}</p>
            )}
            {watchedAmount > invoice.outstanding && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Amount exceeds outstanding balance
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="reference_number">Reference Number</Label>
            <Input
              id="reference_number"
              placeholder="Transaction ID, cheque number, etc."
              {...form.register('reference_number')}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional payment details..."
              {...form.register('notes')}
              className="mt-1"
              rows={2}
            />
          </div>

          {/* File Upload */}
          <div>
            <Label>Proof of Payment</Label>
            <div className="mt-1">
              {selectedFile ? (
                <Card className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span>{selectedFile.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveFile}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              ) : (
                <div>
                  <input
                    type="file"
                    id="proof_file"
                    accept={ALLOWED_FILE_TYPES.join(',')}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label htmlFor="proof_file">
                    <Card className="p-4 border-dashed border-2 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="h-8 w-8" />
                        <div className="text-sm text-center">
                          <p>Click to upload proof of payment</p>
                          <p className="text-xs">PNG, JPEG, WebP, PDF (max 10MB)</p>
                        </div>
                      </div>
                    </Card>
                  </label>
                </div>
              )}
            </div>
          </div>

          <Separator />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || watchedAmount > invoice.outstanding}
            >
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
