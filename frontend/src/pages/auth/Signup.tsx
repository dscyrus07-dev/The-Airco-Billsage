import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CompanyInfoStep } from '@/components/auth/CompanyInfoStep';
import { CompanyProfileStep } from '@/components/auth/CompanyProfileStep';
import { AdminUserStep } from '@/components/auth/AdminUserStep';
import { useAuth } from '@/context/AuthContext';
import { SignupRequest } from '@/api/auth';
 import logo from '../../../favicon_io/logo.png';

interface FormData {
  // Company Info
  legal_name: string;
  trade_name: string;
  display_name: string;
  primary_email: string;
  primary_phone: string;
  
  // Company Profile
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
  
  // Admin User
  full_name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
  role: string;
}

const initialFormData: FormData = {
  // Company Info
  legal_name: '',
  trade_name: '',
  display_name: '',
  primary_email: '',
  primary_phone: '',
  
  // Company Profile
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'India',
  pan: '',
  gstin: '',
  cin: '',
  tan: '',
  billing_email: '',
  support_email: '',
  website: '',
  financial_year_start_month: 4,
  invoice_prefix: 'INV',
  
  // Admin User
  full_name: '',
  username: '',
  email: '',
  phone: '',
  password: '',
  confirm_password: '',
  role: 'super_admin',
};

export default function Signup() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  const { signup } = useAuth();

  const totalSteps = 3;

  const handleFieldChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const clearError = (field: string) => {
    setErrors(prev => ({ ...prev, [field]: '' }));
    if (errors.submit) {
      setErrors(prev => ({ ...prev, submit: '' }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      // Company Info validation
      if (!formData.legal_name.trim()) {
        newErrors.legal_name = 'Legal name is required';
      } else if (formData.legal_name.trim().length < 2) {
        newErrors.legal_name = 'Legal name must be at least 2 characters';
      }

      if (!formData.primary_email.trim()) {
        newErrors.primary_email = 'Primary email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.primary_email)) {
        newErrors.primary_email = 'Please enter a valid email address';
      }

      if (formData.primary_phone && !/^[\d\s\-\+\(\)]+$/.test(formData.primary_phone)) {
        newErrors.primary_phone = 'Please enter a valid phone number';
      }
    }

    if (step === 2) {
      // Company Profile validation (optional fields, only validate if provided)
      if (formData.pan && !/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/.test(formData.pan)) {
        newErrors.pan = 'Invalid PAN format (e.g., AAAPL1234C)';
      }

      if (formData.financial_year_start_month < 1 || formData.financial_year_start_month > 12) {
        newErrors.financial_year_start_month = 'Financial year start month must be between 1 and 12';
      }
    }

    if (step === 3) {
      // Admin User validation
      if (!formData.full_name.trim()) {
        newErrors.full_name = 'Full name is required';
      } else if (formData.full_name.trim().length < 2) {
        newErrors.full_name = 'Name must be at least 2 characters';
      }

      if (!formData.username.trim()) {
        newErrors.username = 'Username is required';
      } else if (formData.username.trim().length < 3) {
        newErrors.username = 'Username must be at least 3 characters';
      } else if (!/^[A-Za-z0-9_-]+$/.test(formData.username)) {
        newErrors.username = 'Username can only contain letters, numbers, underscores, and hyphens';
      }

      if (!formData.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }

      if (formData.phone && !/^[\d\s\-\+\(\)]+$/.test(formData.phone)) {
        newErrors.phone = 'Please enter a valid phone number';
      }

      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      } else if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(formData.password)) {
        newErrors.password = 'Password must contain both letters and numbers';
      }

      if (!formData.confirm_password) {
        newErrors.confirm_password = 'Please confirm your password';
      } else if (formData.password !== formData.confirm_password) {
        newErrors.confirm_password = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      return;
    }

    setIsLoading(true);

    try {
      const signupData: SignupRequest = {
        company: {
          legal_name: formData.legal_name.trim(),
          trade_name: formData.trade_name.trim() || undefined,
          display_name: formData.display_name.trim() || undefined,
          primary_email: formData.primary_email.trim(),
          primary_phone: formData.primary_phone.trim() || undefined,
        },
        company_details: {
          address_line_1: formData.address_line_1.trim() || undefined,
          address_line_2: formData.address_line_2.trim() || undefined,
          city: formData.city.trim() || undefined,
          state: formData.state.trim() || undefined,
          postal_code: formData.postal_code.trim() || undefined,
          country: formData.country.trim() || undefined,
          pan: formData.pan.trim().toUpperCase() || undefined,
          gstin: formData.gstin.trim() || undefined,
          cin: formData.cin.trim().toUpperCase() || undefined,
          tan: formData.tan.trim().toUpperCase() || undefined,
          billing_email: formData.billing_email.trim() || undefined,
          support_email: formData.support_email.trim() || undefined,
          website: formData.website.trim() || undefined,
          financial_year_start_month: formData.financial_year_start_month,
          invoice_prefix: formData.invoice_prefix.trim() || undefined,
        },
        user: {
          full_name: formData.full_name.trim(),
          username: formData.username.trim().toLowerCase(),
          email: formData.email.trim(),
          phone: formData.phone.trim() || undefined,
          password: formData.password,
          role: 'super_admin',
        },
      };

      await signup(signupData);
      // Navigation is handled by the auth context
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      setErrors({ submit: message });
    } finally {
      setIsLoading(false);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return 'Step 1: Company Information';
      case 2:
        return 'Step 2: Company Profile';
      case 3:
        return 'Step 3: Admin Account';
      default:
        return '';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 1:
        return 'Basic company details and contact information';
      case 2:
        return 'Extended company profile (optional but recommended)';
      case 3:
        return 'Create the primary admin user account';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-8">
      <div className="w-full max-w-4xl">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <img src={logo} alt="The Airco Billsage" className="h-12 w-12 rounded-lg object-contain bg-white" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">The Airco Billsage</h1>
              <p className="text-sm text-muted-foreground">Smart Business Management</p>
            </div>
          </div>
          <p className="text-muted-foreground">Create your company account to get started</p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{getStepTitle()}</h2>
            <span className="text-sm text-muted-foreground">
              Step {currentStep} of {totalSteps}
            </span>
          </div>
          <Progress value={(currentStep / totalSteps) * 100} className="w-full" />
          <p className="text-sm text-muted-foreground mt-2">{getStepDescription()}</p>
        </div>

        <Card>
          <CardContent className="p-8">
            {/* Step Content */}
            {currentStep === 1 && (
              <CompanyInfoStep
                data={{
                  legal_name: formData.legal_name,
                  trade_name: formData.trade_name,
                  display_name: formData.display_name,
                  primary_email: formData.primary_email,
                  primary_phone: formData.primary_phone,
                }}
                onChange={handleFieldChange}
                errors={errors}
                onClearError={clearError}
              />
            )}

            {currentStep === 2 && (
              <CompanyProfileStep
                data={{
                  address_line_1: formData.address_line_1,
                  address_line_2: formData.address_line_2,
                  city: formData.city,
                  state: formData.state,
                  postal_code: formData.postal_code,
                  country: formData.country,
                  pan: formData.pan,
                  gstin: formData.gstin,
                  cin: formData.cin,
                  tan: formData.tan,
                  billing_email: formData.billing_email,
                  support_email: formData.support_email,
                  website: formData.website,
                  financial_year_start_month: formData.financial_year_start_month,
                  invoice_prefix: formData.invoice_prefix,
                }}
                onChange={handleFieldChange}
                errors={errors}
                onClearError={clearError}
              />
            )}

            {currentStep === 3 && (
              <AdminUserStep
                data={{
                  full_name: formData.full_name,
                  username: formData.username,
                  email: formData.email,
                  phone: formData.phone,
                  password: formData.password,
                  confirm_password: formData.confirm_password,
                  role: formData.role,
                }}
                onChange={handleFieldChange}
                errors={errors}
                onClearError={clearError}
              />
            )}
          </CardContent>

          <CardFooter className="flex justify-between px-8 pb-8">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1 || isLoading}
            >
              Back
            </Button>

            {currentStep < totalSteps ? (
              <Button onClick={handleNext} disabled={isLoading}>
                Next Step
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>
            )}
          </CardFooter>
        </Card>

        <div className="text-center mt-6 text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            to="/auth/login"
            className="text-primary hover:underline font-medium"
          >
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
