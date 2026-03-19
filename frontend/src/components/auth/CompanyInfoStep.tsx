import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface CompanyInfoStepProps {
  data: {
    legal_name: string;
    trade_name: string;
    display_name: string;
    primary_email: string;
    primary_phone: string;
  };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
  onClearError: (field: string) => void;
}

export function CompanyInfoStep({ data, onChange, errors, onClearError }: CompanyInfoStepProps) {
  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onChange(field, value);
    if (errors[field]) {
      onClearError(field);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Company Information</h2>
        <p className="text-muted-foreground">Let's start with your company details</p>
      </div>

      {errors.submit && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errors.submit}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="legal_name">Legal Name *</Label>
          <Input
            id="legal_name"
            type="text"
            placeholder="ABC Company Pvt Ltd"
            value={data.legal_name}
            onChange={handleChange('legal_name')}
            required
            aria-invalid={!!errors.legal_name}
            aria-describedby="legal_name-error"
          />
          {errors.legal_name && (
            <p id="legal_name-error" className="text-sm text-destructive">{errors.legal_name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="trade_name">Trade Name</Label>
          <Input
            id="trade_name"
            type="text"
            placeholder="ABC Company"
            value={data.trade_name}
            onChange={handleChange('trade_name')}
            aria-invalid={!!errors.trade_name}
            aria-describedby="trade_name-error"
          />
          {errors.trade_name && (
            <p id="trade_name-error" className="text-sm text-destructive">{errors.trade_name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="display_name">Display Name</Label>
          <Input
            id="display_name"
            type="text"
            placeholder="ABC Company"
            value={data.display_name}
            onChange={handleChange('display_name')}
            aria-invalid={!!errors.display_name}
            aria-describedby="display_name-error"
          />
          {errors.display_name && (
            <p id="display_name-error" className="text-sm text-destructive">{errors.display_name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="primary_email">Primary Email *</Label>
          <Input
            id="primary_email"
            type="email"
            placeholder="contact@company.com"
            value={data.primary_email}
            onChange={handleChange('primary_email')}
            required
            aria-invalid={!!errors.primary_email}
            aria-describedby="primary_email-error"
          />
          {errors.primary_email && (
            <p id="primary_email-error" className="text-sm text-destructive">{errors.primary_email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="primary_phone">Primary Phone</Label>
          <Input
            id="primary_phone"
            type="tel"
            placeholder="+91 98765 43210"
            value={data.primary_phone}
            onChange={handleChange('primary_phone')}
            aria-invalid={!!errors.primary_phone}
            aria-describedby="primary_phone-error"
          />
          {errors.primary_phone && (
            <p id="primary_phone-error" className="text-sm text-destructive">{errors.primary_phone}</p>
          )}
        </div>
      </div>

      <div className="bg-muted/50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Company Code</h3>
        <p className="text-sm text-muted-foreground">
          A unique company code will be automatically generated for you. 
          You'll use this code along with your username to login to your account.
        </p>
      </div>
    </div>
  );
}
