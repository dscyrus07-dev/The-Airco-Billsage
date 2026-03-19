import React, { useState } from 'react';
import { FileText, Download, RefreshCw, TrendingUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { journalService, BalanceSheet, GenerateBalanceSheet } from '@/services/journalService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function BalanceSheet() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedBalance, setSelectedBalance] = useState<BalanceSheet | null>(null);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);

  const queryClient = useQueryClient();

  const {
    data: balanceSheets = [],
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['balance-sheets'],
    queryFn: () => journalService.getBalanceSheets()
  });

  const generateMutation = useMutation({
    mutationFn: (data: GenerateBalanceSheet) => journalService.generateBalanceSheet(data),
    onSuccess: () => {
      toast.success('Balance sheet generated successfully');
      refetch();
      setIsGenerateDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Failed to generate balance sheet');
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
      const blob = await journalService.exportBalanceSheet(balanceId, format);
      journalService.downloadFile(blob, `balance-sheet-${selectedDate}.${format}`);
      toast.success('Balance sheet exported successfully');
    } catch (error) {
      toast.error('Failed to export balance sheet');
    }
  };

  const getLatestBalance = () => {
    if (balanceSheets.length > 0) {
      return balanceSheets[0];
    }
    return null;
  };

  const latestBalance = getLatestBalance();

  const groupBalanceSheetLines = (lines: any[]) => {
    const grouped = {
      assets: [] as any[],
      liabilities: [] as any[],
      equity: [] as any[]
    };

    lines.forEach(line => {
      if (line.line_type === 'asset') {
        grouped.assets.push(line);
      } else if (line.line_type === 'liability') {
        grouped.liabilities.push(line);
      } else if (line.line_type === 'equity') {
        grouped.equity.push(line);
      }
    });

    return grouped;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Balance Sheet</h1>
          <p className="text-muted-foreground">Generate and view balance sheet reports</p>
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
            Generate Balance Sheet
          </Button>
        </div>
      </div>

      {/* Generate Dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Balance Sheet</DialogTitle>
            <DialogDescription>
              Generate a balance sheet for a specific date
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
            <CardTitle>Latest Balance Sheet</CardTitle>
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
                <Label className="text-sm font-medium">Total Assets</Label>
                <div className="text-lg font-bold text-green-600">
                  {journalService.formatCurrency(latestBalance.total_assets)}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Total Liabilities</Label>
                <div className="text-lg font-bold text-red-600">
                  {journalService.formatCurrency(latestBalance.total_liabilities)}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Total Equity</Label>
                <div className="text-lg font-bold text-blue-600">
                  {journalService.formatCurrency(latestBalance.total_equity)}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <Label className="text-sm font-medium">Balance Equation</Label>
              <div className="text-sm text-muted-foreground">
                Assets ({journalService.formatCurrency(latestBalance.total_assets)}) = 
                Liabilities ({journalService.formatCurrency(latestBalance.total_liabilities)}) + 
                Equity ({journalService.formatCurrency(latestBalance.total_equity)})
              </div>
              <Badge className={latestBalance.is_balanced ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                {latestBalance.is_balanced ? "Balanced" : "Not Balanced"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Balance Sheet List */}
      <Card>
        <CardHeader>
          <CardTitle>Balance Sheet History</CardTitle>
          <CardDescription>
            Historical balance sheet reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : balanceSheets.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No balance sheets found</p>
              <Button onClick={() => setIsGenerateDialogOpen(true)}>
                Generate First Balance Sheet
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>As of Date</TableHead>
                  <TableHead>Generated At</TableHead>
                  <TableHead>Total Assets</TableHead>
                  <TableHead>Total Liabilities</TableHead>
                  <TableHead>Total Equity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balanceSheets.map((balance) => (
                  <TableRow key={balance.id}>
                    <TableCell>{format(new Date(balance.as_of_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{format(new Date(balance.generated_at), 'MMM dd, yyyy HH:mm')}</TableCell>
                    <TableCell className="text-green-600">{journalService.formatCurrency(balance.total_assets)}</TableCell>
                    <TableCell className="text-red-600">{journalService.formatCurrency(balance.total_liabilities)}</TableCell>
                    <TableCell className="text-blue-600">{journalService.formatCurrency(balance.total_equity)}</TableCell>
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
                <DialogTitle>Balance Sheet Details</DialogTitle>
                <DialogDescription>
                  Balance sheet as of {format(new Date(selectedBalance.as_of_date), 'MMM dd, yyyy')}
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
                    <Label className="text-sm font-medium">Total Assets</Label>
                    <p className="text-lg font-bold text-green-600">
                      {journalService.formatCurrency(selectedBalance.total_assets)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Total Liabilities</Label>
                    <p className="text-lg font-bold text-red-600">
                      {journalService.formatCurrency(selectedBalance.total_liabilities)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Total Equity</Label>
                    <p className="text-lg font-bold text-blue-600">
                      {journalService.formatCurrency(selectedBalance.total_equity)}
                    </p>
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Balance Equation</Label>
                  <div className="text-sm text-muted-foreground">
                    Assets ({journalService.formatCurrency(selectedBalance.total_assets)}) = 
                    Liabilities ({journalService.formatCurrency(selectedBalance.total_liabilities)}) + 
                    Equity ({journalService.formatCurrency(selectedBalance.total_equity)})
                  </div>
                  <Badge className={selectedBalance.is_balanced ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {selectedBalance.is_balanced ? "Balanced" : "Not Balanced"}
                  </Badge>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-4">Balance Sheet Components</h4>
                  
                  {/* Assets Section */}
                  <div className="mb-6">
                    <h5 className="text-sm font-medium text-green-600 mb-2">Assets</h5>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead>Item Name</TableHead>
                          <TableHead>Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupBalanceSheetLines(selectedBalance.line_items).assets.map((line, index) => (
                          <TableRow key={line.id}>
                            <TableCell>{line.category}</TableCell>
                            <TableCell>{line.item_name}</TableCell>
                            <TableCell className="font-medium text-green-600">
                              {journalService.formatCurrency(line.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {groupBalanceSheetLines(selectedBalance.line_items).assets.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                              No assets found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Liabilities Section */}
                  <div className="mb-6">
                    <h5 className="text-sm font-medium text-red-600 mb-2">Liabilities</h5>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead>Item Name</TableHead>
                          <TableHead>Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupBalanceSheetLines(selectedBalance.line_items).liabilities.map((line, index) => (
                          <TableRow key={line.id}>
                            <TableCell>{line.category}</TableCell>
                            <TableCell>{line.item_name}</TableCell>
                            <TableCell className="font-medium text-red-600">
                              {journalService.formatCurrency(line.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {groupBalanceSheetLines(selectedBalance.line_items).liabilities.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                              No liabilities found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Equity Section */}
                  <div>
                    <h5 className="text-sm font-medium text-blue-600 mb-2">Equity</h5>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead>Item Name</TableHead>
                          <TableHead>Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupBalanceSheetLines(selectedBalance.line_items).equity.map((line, index) => (
                          <TableRow key={line.id}>
                            <TableCell>{line.category}</TableCell>
                            <TableCell>{line.item_name}</TableCell>
                            <TableCell className="font-medium text-blue-600">
                              {journalService.formatCurrency(line.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {groupBalanceSheetLines(selectedBalance.line_items).equity.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                              No equity found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
