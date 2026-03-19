import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface CompanyProfileStepProps {
  data: {
    address_line_1: string;
    address_line_2: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    pan: string;
    gstin: string;
    cin: string;
    tan: string;
    billing_email: string;
    support_email: string;
    website: string;
    financial_year_start_month: number;
    invoice_prefix: string;
  };
  onChange: (field: string, value: string | number) => void;
  errors: Record<string, string>;
  onClearError: (field: string) => void;
}

export function CompanyProfileStep({ data, onChange, errors, onClearError }: CompanyProfileStepProps) {
  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value;
    onChange(field, value);
    if (errors[field]) {
      onClearError(field);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Company Profile</h2>
        <p className="text-muted-foreground">Additional details about your company</p>
      </div>

      {errors.submit && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errors.submit}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address_line_1">Address Line 1</Label>
          <Input
            id="address_line_1"
            type="text"
            placeholder="123 Main Street"
            value={data.address_line_1}
            onChange={handleChange('address_line_1')}
            aria-invalid={!!errors.address_line_1}
            aria-describedby="address_line_1-error"
          />
          {errors.address_line_1 && (
            <p id="address_line_1-error" className="text-sm text-destructive">{errors.address_line_1}</p>
          )}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address_line_2">Address Line 2</Label>
          <Input
            id="address_line_2"
            type="text"
            placeholder="Suite 456, Building Block"
            value={data.address_line_2}
            onChange={handleChange('address_line_2')}
            aria-invalid={!!errors.address_line_2}
            aria-describedby="address_line_2-error"
          />
          {errors.address_line_2 && (
            <p id="address_line_2-error" className="text-sm text-destructive">{errors.address_line_2}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            type="text"
            placeholder="Mumbai"
            value={data.city}
            onChange={handleChange('city')}
            aria-invalid={!!errors.city}
            aria-describedby="city-error"
          />
          {errors.city && (
            <p id="city-error" className="text-sm text-destructive">{errors.city}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input
            id="state"
            type="text"
            placeholder="Maharashtra"
            value={data.state}
            onChange={handleChange('state')}
            aria-invalid={!!errors.state}
            aria-describedby="state-error"
          />
          {errors.state && (
            <p id="state-error" className="text-sm text-destructive">{errors.state}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="postal_code">Postal Code</Label>
          <Input
            id="postal_code"
            type="text"
            placeholder="400001"
            value={data.postal_code}
            onChange={handleChange('postal_code')}
            aria-invalid={!!errors.postal_code}
            aria-describedby="postal_code-error"
          />
          {errors.postal_code && (
            <p id="postal_code-error" className="text-sm text-destructive">{errors.postal_code}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            type="text"
            placeholder="India"
            value={data.country}
            onChange={handleChange('country')}
            aria-invalid={!!errors.country}
            aria-describedby="country-error"
          />
          {errors.country && (
            <p id="country-error" className="text-sm text-destructive">{errors.country}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="pan">PAN</Label>
          <Input
            id="pan"
            type="text"
            placeholder="AAAPL1234C"
            value={data.pan}
            onChange={handleChange('pan')}
            className="uppercase"
            aria-invalid={!!errors.pan}
            aria-describedby="pan-error"
          />
          {errors.pan && (
            <p id="pan-error" className="text-sm text-destructive">{errors.pan}</p>
          )}
          <p className="text-xs text-muted-foreground">Format: AAAPL1234C</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="gstin">GSTIN</Label>
          <Input
            id="gstin"
            type="text"
            placeholder="Enter GSTIN (optional)"
            value={data.gstin}
            onChange={handleChange('gstin')}
            aria-invalid={!!errors.gstin}
            aria-describedby="gstin-error"
          />
          {errors.gstin && (
            <p id="gstin-error" className="text-sm text-destructive">{errors.gstin}</p>
          )}
          <p className="text-xs text-muted-foreground">GSTIN is optional - enter any value or leave blank</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cin">CIN</Label>
          <Input
            id="cin"
            type="text"
            placeholder="U72900MH2019PTC123456"
            value={data.cin}
            onChange={handleChange('cin')}
            className="uppercase"
            aria-invalid={!!errors.cin}
            aria-describedby="cin-error"
          />
          {errors.cin && (
            <p id="cin-error" className="text-sm text-destructive">{errors.cin}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tan">TAN</Label>
          <Input
            id="tan"
            type="text"
            placeholder="MUMA12345A"
            value={data.tan}
            onChange={handleChange('tan')}
            className="uppercase"
            aria-invalid={!!errors.tan}
            aria-describedby="tan-error"
          />
          {errors.tan && (
            <p id="tan-error" className="text-sm text-destructive">{errors.tan}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="billing_email">Billing Email</Label>
          <Input
            id="billing_email"
            type="email"
            placeholder="billing@company.com"
            value={data.billing_email}
            onChange={handleChange('billing_email')}
            aria-invalid={!!errors.billing_email}
            aria-describedby="billing_email-error"
          />
          {errors.billing_email && (
            <p id="billing_email-error" className="text-sm text-destructive">{errors.billing_email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="support_email">Support Email</Label>
          <Input
            id="support_email"
            type="email"
            placeholder="support@company.com"
            value={data.support_email}
            onChange={handleChange('support_email')}
            aria-invalid={!!errors.support_email}
            aria-describedby="support_email-error"
          />
          {errors.support_email && (
            <p id="support_email-error" className="text-sm text-destructive">{errors.support_email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            type="url"
            placeholder="https://company.com"
            value={data.website}
            onChange={handleChange('website')}
            aria-invalid={!!errors.website}
            aria-describedby="website-error"
          />
          {errors.website && (
            <p id="website-error" className="text-sm text-destructive">{errors.website}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="financial_year_start_month">Financial Year Start Month</Label>
          <Input
            id="financial_year_start_month"
            type="number"
            min="1"
            max="12"
            value={data.financial_year_start_month}
            onChange={handleChange('financial_year_start_month')}
            aria-invalid={!!errors.financial_year_start_month}
            aria-describedby="financial_year_start_month-error"
          />
          {errors.financial_year_start_month && (
            <p id="financial_year_start_month-error" className="text-sm text-destructive">{errors.financial_year_start_month}</p>
          )}
          <p className="text-xs text-muted-foreground">1-12 (January=1, April=4, etc.)</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="invoice_prefix">Invoice Prefix</Label>
          <Input
            id="invoice_prefix"
            type="text"
            placeholder="INV"
            value={data.invoice_prefix}
            onChange={handleChange('invoice_prefix')}
            aria-invalid={!!errors.invoice_prefix}
            aria-describedby="invoice_prefix-error"
          />
          {errors.invoice_prefix && (
            <p id="invoice_prefix-error" className="text-sm text-destructive">{errors.invoice_prefix}</p>
          )}
          <p className="text-xs text-muted-foreground">Prefix for invoice numbers (e.g., INV-001)</p>
        </div>
      </div>
    </div>
  );
}
