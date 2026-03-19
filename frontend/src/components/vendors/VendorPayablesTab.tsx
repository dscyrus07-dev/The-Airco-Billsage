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
} from 'lucide-react';
import type { VendorInvoice } from '@/types/vendor';

interface VendorPayablesTabProps {
  vendorId: string;
  invoices: VendorInvoice[];
  isLoading?: boolean;
}

export default function VendorPayablesTab({
  vendorId,
  invoices,
  isLoading = false,
}: VendorPayablesTabProps) {
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

  const calculatePayables = () => {
    const outstandingInvoices = invoices.filter(inv => inv.status === 'unpaid' || inv.status === 'overdue');
    const overdueInvoices = invoices.filter(inv => inv.status === 'overdue');
    const upcomingInvoices = invoices.filter(inv => inv.status === 'unpaid' && inv.dueDate > new Date().toISOString());
    
    const totalOutstanding = outstandingInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const upcomingAmount = upcomingInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

    // Aging buckets
    const agingBuckets = {
      '0-30': { count: 0, amount: 0 },
      '31-60': { count: 0, amount: 0 },
      '61-90': { count: 0, amount: 0 },
      '90+': { count: 0, amount: 0 },
    };

    outstandingInvoices.forEach(inv => {
      agingBuckets[inv.agingBucket].count++;
      agingBuckets[inv.agingBucket].amount += inv.totalAmount;
    });

    // Chart data
    const agingChartData = Object.entries(agingBuckets).map(([bucket, data]) => ({
      bucket: `${bucket} days`,
      amount: data.amount,
      count: data.count,
    }));

    const pieChartData = Object.entries(agingBuckets).map(([bucket, data]) => ({
      name: `${bucket} days`,
      value: data.amount,
    }));

    return {
      totalOutstanding,
      overdueAmount,
      upcomingAmount,
      overdueInvoices,
      upcomingInvoices,
      agingBuckets,
      agingChartData,
      pieChartData,
    };
  };

  const payables = calculatePayables();

  const COLORS = ['#10b981', '#f59e0b', '#f97316', '#ef4444'];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-8 w-1/2 mb-2" />
              <Skeleton className="h-3 w-full" />
            </Card>
          ))}
        </div>
        <Card className="p-6">
          <Skeleton className="h-64 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Total Outstanding</span>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(payables.totalOutstanding)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {payables.overdueInvoices.length + payables.upcomingInvoices.length} invoices
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Overdue Amount</span>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(payables.overdueAmount)}</p>
          <p className="text-xs text-red-500 mt-1">
            {payables.overdueInvoices.length} overdue invoices
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Upcoming Due</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(payables.upcomingAmount)}</p>
          <p className="text-xs text-blue-500 mt-1">
            {payables.upcomingInvoices.length} upcoming invoices
          </p>
        </Card>
      </div>

      {/* Aging Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Aging Analysis</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={payables.agingChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" />
              <YAxis tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} />
              <Tooltip 
                formatter={(value: number) => [formatCurrency(value), 'Amount']}
                labelFormatter={(label) => `Aging: ${label}`}
              />
              <Bar dataKey="amount" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Aging Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={payables.pieChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {payables.pieChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [formatCurrency(value), 'Amount']} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Aging Buckets Detail */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Aging Buckets</h3>
        <div className="space-y-4">
          {Object.entries(payables.agingBuckets).map(([bucket, data]) => {
            const percentage = payables.totalOutstanding > 0 ? (data.amount / payables.totalOutstanding) * 100 : 0;
            const isOverdue = bucket !== '0-30';
            
            return (
              <div key={bucket} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{bucket} days</span>
                    {isOverdue && <AlertTriangle className="h-4 w-4 text-red-500" />}
                  </div>
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

      {/* Overdue Invoices List */}
      {payables.overdueInvoices.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-red-600">Overdue Invoices</h3>
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
                {payables.overdueInvoices
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

      {/* Upcoming Dues List */}
      {payables.upcomingInvoices.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 text-blue-600">Upcoming Dues</h3>
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
                {payables.upcomingInvoices
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
  );
}
