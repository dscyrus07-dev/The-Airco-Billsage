import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { journalService, JournalEntry, CreateJournalEntry } from '@/services/journalService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function JournalEntryForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [formData, setFormData] = useState<CreateJournalEntry>({
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    reference: '',
    description: '',
    status: 'draft',
    line_items: [
      {
        account_code: '',
        account_name: '',
        description: '',
        debit: 0,
        credit: 0
      }
    ]
  });

  const [errors, setErrors] = useState<string[]>([]);

  const {
    data: existingEntry,
    isLoading: isLoadingEntry
  } = useQuery({
    queryKey: ['journal-entry', id],
    queryFn: () => journalService.getEntry(id!),
    enabled: isEditing
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateJournalEntry) => journalService.createEntry(data),
    onSuccess: () => {
      toast.success('Journal entry created successfully');
      navigate('/app/journal');
    },
    onError: (error) => {
      toast.error('Failed to create journal entry');
      console.error(error);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateJournalEntry }) => journalService.updateEntry(id, data),
    onSuccess: () => {
      toast.success('Journal entry updated successfully');
      navigate('/app/journal');
    },
    onError: (error) => {
      toast.error('Failed to update journal entry');
      console.error(error);
    }
  });

  useEffect(() => {
    if (existingEntry && isEditing) {
      setFormData({
        entry_date: format(new Date(existingEntry.entry_date), 'yyyy-MM-dd'),
        reference: existingEntry.reference || '',
        description: existingEntry.description,
        status: existingEntry.status,
        line_items: existingEntry.line_items.map(item => ({
          account_code: item.account_code,
          account_name: item.account_name,
          description: item.description || '',
          debit: item.debit,
          credit: item.credit,
          party_id: item.party_id
        }))
      });
    }
  }, [existingEntry, isEditing]);

  const addLineItem = () => {
    setFormData(prev => ({
      ...prev,
      line_items: [
        ...prev.line_items,
        {
          account_code: '',
          account_name: '',
          description: '',
          debit: 0,
          credit: 0
        }
      ]
    }));
  };

  const removeLineItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== index)
    }));
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const newLineItems = [...prev.line_items];
      newLineItems[index] = {
        ...newLineItems[index],
        [field]: value
      };

      // Auto-balance: if debit changes, set credit to 0 and vice versa
      if (field === 'debit' && value > 0) {
        newLineItems[index].credit = 0;
      } else if (field === 'credit' && value > 0) {
        newLineItems[index].debit = 0;
      }

      return {
        ...prev,
        line_items: newLineItems
      };
    });
  };

  const validateForm = (): boolean => {
    const validation = journalService.validateJournalEntry(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return false;
    }
    setErrors([]);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    if (isEditing && id) {
      updateMutation.mutate({ id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const totalDebit = formData.line_items.reduce((sum, item) => sum + item.debit, 0);
  const totalCredit = formData.line_items.reduce((sum, item) => sum + item.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => navigate('/app/journal')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {isEditing ? 'Edit Journal Entry' : 'Create Journal Entry'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? 'Modify existing journal entry' : 'Create a new journal entry'}
            </p>
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="space-y-2">
              {errors.map((error, index) => (
                <div key={index} className="text-sm text-red-600">
                  • {error}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Enter the basic details for this journal entry</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="entry_date">Entry Date</Label>
                <Input
                  id="entry_date"
                  type="date"
                  value={formData.entry_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, entry_date: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="reference">Reference (Optional)</Label>
                <Input
                  id="reference"
                  placeholder="e.g., Invoice #123"
                  value={formData.reference}
                  onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter a description for this journal entry"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as any }))}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Line Items
              <Button type="button" variant="outline" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Line Item
              </Button>
            </CardTitle>
            <CardDescription>Enter the debit and credit entries for this journal entry</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {formData.line_items.map((item, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Line Item {index + 1}</h4>
                    {formData.line_items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`account_code_${index}`}>Account Code</Label>
                      <Input
                        id={`account_code_${index}`}
                        placeholder="e.g., 1001"
                        value={item.account_code}
                        onChange={(e) => updateLineItem(index, 'account_code', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor={`account_name_${index}`}>Account Name</Label>
                      <Input
                        id={`account_name_${index}`}
                        placeholder="e.g., Cash"
                        value={item.account_name}
                        onChange={(e) => updateLineItem(index, 'account_name', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor={`description_${index}`}>Description</Label>
                    <Textarea
                      id={`description_${index}`}
                      placeholder="Optional description for this line item"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`debit_${index}`}>Debit Amount</Label>
                      <Input
                        id={`debit_${index}`}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={item.debit}
                        onChange={(e) => updateLineItem(index, 'debit', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`credit_${index}`}>Credit Amount</Label>
                      <Input
                        id={`credit_${index}`}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={item.credit}
                        onChange={(e) => updateLineItem(index, 'credit', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>Review the totals before submitting</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Total Debit</Label>
                <div className="text-2xl font-bold">
                  {journalService.formatCurrency(totalDebit)}
                </div>
              </div>
              <div>
                <Label>Total Credit</Label>
                <div className="text-2xl font-bold">
                  {journalService.formatCurrency(totalCredit)}
                </div>
              </div>
              <div>
                <Label>Balance Status</Label>
                <Badge className={isBalanced ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                  {isBalanced ? "Balanced" : "Not Balanced"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={() => navigate('/app/journal')}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending ? 'Saving...' : (isEditing ? 'Update Entry' : 'Create Entry')}
          </Button>
        </div>
      </form>
    </div>
  );
}
