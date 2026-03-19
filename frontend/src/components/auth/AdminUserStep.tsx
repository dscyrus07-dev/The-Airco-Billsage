import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';

interface AdminUserStepProps {
  data: {
    full_name: string;
    username: string;
    email: string;
    phone: string;
    password: string;
    confirm_password: string;
    role: string;
  };
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
  onClearError: (field: string) => void;
}

export function AdminUserStep({ data, onChange, errors, onClearError }: AdminUserStepProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
        <h2 className="text-2xl font-bold">Admin Account</h2>
        <p className="text-muted-foreground">Create the primary admin user for your company</p>
      </div>

      {errors.submit && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errors.submit}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full Name *</Label>
          <Input
            id="full_name"
            type="text"
            placeholder="John Doe"
            value={data.full_name}
            onChange={handleChange('full_name')}
            required
            aria-invalid={!!errors.full_name}
            aria-describedby="full_name-error"
          />
          {errors.full_name && (
            <p id="full_name-error" className="text-sm text-destructive">{errors.full_name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username *</Label>
          <Input
            id="username"
            type="text"
            placeholder="johndoe"
            value={data.username}
            onChange={handleChange('username')}
            required
            aria-invalid={!!errors.username}
            aria-describedby="username-error"
          />
          {errors.username && (
            <p id="username-error" className="text-sm text-destructive">{errors.username}</p>
          )}
          <p className="text-xs text-muted-foreground">
            This will be used for login along with company code
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            placeholder="admin@company.com"
            value={data.email}
            onChange={handleChange('email')}
            required
            aria-invalid={!!errors.email}
            aria-describedby="email-error"
          />
          {errors.email && (
            <p id="email-error" className="text-sm text-destructive">{errors.email}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+91 98765 43210"
            value={data.phone}
            onChange={handleChange('phone')}
            aria-invalid={!!errors.phone}
            aria-describedby="phone-error"
          />
          {errors.phone && (
            <p id="phone-error" className="text-sm text-destructive">{errors.phone}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password *</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
              value={data.password}
              onChange={handleChange('password')}
              required
              minLength={6}
              aria-invalid={!!errors.password}
              aria-describedby="password-error"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          {errors.password && (
            <p id="password-error" className="text-sm text-destructive">{errors.password}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Minimum 6 characters with letters and numbers
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm_password">Confirm Password *</Label>
          <div className="relative">
            <Input
              id="confirm_password"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              value={data.confirm_password}
              onChange={handleChange('confirm_password')}
              required
              aria-invalid={!!errors.confirm_password}
              aria-describedby="confirm_password-error"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          {errors.confirm_password && (
            <p id="confirm_password-error" className="text-sm text-destructive">{errors.confirm_password}</p>
          )}
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="role">Role</Label>
          <Input
            id="role"
            type="text"
            value="super_admin"
            disabled
            className="bg-muted"
            aria-describedby="role-description"
          />
          <p id="role-description" className="text-xs text-muted-foreground">
            The first user is automatically assigned the Super Admin role
          </p>
        </div>
      </div>

      <div className="bg-muted/50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Important Notes:</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• The admin account will have full access to all company features</li>
          <li>• You can add more users with different roles after signup</li>
          <li>• Company code + username will be used for login</li>
          <li>• Keep your password secure and share it only with trusted team members</li>
        </ul>
      </div>
    </div>
  );
}
