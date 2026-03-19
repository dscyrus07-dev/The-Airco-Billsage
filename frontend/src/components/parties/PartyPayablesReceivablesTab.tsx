import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  AlertTriangle, Clock, TrendingUp, TrendingDown, Calendar, IndianRupee,
  CreditCard, ShoppingCart, DollarSign,
} from 'lucide-react';
import type { Party, PartyInvoice } from '@/types/party';

interface PartyPayablesReceivablesTabProps {
  party: Party;
  partyId: string;
  invoices: PartyInvoice[];
  isLoading?: boolean;
}

export default function PartyPayablesReceivablesTab({
  party,
  partyId,
  invoices,
  isLoading = false,
}: PartyPayablesReceivablesTabProps) {
  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const calculatePayablesReceivables = () => {
    const purchaseInvoices = invoices.filter(inv => inv.invoiceType === 'purchase');
    const salesInvoices = invoices.filter(inv => inv.invoiceType === 'sale');
    
    const outstandingPurchases = purchaseInvoices.filter(inv => inv.status === 'unpaid' || inv.status === 'overdue');
    const outstandingSales = salesInvoices.filter(inv => inv.status === 'unpaid' || inv.status === 'overdue');
    
    const overduePurchases = purchaseInvoices.filter(inv => inv.status === 'overdue');
    const upcomingPurchases = purchaseInvoices.filter(inv => inv.status === 'unpaid' && inv.dueDate > new Date().toISOString());
    
    const overdueSales = salesInvoices.filter(inv => inv.status === 'overdue');
    const upcomingSales = salesInvoices.filter(inv => inv.status === 'unpaid' && inv.dueDate > new Date().toISOString());
    
    const totalOutstandingPayables = outstandingPurchases.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalOutstandingReceivables = outstandingSales.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const overduePayablesAmount = overduePurchases.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const overdueReceivablesAmount = overdueSales.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const upcomingPayablesAmount = upcomingPurchases.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const upcomingReceivablesAmount = upcomingSales.reduce((sum, inv) => sum + inv.totalAmount, 0);

    // Aging buckets for purchases
    const purchaseAgingBuckets = {
      '0-30': { count: 0, amount: 0 },
      '31-60': { count: 0, amount: 0 },
      '61-90': { count: 0, amount: 0 },
      '90+': { count: 0, amount: 0 },
    };

    outstandingPurchases.forEach(inv => {
      purchaseAgingBuckets[inv.agingBucket].count++;
      purchaseAgingBuckets[inv.agingBucket].amount += inv.totalAmount;
    });

    // Aging buckets for sales
    const salesAgingBuckets = {
      '0-30': { count: 0, amount: 0 },
      '31-60': { count: 0, amount: 0 },
      '61-90': { count: 0, amount: 0 },
      '90+': { count: 0, amount: 0 },
    };

    outstandingSales.forEach(inv => {
      salesAgingBuckets[inv.agingBucket].count++;
      salesAgingBuckets[inv.agingBucket].amount += inv.totalAmount;
    });

    // Chart data
    const purchaseAgingChartData = Object.entries(purchaseAgingBuckets).map(([bucket, data]) => ({
      bucket: `${bucket} days`,
      amount: data.amount,
      count: data.count,
    }));

    const salesAgingChartData = Object.entries(salesAgingBuckets).map(([bucket, data]) => ({
      bucket: `${bucket} days`,
      amount: data.amount,
      count: data.count,
    }));

    const purchasePieChartData = Object.entries(purchaseAgingBuckets).map(([bucket, data]) => ({
      name: `${bucket} days`,
      value: data.amount,
    }));

    const salesPieChartData = Object.entries(salesAgingBuckets).map(([bucket, data]) => ({
      name: `${bucket} days`,
      value: data.amount,
    }));

    return {
      totalOutstandingPayables,
      totalOutstandingReceivables,
      overduePayablesAmount,
      overdueReceivablesAmount,
      upcomingPayablesAmount,
      upcomingReceivablesAmount,
      overduePurchases,
      upcomingPurchases,
      overdueSales,
      upcomingSales,
      purchaseAgingBuckets,
      salesAgingBuckets,
      purchaseAgingChartData,
      salesAgingChartData,
      purchasePieChartData,
      salesPieChartData,
    };
  };

  const payablesReceivables = calculatePayablesReceivables();
  const isSupplier = party.partyType === 'supplier' || party.partyType === 'both';
  const isCustomer = party.partyType === 'customer' || party.partyType === 'both';

  const COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-64 w-full" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {isSupplier && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Outstanding Payables</span>
              <Clock className="h-4 w-4 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(payablesReceivables.totalOutstandingPayables)}</p>
            <p className="text-xs text-orange-500 mb-1">
              {payablesReceivables.overduePurchases.length} overdue invoices
            </p>
          </Card>
        )}

        {isCustomer && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Outstanding Receivables</span>
              <CreditCard className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-purple-600">{formatCurrency(payablesReceivables.totalOutstandingReceivables)}</p>
            <p className="text-xs text-purple-500 mb-1">
              {payablesReceivables.overdueSales.length} overdue invoices
            </p>
          </Card>
        )}

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Overdue Amount</span>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(payablesReceivables.overduePayablesAmount + payablesReceivables.overdueReceivablesAmount)}
          </p>
          <p className="text-xs text-red-500">
            {isSupplier && `₹${payablesReceivables.overduePayablesAmount.toLocaleString('en-IN')} payables`}
            {isCustomer && `₹${payablesReceivables.overdueReceivablesAmount.toLocaleString('en-IN')} receivables`}
          </p>
        </Card>
      </div>

      {/* Aging Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isSupplier && (
          <>
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Payables Aging Analysis</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={payablesReceivables.purchaseAgingChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" />
                  <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Amount']}
                    labelFormatter={(label) => `Aging: ${label}`}
                  />
                  <Bar dataKey="amount" fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Payables Aging Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={payablesReceivables.purchasePieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {payablesReceivables.purchasePieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [formatCurrency(value), 'Amount']} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </>
        )}

        {isCustomer && (
          <>
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Receivables Aging Analysis</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={payablesReceivables.salesAgingChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" />
                  <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Amount']}
                    labelFormatter={(label) => `Aging: ${label}`}
                  />
                  <Bar dataKey="amount" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Receivables Aging Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={payablesReceivables.salesPieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {payablesReceivables.salesPieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [formatCurrency(value), 'Amount']} />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </>
        )}
      </div>

      {/* Aging Buckets Detail */}
      {isSupplier && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Payables Aging Buckets</h3>
          <div className="space-y-4">
            {Object.entries(payablesReceivables.purchaseAgingBuckets).map(([bucket, data]) => {
              const percentage = payablesReceivables.totalOutstandingPayables > 0 ? (data.amount / payablesReceivables.totalOutstandingPayables) * 100 : 0;
              
              return (
                <div key={bucket} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{bucket} days</span>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(data.amount)}</p>
                      <p className="text-xs text-muted-foreground">{data.count} invoices</p>
                    </div>
                  </div>
                  <Progress 
                    value={percentage} 
                    className="h-2"
                  />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {isCustomer && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Receivables Aging Buckets</h3>
          <div className="space-y-4">
            {Object.entries(payablesReceivables.salesAgingBuckets).map(([bucket, data]) => {
              const percentage = payablesReceivables.totalOutstandingReceivables > 0 ? (data.amount / payablesReceivables.totalOutstandingReceivables) * 100 : 0;
              
              return (
                <div key={bucket} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{bucket} days</span>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(data.amount)}</p>
                      <p className="text-xs text-muted-foreground">{data.count} invoices</p>
                    </div>
                  </div>
                  <Progress 
                    value={percentage} 
                    className="h-2"
                  />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Overdue Invoices List */}
      {(payablesReceivables.overduePurchases.length > 0 || payablesReceivables.overdueSales.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {isSupplier && payablesReceivables.overduePurchases.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-orange-600">Overdue Payables</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Days Overdue</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payablesReceivables.overduePurchases
                      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                      .map((invoice) => {
                        const daysOverdue = Math.floor(
                          (new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
                        );
                        
                        return (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-mono">{invoice.invoiceNo}</TableCell>
                            <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">{daysOverdue} days</Badge>
                            </TableCell>
                            <TableCell className="font-semibold">{formatCurrency(invoice.totalAmount)}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">Overdue</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {isCustomer && payablesReceivables.overdueSales.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-red-600">Overdue Receivables</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Days Overdue</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payablesReceivables.overdueSales
                      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                      .map((invoice) => {
                        const daysOverdue = Math.floor(
                          (new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
                        );
                        
                        return (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-mono">{invoice.invoiceNo}</TableCell>
                            <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">{daysOverdue} days</Badge>
                            </TableCell>
                            <TableCell className="font-semibold">{formatCurrency(invoice.totalAmount)}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">Overdue</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Upcoming Dues List */}
      {(payablesReceivables.upcomingPurchases.length > 0 || payablesReceivables.upcomingSales.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {isSupplier && payablesReceivables.upcomingPurchases.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-blue-600">Upcoming Payables</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Days Until Due</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payablesReceivables.upcomingPurchases
                      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                      .map((invoice) => {
                        const daysUntilDue = Math.floor(
                          (new Date(invoice.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                        );
                        
                        return (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-mono">{invoice.invoiceNo}</TableCell>
                            <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                            <TableCell>
                              <Badge variant={daysUntilDue <= 7 ? 'destructive' : 'secondary'}>
                                {daysUntilDue} days
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold">{formatCurrency(invoice.totalAmount)}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">Unpaid</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {isCustomer && payablesReceivables.upcomingSales.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-green-600">Upcoming Receivables</h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice No</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Days Until Due</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payablesReceivables.upcomingSales
                      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                      .map((invoice) => {
                        const daysUntilDue = Math.floor(
                          (new Date(invoice.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                        );
                        
                        return (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-mono">{invoice.invoiceNo}</TableCell>
                            <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                            <TableCell>
                              <Badge variant={daysUntilDue <= 7 ? 'destructive' : 'secondary'}>
                                {daysUntilDue} days
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold">{formatCurrency(invoice.totalAmount)}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">Unpaid</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
