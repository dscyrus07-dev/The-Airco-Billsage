import React, { useState } from 'react';
import { Calendar, Download, RefreshCw, TrendingUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { journalService, TrialBalance, GenerateTrialBalance } from '@/services/journalService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function TrialBalance() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedBalance, setSelectedBalance] = useState<TrialBalance | null>(null);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  const {
    data: trialBalances = [],
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['trial-balances'],
    queryFn: () => journalService.getTrialBalances()
  });

  const generateMutation = useMutation({
    mutationFn: (data: GenerateTrialBalance) => journalService.generateTrialBalance(data),
    onSuccess: () => {
      toast.success('Trial balance generated successfully');
      refetch();
      setIsGenerateDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Failed to generate trial balance');
      console.error(error);
    }
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      as_of_date: selectedDate
    });
  };

  const handleExport = async (balanceId: string, format: 'csv' | 'pdf' = 'csv') => {
    try {
      const blob = await journalService.exportTrialBalance(balanceId, format);
      journalService.downloadFile(blob, `trial-balance-${selectedDate}.${format}`);
      toast.success('Trial balance exported successfully');
    } catch (error) {
      toast.error('Failed to export trial balance');
    }
  };

  const getLatestBalance = () => {
    if (trialBalances.length > 0) {
      return trialBalances[0];
    }
    return null;
  };

  const latestBalance = getLatestBalance();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trial Balance</h1>
          <p className="text-muted-foreground">Generate and view trial balance reports</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {latestBalance && (
            <Button variant="outline" onClick={() => handleExport(latestBalance.id)}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          )}
          <Button onClick={() => setIsGenerateDialogOpen(true)}>
            <TrendingUp className="h-4 w-4 mr-2" />
            Generate Trial Balance
          </Button>
        </div>
      </div>

      {/* Generate Dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Trial Balance</DialogTitle>
            <DialogDescription>
              Generate a trial balance for a specific date
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="as_of_date">As of Date</Label>
              <Input
                id="as_of_date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
                {generateMutation.isPending ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Latest Balance Summary */}
      {latestBalance && (
        <Card>
          <CardHeader>
            <CardTitle>Latest Trial Balance</CardTitle>
            <CardDescription>
              Generated on {format(new Date(latestBalance.generated_at), 'MMM dd, yyyy HH:mm')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-sm font-medium">As of Date</Label>
                <div className="text-lg font-bold">
                  {format(new Date(latestBalance.as_of_date), 'MMM dd, yyyy')}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Total Debit</Label>
                <div className="text-lg font-bold">
                  {journalService.formatCurrency(latestBalance.total_debit)}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Total Credit</Label>
                <div className="text-lg font-bold">
                  {journalService.formatCurrency(latestBalance.total_credit)}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <Badge className={latestBalance.is_balanced ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                  {latestBalance.is_balanced ? "Balanced" : "Not Balanced"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trial Balance List */}
      <Card>
        <CardHeader>
          <CardTitle>Trial Balance History</CardTitle>
          <CardDescription>
            Historical trial balance reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : trialBalances.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No trial balances found</p>
              <Button onClick={() => setIsGenerateDialogOpen(true)}>
                Generate First Trial Balance
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>As of Date</TableHead>
                  <TableHead>Generated At</TableHead>
                  <TableHead>Total Debit</TableHead>
                  <TableHead>Total Credit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trialBalances.map((balance) => (
                  <TableRow key={balance.id}>
                    <TableCell>{format(new Date(balance.as_of_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{format(new Date(balance.generated_at), 'MMM dd, yyyy HH:mm')}</TableCell>
                    <TableCell>{journalService.formatCurrency(balance.total_debit)}</TableCell>
                    <TableCell>{journalService.formatCurrency(balance.total_credit)}</TableCell>
                    <TableCell>
                      <Badge className={balance.is_balanced ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {balance.is_balanced ? "Balanced" : "Not Balanced"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedBalance(balance)}
                        >
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExport(balance.id)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Balance Detail Dialog */}
      <Dialog open={!!selectedBalance} onOpenChange={() => setSelectedBalance(null)}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          {selectedBalance && (
            <>
              <DialogHeader>
                <DialogTitle>Trial Balance Details</DialogTitle>
                <DialogDescription>
                  Trial balance as of {format(new Date(selectedBalance.as_of_date), 'MMM dd, yyyy')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Generated At</Label>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(selectedBalance.generated_at), 'MMM dd, yyyy HH:mm')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Total Debit</Label>
                    <p className="text-lg font-bold">
                      {journalService.formatCurrency(selectedBalance.total_debit)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Total Credit</Label>
                    <p className="text-lg font-bold">
                      {journalService.formatCurrency(selectedBalance.total_credit)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Status</Label>
                    <Badge className={selectedBalance.is_balanced ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {selectedBalance.is_balanced ? "Balanced" : "Not Balanced"}
                    </Badge>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Account Balances</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account Code</TableHead>
                        <TableHead>Account Name</TableHead>
                        <TableHead>Account Type</TableHead>
                        <TableHead>Opening Balance</TableHead>
                        <TableHead>Debit Total</TableHead>
                        <TableHead>Credit Total</TableHead>
                        <TableHead>Closing Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedBalance.line_items.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell className="font-medium">{line.account_code}</TableCell>
                          <TableCell>{line.account_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {line.account_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{journalService.formatCurrency(line.opening_balance)}</TableCell>
                          <TableCell>{journalService.formatCurrency(line.debit_total)}</TableCell>
                          <TableCell>{journalService.formatCurrency(line.credit_total)}</TableCell>
                          <TableCell className="font-medium">
                            {journalService.formatCurrency(line.closing_balance)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
