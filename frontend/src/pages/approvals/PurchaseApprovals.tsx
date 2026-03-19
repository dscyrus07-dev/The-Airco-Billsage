import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPurchases } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Search, Filter, Calendar, User, AlertTriangle, CheckCircle, XCircle,
  FileText, ArrowRight, Download, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const statusColors = {
  pending_approval: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
  correction_required: "bg-blue-100 text-blue-700 border-blue-200",
};

const gstStatusColors = {
  matched: "bg-emerald-100 text-emerald-700 border-emerald-200",
  mismatch: "bg-red-100 text-red-700 border-red-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
};

export default function PurchaseApprovals() {
  const navigate = useNavigate();
  const { data: purchases, isLoading } = useQuery({
    queryKey: ["purchases"],
    queryFn: () => fetchPurchases(),
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [gstStatusFilter, setGstStatusFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [amountRange, setAmountRange] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  // Filter pending and processed purchases
  const filteredPurchases = useMemo(() => {
    if (!purchases) return [];

    let filtered = purchases.filter(p => 
      p.status === "pending_approval" || 
      p.status === "approved" || 
      p.status === "rejected" || 
      p.status === "correction_required"
    );

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(p =>
        p.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.gstin?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    // GST status filter
    if (gstStatusFilter !== "all") {
      filtered = filtered.filter(p => p.gstStatus === gstStatusFilter);
    }

    // Vendor filter
    if (vendorFilter !== "all") {
      filtered = filtered.filter(p => p.vendor === vendorFilter);
    }

    // Amount range filter
    if (amountRange !== "all") {
      const [min, max] = amountRange.split("-").map(Number);
      filtered = filtered.filter(p => {
        if (max) return p.totalAmount >= min && p.totalAmount <= max;
        return p.totalAmount >= min;
      });
    }

    return filtered.sort((a, b) => {
      // Sort by date descending, then by status priority
      const dateA = new Date(a.invoiceDate).getTime();
      const dateB = new Date(b.invoiceDate).getTime();
      return dateB - dateA;
    });
  }, [purchases, searchTerm, statusFilter, gstStatusFilter, vendorFilter, amountRange]);

  // Get unique vendors for filter
  const vendors = useMemo(() => {
    if (!purchases) return [];
    const uniqueVendors = [...new Set(purchases.map(p => p.vendor))];
    return uniqueVendors.sort();
  }, [purchases]);

  // Status counts
  const statusCounts = useMemo(() => {
    if (!filteredPurchases) return {};
    return filteredPurchases.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [filteredPurchases]);

  const handleRowClick = (purchaseId: string) => {
    navigate(`/app/purchases/${purchaseId}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-96 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Purchase Approvals</h1>
          <p className="text-muted-foreground mt-1">
            Review and approve purchase invoices before payment processing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium">Pending Approval</p>
              <p className="text-2xl font-bold text-amber-600">
                {statusCounts.pending_approval || 0}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-medium">Approved</p>
              <p className="text-2xl font-bold text-emerald-600">
                {statusCounts.approved || 0}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-sm font-medium">Rejected</p>
              <p className="text-2xl font-bold text-red-600">
                {statusCounts.rejected || 0}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium">Correction Required</p>
              <p className="text-2xl font-bold text-blue-600">
                {statusCounts.correction_required || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4" />
          <h3 className="font-semibold">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <Label className="text-xs">Search</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Invoice, vendor, GSTIN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending_approval">Pending Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="correction_required">Correction Required</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">GST Status</Label>
            <Select value={gstStatusFilter} onValueChange={setGstStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All GST Status</SelectItem>
                <SelectItem value="matched">Matched</SelectItem>
                <SelectItem value="mismatch">Mismatch</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Vendor</Label>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors.map((vendor) => (
                  <SelectItem key={vendor} value={vendor}>
                    {vendor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Amount Range</Label>
            <Select value={amountRange} onValueChange={setAmountRange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Amounts</SelectItem>
                <SelectItem value="0-10000">₹0 - ₹10,000</SelectItem>
                <SelectItem value="10000-50000">₹10,000 - ₹50,000</SelectItem>
                <SelectItem value="50000-100000">₹50,000 - ₹1,00,000</SelectItem>
                <SelectItem value="100000-">₹1,00,000+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Date Range</Label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="quarter">This Quarter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Approvals Table */}
      <Card className="p-0">
        <div className="p-4 border-b">
          <h3 className="font-semibold">
            Purchase Invoice Queue ({filteredPurchases.length})
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Click any row to view invoice details and take approval actions
          </p>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>GST Status</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted By</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPurchases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <p className="text-muted-foreground">No invoices found</p>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your filters or check back later
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredPurchases.map((purchase) => (
                <TableRow
                  key={purchase.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(purchase.id)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium font-mono text-sm">{purchase.invoiceNo}</p>
                      <p className="text-xs text-muted-foreground">
                        Due: {purchase.dueDate}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{purchase.vendor}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {purchase.gstin}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{purchase.invoiceDate}</p>
                      {purchase.paymentTerms && (
                        <p className="text-xs text-muted-foreground">
                          {purchase.paymentTerms}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-semibold">{fmt(purchase.totalAmount)}</p>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${gstStatusColors[purchase.gstStatus]}`}>
                      {purchase.gstStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${statusColors[purchase.status]}`}>
                      {purchase.status.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{purchase.recordedBy}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRowClick(purchase.id);
                      }}
                    >
                      <Eye className="h-3 w-3" />
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
