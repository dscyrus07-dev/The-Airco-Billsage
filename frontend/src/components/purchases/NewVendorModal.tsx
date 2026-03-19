import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { partyCreateSchema } from '@/schemas/partySchemas';
import { createParty } from '@/services/partyService';
import type { PartyCreateInput } from '@/types/party';

interface PrefillPartyData {
  party_type?: string;
  party_name?: string;
  display_name?: string;
  party_category?: string;
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
  alternate_phone?: string;
  website?: string;
  address?: string;
  state?: string;
  pin_code?: string;
  notes?: string;
}

interface NewVendorModalProps {
  open: boolean;
  onClose: () => void;
  onVendorCreated: (partyId: string, partyData: any) => void;
  prefillData?: PrefillPartyData;
  vendorName?: string;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

/**
 * Sanitize and normalize website URL
 * Returns empty string if invalid, normalized URL if valid
 */
function sanitizeWebsite(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') {
    return '';
  }
  
  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }
  
  // Try to normalize common patterns
  let normalized = trimmed;
  
  // Add protocol if missing
  if (!normalized.match(/^https?:\/\//i)) {
    normalized = `https://${normalized}`;
  }
  
  // Validate URL format
  try {
    new URL(normalized);
    return normalized;
  } catch {
    // Invalid URL - return empty string to avoid validation error
    console.warn('Invalid website URL extracted, clearing:', url);
    return '';
  }
}

export default function NewVendorModal({
  open,
  onClose,
  onVendorCreated,
  prefillData,
  vendorName
}: NewVendorModalProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<PartyCreateInput>({
    resolver: zodResolver(partyCreateSchema),
    defaultValues: {
      partyName: '',
      displayName: '',
      partyCode: '',
      partyType: 'supplier',
      partyCategory: 'business',
      gstin: '',
      pan: '',
      cin: '',
      tan: '',
      email: '',
      phone: '',
      alternatePhone: '',
      website: '',
      address: '',
      state: '',
      pinCode: '',
      creditLimit: 0,
      paymentTermsDays: 0,
      openingBalance: 0,
      openingBalanceType: 'dr',
      notes: '',
      status: 'active'
    }
  });

  // Reset form with prefill data when it becomes available or modal opens
  useEffect(() => {
    if (open && prefillData) {
      console.log('🔄 Resetting form with prefill data:', prefillData);
      
      // Sanitize website to prevent validation errors from invalid extracted URLs
      const sanitizedWebsite = sanitizeWebsite(prefillData.website);
      if (prefillData.website && !sanitizedWebsite) {
        console.log('⚠️ Cleared invalid extracted website:', prefillData.website);
      }
      
      form.reset({
        partyName: prefillData.party_name || '',
        displayName: prefillData.display_name || prefillData.party_name || '',
        partyCode: '',
        partyType: 'supplier',
        partyCategory: (prefillData.party_category as 'business' | 'individual') || 'business',
        gstin: prefillData.gstin || '',
        pan: prefillData.pan || '',
        cin: '',
        tan: '',
        email: prefillData.email || '',
        phone: prefillData.phone || '',
        alternatePhone: prefillData.alternate_phone || '',
        website: sanitizedWebsite,
        address: prefillData.address || '',
        state: prefillData.state || '',
        pinCode: prefillData.pin_code || '',
        creditLimit: 0,
        paymentTermsDays: 0,
        openingBalance: 0,
        openingBalanceType: 'dr',
        notes: prefillData.notes || '',
        status: 'active'
      });
    } else if (open && !prefillData) {
      console.log('⚠️ Modal opened but no prefill data available');
    }
  }, [open, prefillData, form]);

  const onSubmit = async (data: PartyCreateInput) => {
    setIsCreating(true);
    setError(null);

    try {
      const createdParty = await createParty(data);
      
      toast.success('Supplier created successfully');
      
      // Pass the created party back to parent
      onVendorCreated(createdParty.id, createdParty);
      
      // Close modal
      onClose();
    } catch (err: any) {
      console.error('Failed to create supplier:', err);
      
      // Handle duplicate GSTIN/PAN errors
      if (err.response?.status === 409 || err.message?.includes('duplicate') || err.message?.includes('already exists')) {
        setError('A supplier with this GSTIN or PAN already exists. Please check existing suppliers or use different details.');
      } else {
        setError(err.message || 'Failed to create supplier. Please try again.');
      }
      
      toast.error('Failed to create supplier');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    if (!isCreating) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <DialogTitle>New Vendor Found</DialogTitle>
          </div>
          <DialogDescription>
            No existing supplier match was found for <strong>{vendorName || 'this vendor'}</strong>. 
            Please review the extracted details and create a new supplier.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Basic Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="partyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter supplier name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter display name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="partyCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="business">Business</SelectItem>
                        <SelectItem value="individual">Individual</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* GST & Tax Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">GST & Tax Details</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="gstin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GSTIN</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="27AAAPL1234C1ZV" maxLength={15} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PAN</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="AAAPL1234C" maxLength={10} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Contact Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="supplier@example.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+91 98765 43210" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://example.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Address</h3>
              
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Enter full address" rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select state" />
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
                  name="pinCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PIN Code</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="400001" maxLength={6} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Additional notes" rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Supplier
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
