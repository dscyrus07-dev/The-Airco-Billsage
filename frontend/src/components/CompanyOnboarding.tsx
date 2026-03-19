import React, { useState } from 'react';
import { Building2, Plus, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface CompanyFormData {
  legalName: string;
  tradeName: string;
  gstin: string;
  pan: string;
  address: string;
  phone: string;
  email: string;
}

export function CompanyOnboarding() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CompanyFormData>({
    legalName: '',
    tradeName: '',
    gstin: '',
    pan: '',
    address: '',
    phone: '',
    email: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const { selectCompany } = useAuth();

  
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newCompany = {
        id: Date.now().toString(),
        ...formData,
      };
      
      selectCompany(newCompany);
      setIsDialogOpen(false);
      toast.success(`Company "${formData.tradeName}" created successfully!`);
      
      // Reset form
      setFormData({
        legalName: '',
        tradeName: '',
        gstin: '',
        pan: '',
        address: '',
        phone: '',
        email: '',
      });
    } catch (error) {
      toast.error('Failed to create company. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-3">
          <Building2 className="h-12 w-12 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Welcome to The Airco Billsage</h1>
            <p className="text-lg text-muted-foreground">Let's get your company set up</p>
          </div>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Select an existing company or create a new one to start managing your financial operations.
        </p>
      </div>

      {/* Create New Company Card */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow border-dashed border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New Company
            </CardTitle>
            <CardDescription>
              Set up a new company profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setIsDialogOpen(true)}
              className="w-full"
            >
              Create Company
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Create Company Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Company</DialogTitle>
            <DialogDescription>
              Enter your company details to get started
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleCreateCompany} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="legalName">Legal Name *</Label>
                <Input
                  id="legalName"
                  name="legalName"
                  placeholder="Acme Manufacturing Pvt Ltd"
                  value={formData.legalName}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tradeName">Trade Name *</Label>
                <Input
                  id="tradeName"
                  name="tradeName"
                  placeholder="Acme Manufacturing"
                  value={formData.tradeName}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gstin">GSTIN *</Label>
                <Input
                  id="gstin"
                  name="gstin"
                  placeholder="27AAAPL1234C1ZV"
                  value={formData.gstin}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}[A-Z]{1}[0-9]{1}"
                  maxLength={15}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="pan">PAN *</Label>
                <Input
                  id="pan"
                  name="pan"
                  placeholder="AAAPL1234C"
                  value={formData.pan}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                  maxLength={10}
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                name="address"
                placeholder="123 Industrial Area, Mumbai, Maharashtra 400001"
                value={formData.address}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="+91 22 2345 6789"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  type="tel"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  placeholder="accounts@company.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  type="email"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create Company'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
