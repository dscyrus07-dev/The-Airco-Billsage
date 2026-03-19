import { useState, useEffect } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { companyApi } from "@/api/company";
import { settingsApi, FinancialSettings, TaxSettings, NotificationSettings, AuditSettings } from "@/api/settings";
import { usersApi, User, UserCreateRequest } from "@/api/users";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("company");

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Settings" description="Company configuration and system preferences" />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-3xl">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="tax">Tax Config</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4">
          <CompanyTab />
        </TabsContent>

        <TabsContent value="financial" className="mt-4">
          <FinancialTab />
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>

        <TabsContent value="tax" className="mt-4">
          <TaxTab />
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CompanyTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    loadCompany();
  }, []);

  const loadCompany = async () => {
    try {
      setLoading(true);
      const data = await companyApi.getMyCompany();
      setCompany(data);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load company data");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!company) return;

    try {
      setSaving(true);
      await companyApi.updateMyCompany(company);
      toast.success("Company profile updated");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update company");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!company) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">No company data available</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Basic Information */}
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-semibold">Basic Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Legal Name *</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.legal_name || ""}
              onChange={(e) => setCompany({ ...company, legal_name: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Trade Name</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.trade_name || ""}
              onChange={(e) => setCompany({ ...company, trade_name: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Display Name</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.display_name || ""}
              onChange={(e) => setCompany({ ...company, display_name: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Company Code</Label>
            <Input
              className="mt-1 h-8 text-sm font-mono"
              value={company.company_code || ""}
              disabled
            />
          </div>
          <div>
            <Label className="text-xs">Primary Email</Label>
            <Input
              type="email"
              className="mt-1 h-8 text-sm"
              value={company.primary_email || ""}
              onChange={(e) => setCompany({ ...company, primary_email: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Primary Phone</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.primary_phone || ""}
              onChange={(e) => setCompany({ ...company, primary_phone: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Alternate Phone</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.alternate_phone || ""}
              onChange={(e) => setCompany({ ...company, alternate_phone: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Website</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.website || ""}
              onChange={(e) => setCompany({ ...company, website: e.target.value })}
            />
          </div>
        </div>
      </Card>

      {/* Legal & Tax Information */}
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-semibold">Legal & Tax Identifiers</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">GSTIN</Label>
            <Input
              className="mt-1 h-8 text-sm font-mono"
              value={company.gstin || ""}
              onChange={(e) => setCompany({ ...company, gstin: e.target.value })}
              placeholder="22AAAAA0000A1Z5"
            />
          </div>
          <div>
            <Label className="text-xs">PAN</Label>
            <Input
              className="mt-1 h-8 text-sm font-mono"
              value={company.pan || ""}
              onChange={(e) => setCompany({ ...company, pan: e.target.value })}
              placeholder="AAAAA0000A"
            />
          </div>
          <div>
            <Label className="text-xs">CIN</Label>
            <Input
              className="mt-1 h-8 text-sm font-mono"
              value={company.cin || ""}
              onChange={(e) => setCompany({ ...company, cin: e.target.value })}
              placeholder="U12345AB2020PTC123456"
            />
          </div>
          <div>
            <Label className="text-xs">TAN</Label>
            <Input
              className="mt-1 h-8 text-sm font-mono"
              value={company.tan || ""}
              onChange={(e) => setCompany({ ...company, tan: e.target.value })}
              placeholder="AAAA00000A"
            />
          </div>
        </div>
      </Card>

      {/* Registered Address */}
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-semibold">Registered Address</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label className="text-xs">Address Line 1</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.address_line_1 || ""}
              onChange={(e) => setCompany({ ...company, address_line_1: e.target.value })}
            />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Address Line 2</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.address_line_2 || ""}
              onChange={(e) => setCompany({ ...company, address_line_2: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Landmark</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.landmark || ""}
              onChange={(e) => setCompany({ ...company, landmark: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">City</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.city || ""}
              onChange={(e) => setCompany({ ...company, city: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">District</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.district || ""}
              onChange={(e) => setCompany({ ...company, district: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">State</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.state || ""}
              onChange={(e) => setCompany({ ...company, state: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Postal Code</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.postal_code || ""}
              onChange={(e) => setCompany({ ...company, postal_code: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Country</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.country || "India"}
              onChange={(e) => setCompany({ ...company, country: e.target.value })}
            />
          </div>
        </div>
      </Card>

      {/* Bank Details */}
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-semibold">Bank Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Account Holder Name</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.bank_account_name || ""}
              onChange={(e) => setCompany({ ...company, bank_account_name: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Bank Name</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.bank_name || ""}
              onChange={(e) => setCompany({ ...company, bank_name: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Branch</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.bank_branch || ""}
              onChange={(e) => setCompany({ ...company, bank_branch: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Account Number</Label>
            <Input
              className="mt-1 h-8 text-sm font-mono"
              value={company.bank_account_number || ""}
              onChange={(e) => setCompany({ ...company, bank_account_number: e.target.value })}
              placeholder="1234567890123456"
            />
          </div>
          <div>
            <Label className="text-xs">IFSC Code</Label>
            <Input
              className="mt-1 h-8 text-sm font-mono"
              value={company.ifsc_code || ""}
              onChange={(e) => setCompany({ ...company, ifsc_code: e.target.value })}
              placeholder="SBIN0001234"
            />
          </div>
          <div>
            <Label className="text-xs">UPI ID</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.upi_id || ""}
              onChange={(e) => setCompany({ ...company, upi_id: e.target.value })}
              placeholder="company@upi"
            />
          </div>
        </div>
      </Card>

      {/* Contact Emails */}
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-semibold">Contact Emails</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Billing Email</Label>
            <Input
              type="email"
              className="mt-1 h-8 text-sm"
              value={company.billing_email || ""}
              onChange={(e) => setCompany({ ...company, billing_email: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Support Email</Label>
            <Input
              type="email"
              className="mt-1 h-8 text-sm"
              value={company.support_email || ""}
              onChange={(e) => setCompany({ ...company, support_email: e.target.value })}
            />
          </div>
        </div>
      </Card>

      {/* Document Prefixes */}
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-semibold">Document Numbering Prefixes</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label className="text-xs">Invoice</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.invoice_prefix || ""}
              onChange={(e) => setCompany({ ...company, invoice_prefix: e.target.value })}
              placeholder="INV"
            />
          </div>
          <div>
            <Label className="text-xs">Credit Note</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.credit_note_prefix || ""}
              onChange={(e) => setCompany({ ...company, credit_note_prefix: e.target.value })}
              placeholder="CN"
            />
          </div>
          <div>
            <Label className="text-xs">Debit Note</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.debit_note_prefix || ""}
              onChange={(e) => setCompany({ ...company, debit_note_prefix: e.target.value })}
              placeholder="DN"
            />
          </div>
          <div>
            <Label className="text-xs">Payment</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.payment_prefix || ""}
              onChange={(e) => setCompany({ ...company, payment_prefix: e.target.value })}
              placeholder="PAY"
            />
          </div>
          <div>
            <Label className="text-xs">Receipt</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.receipt_prefix || ""}
              onChange={(e) => setCompany({ ...company, receipt_prefix: e.target.value })}
              placeholder="REC"
            />
          </div>
          <div>
            <Label className="text-xs">Purchase Order</Label>
            <Input
              className="mt-1 h-8 text-sm"
              value={company.po_prefix || ""}
              onChange={(e) => setCompany({ ...company, po_prefix: e.target.value })}
              placeholder="PO"
            />
          </div>
        </div>
      </Card>

      {/* Financial Year */}
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-semibold">Financial Year</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">Financial Year Start Month</Label>
            <Select
              value={company.financial_year_start_month?.toString() || "4"}
              onValueChange={(value) => setCompany({ ...company, financial_year_start_month: parseInt(value) })}
            >
              <SelectTrigger className="mt-1 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((month, index) => (
                  <SelectItem key={index + 1} value={(index + 1).toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Notification Settings */}
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-semibold">Notification Preferences</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Duplicate Invoice Detection</p>
              <p className="text-xs text-muted-foreground">Alert when duplicate invoice numbers are detected</p>
            </div>
            <Switch
              checked={company.notification_duplicate_invoice ?? true}
              onCheckedChange={(checked) => setCompany({ ...company, notification_duplicate_invoice: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">GST Mismatch Alerts</p>
              <p className="text-xs text-muted-foreground">Notify when GST calculations don't match</p>
            </div>
            <Switch
              checked={company.notification_gst_mismatch ?? true}
              onCheckedChange={(checked) => setCompany({ ...company, notification_gst_mismatch: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Overdue Receivables</p>
              <p className="text-xs text-muted-foreground">Alert for overdue customer payments</p>
            </div>
            <Switch
              checked={company.notification_overdue_receivable ?? true}
              onCheckedChange={(checked) => setCompany({ ...company, notification_overdue_receivable: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Overdue Payables</p>
              <p className="text-xs text-muted-foreground">Alert for overdue vendor payments</p>
            </div>
            <Switch
              checked={company.notification_overdue_payable ?? true}
              onCheckedChange={(checked) => setCompany({ ...company, notification_overdue_payable: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Concentration Risk</p>
              <p className="text-xs text-muted-foreground">Warn about customer/vendor concentration</p>
            </div>
            <Switch
              checked={company.notification_concentration_risk ?? true}
              onCheckedChange={(checked) => setCompany({ ...company, notification_concentration_risk: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">GSTR Filing Reminders</p>
              <p className="text-xs text-muted-foreground">Remind about upcoming GSTR filing deadlines</p>
            </div>
            <Switch
              checked={company.notification_gstr_reminders ?? true}
              onCheckedChange={(checked) => setCompany({ ...company, notification_gstr_reminders: checked })}
            />
          </div>
        </div>
      </Card>

      {/* Audit & Approval Settings */}
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-semibold">Audit & Approval Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Lock After Approval</p>
              <p className="text-xs text-muted-foreground">Prevent edits to approved documents</p>
            </div>
            <Switch
              checked={company.lock_after_approval ?? false}
              onCheckedChange={(checked) => setCompany({ ...company, lock_after_approval: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">Dual Approval Required</p>
              <p className="text-xs text-muted-foreground">Require two approvers for high-value transactions</p>
            </div>
            <Switch
              checked={company.dual_approval ?? false}
              onCheckedChange={(checked) => setCompany({ ...company, dual_approval: checked })}
            />
          </div>
          {company.dual_approval && (
            <div>
              <Label className="text-xs">Dual Approval Threshold (₹)</Label>
              <Input
                type="number"
                className="mt-1 h-8 text-sm"
                value={company.dual_approval_threshold || 0}
                onChange={(e) => setCompany({ ...company, dual_approval_threshold: parseFloat(e.target.value) || 0 })}
                placeholder="100000"
              />
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save All Changes
        </Button>
      </div>
    </div>
  );
}

function FinancialTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<FinancialSettings | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsApi.getFinancial();
      setSettings(data);
    } catch (error: any) {
      // Use default values if API fails
      setSettings({ fy_start_month: 4, invoice_prefix: 'INV' });
      console.warn("Using default financial settings:", error?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      await settingsApi.updateFinancial(settings);
      toast.success("Financial settings saved");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!settings) return null;

  return (
    <Card className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Financial Year Start</Label>
          <Select
            value={settings.fy_start_month.toString()}
            onValueChange={(value) => setSettings({ ...settings, fy_start_month: parseInt(value) })}
          >
            <SelectTrigger className="mt-1 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((month, index) => (
                <SelectItem key={index + 1} value={(index + 1).toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Invoice Prefix</Label>
          <Input
            className="mt-1 h-8 text-sm"
            value={settings.invoice_prefix}
            onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value })}
          />
        </div>
      </div>
      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
        Save
      </Button>
    </Card>
  );
}

function UsersTab() {
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState<UserCreateRequest>({
    email: "",
    name: "",
    phone: "",
    role: "operator",
    password: ""
  });

  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await usersApi.listUsers();
      setUsers(data.users);
    } catch (error: any) {
      // Show empty list if API fails
      setUsers([]);
      console.warn("Using empty users list:", error?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      setCreating(true);
      await usersApi.createUser(newUser);
      toast.success("User created successfully");
      setShowCreateDialog(false);
      setNewUser({ email: "", name: "", phone: "", role: "operator", password: "" });
      loadUsers();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    try {
      await usersApi.updateUser(userId, { role });
      toast.success("Role updated");
      loadUsers();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update role");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to deactivate this user?")) return;

    try {
      await usersApi.deleteUser(userId);
      toast.success("User deactivated");
      loadUsers();
    } catch (error: any) {
      toast.error(error?.message || "Failed to deactivate user");
    }
  };

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <>
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Team Members</h3>
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => setShowCreateDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          )}
        </div>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users found</p>
        ) : (
          users.map((u) => (
            <div key={u.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex-1">
                <p className="text-sm font-medium">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <Select
                    value={u.role}
                    onValueChange={(role) => handleUpdateRole(u.id, role)}
                    disabled={u.id === currentUser?.id}
                  >
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="accountant">Accountant</SelectItem>
                      <SelectItem value="operator">Operator</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    {u.role}
                  </Badge>
                )}
                {isAdmin && u.id !== currentUser?.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteUser(u.id)}
                    className="h-7 w-7 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>Add a new team member to your company</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div>
              <Label>Phone (Optional)</Label>
              <Input
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                placeholder="+91 1234567890"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={newUser.role} onValueChange={(role) => setNewUser({ ...newUser, role })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="accountant">Accountant</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Minimum 8 characters"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TaxTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<TaxSettings | null>(null);

  const GST_RATES = [5, 12, 18, 28];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsApi.getTax();
      setSettings(data);
    } catch (error: any) {
      // Use default values if API fails
      setSettings({ enabled_gst_rates: [5, 12, 18, 28] });
      console.warn("Using default tax settings:", error?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      await settingsApi.updateTax(settings);
      toast.success("Tax config saved");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const toggleRate = (rate: number) => {
    if (!settings) return;

    const enabled = settings.enabled_gst_rates.includes(rate);
    const newRates = enabled
      ? settings.enabled_gst_rates.filter((r) => r !== rate)
      : [...settings.enabled_gst_rates, rate].sort((a, b) => a - b);

    setSettings({ ...settings, enabled_gst_rates: newRates });
  };

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!settings) return null;

  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-sm font-medium">Default GST Rates</h3>
      {GST_RATES.map((rate) => (
        <div key={rate} className="flex items-center justify-between py-1">
          <span className="text-sm">{rate}% GST</span>
          <Switch
            checked={settings.enabled_gst_rates.includes(rate)}
            onCheckedChange={() => toggleRate(rate)}
          />
        </div>
      ))}
      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
        Save
      </Button>
    </Card>
  );
}

function NotificationsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsApi.getNotifications();
      setSettings(data);
    } catch (error: any) {
      // Use default values if API fails
      setSettings({
        duplicate_invoice: true,
        gst_mismatch: true,
        overdue_receivable: true,
        overdue_payable: true,
        concentration_risk: true,
        gstr_reminders: true
      });
      console.warn("Using default notification settings:", error?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      await settingsApi.updateNotifications(settings);
      toast.success("Notification settings saved");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!settings) return null;

  const notifications = [
    { key: "duplicate_invoice" as keyof NotificationSettings, label: "Duplicate invoice detection" },
    { key: "gst_mismatch" as keyof NotificationSettings, label: "GST mismatch alerts" },
    { key: "overdue_receivable" as keyof NotificationSettings, label: "Overdue receivable alerts" },
    { key: "overdue_payable" as keyof NotificationSettings, label: "Overdue payable alerts" },
    { key: "concentration_risk" as keyof NotificationSettings, label: "Concentration risk warnings" },
    { key: "gstr_reminders" as keyof NotificationSettings, label: "GSTR filing reminders" },
  ];

  return (
    <Card className="p-6 space-y-4">
      {notifications.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between py-1">
          <span className="text-sm">{label}</span>
          <Switch
            checked={settings[key]}
            onCheckedChange={(checked) => setSettings({ ...settings, [key]: checked })}
          />
        </div>
      ))}
      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
        Save
      </Button>
    </Card>
  );
}

function AuditTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<AuditSettings | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await settingsApi.getAudit();
      setSettings(data);
    } catch (error: any) {
      // Use default values if API fails
      setSettings({
        lock_after_approval: false,
        dual_approval: false,
        dual_approval_threshold: 0
      });
      console.warn("Using default audit settings:", error?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      await settingsApi.updateAudit(settings);
      toast.success("Audit settings saved");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!settings) return null;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-sm font-medium">Lock edits after approval</p>
          <p className="text-xs text-muted-foreground">Prevent modifications to approved invoices</p>
        </div>
        <Switch
          checked={settings.lock_after_approval}
          onCheckedChange={(checked) => setSettings({ ...settings, lock_after_approval: checked })}
        />
      </div>
      <div className="flex items-center justify-between py-1">
        <div>
          <p className="text-sm font-medium">Require dual approval</p>
          <p className="text-xs text-muted-foreground">Two-person approval for high-value invoices</p>
        </div>
        <Switch
          checked={settings.dual_approval}
          onCheckedChange={(checked) => setSettings({ ...settings, dual_approval: checked })}
        />
      </div>
      {settings.dual_approval && (
        <div>
          <Label className="text-xs">Dual Approval Threshold (₹)</Label>
          <Input
            type="number"
            className="mt-1 h-8 text-sm"
            value={settings.dual_approval_threshold}
            onChange={(e) => setSettings({ ...settings, dual_approval_threshold: parseFloat(e.target.value) || 0 })}
          />
        </div>
      )}
      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
        Save
      </Button>
    </Card>
  );
}
