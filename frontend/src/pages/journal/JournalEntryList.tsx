import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Download, Eye, Edit, Trash2, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { journalService, JournalEntry } from '@/services/journalService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function JournalEntryList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    data: entries = [],
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['journal-entries', searchTerm, statusFilter, dateFrom, dateTo],
    queryFn: () => journalService.getEntries({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined
    })
  });

  const handleDelete = async (entryId: string) => {
    try {
      await journalService.deleteEntry(entryId);
      toast.success('Journal entry deleted successfully');
      refetch();
      setIsDeleteDialogOpen(false);
      setSelectedEntry(null);
    } catch (error) {
      toast.error('Failed to delete journal entry');
    }
  };

  const handlePost = async (entryId: string) => {
    try {
      await journalService.postEntry(entryId);
      toast.success('Journal entry posted successfully');
      refetch();
    } catch (error) {
      toast.error('Failed to post journal entry');
    }
  };

  const handleExport = async () => {
    try {
      const blob = await journalService.exportTrialBalance('latest', 'csv');
      journalService.downloadFile(blob, 'journal-entries.csv');
      toast.success('Journal entries exported successfully');
    } catch (error) {
      toast.error('Failed to export journal entries');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'posted':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Journal Entries</h1>
          <p className="text-muted-foreground">Manage your journal entries and financial records</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Entry
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search entries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder="From date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <Input
              type="date"
              placeholder="To date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Entries Table */}
      <Card>
        <CardHeader>
          <CardTitle>Journal Entries ({entries.length})</CardTitle>
          <CardDescription>Your financial journal entries</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No journal entries found</p>
              <Button className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create First Entry
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entry Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Total Debit</TableHead>
                  <TableHead>Total Credit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.entry_number}</TableCell>
                    <TableCell>{format(new Date(entry.entry_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                    <TableCell>{journalService.formatCurrency(entry.total_debit)}</TableCell>
                    <TableCell>{journalService.formatCurrency(entry.total_credit)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(entry.status)}>
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEntry(entry)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {entry.status === 'draft' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePost(entry.id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedEntry(entry);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Entry Detail Dialog */}
      <Dialog open={!!selectedEntry && !isDeleteDialogOpen} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedEntry && (
            <>
              <DialogHeader>
                <DialogTitle>Journal Entry Details</DialogTitle>
                <DialogDescription>
                  Entry #{selectedEntry.entry_number} from {format(new Date(selectedEntry.entry_date), 'MMM dd, yyyy')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Reference</label>
                    <p className="text-sm text-muted-foreground">{selectedEntry.reference || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <Badge className={getStatusColor(selectedEntry.status)}>
                      {selectedEntry.status}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Total Debit</label>
                    <p className="text-sm font-medium">{journalService.formatCurrency(selectedEntry.total_debit)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Total Credit</label>
                    <p className="text-sm font-medium">{journalService.formatCurrency(selectedEntry.total_credit)}</p>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <p className="text-sm text-muted-foreground">{selectedEntry.description}</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Line Items</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account Code</TableHead>
                        <TableHead>Account Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Debit</TableHead>
                        <TableHead>Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedEntry.line_items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.account_code}</TableCell>
                          <TableCell>{item.account_name}</TableCell>
                          <TableCell className="max-w-xs truncate">{item.description || '-'}</TableCell>
                          <TableCell>
                            {item.debit > 0 ? journalService.formatCurrency(item.debit) : '-'}
                          </TableCell>
                          <TableCell>
                            {item.credit > 0 ? journalService.formatCurrency(item.credit) : '-'}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Journal Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete journal entry #{selectedEntry?.entry_number}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => selectedEntry && handleDelete(selectedEntry.id)}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
