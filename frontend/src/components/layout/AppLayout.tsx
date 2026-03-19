import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { useAuth } from "@/context/AuthContext";
import { Routes, Route } from "react-router-dom";
import { Outlet } from "react-router-dom";

// Import all the page components
import Home from "@/pages/Home";
import PurchaseRegister from "@/pages/purchases/PurchaseRegister";
import PurchaseKPIs from "@/pages/purchases/PurchaseKPIs";
import UploadBill from "@/pages/purchases/UploadBill";
import ManualPurchaseEntry from "@/pages/purchases/ManualPurchaseEntry";
import VendorAnalytics from "@/pages/purchases/VendorAnalytics";
import PurchaseDetail from "@/pages/purchases/PurchaseDetail";
import PayablesAging from "@/pages/purchases/PayablesAging";
import GenerateInvoice from "@/pages/sales/GenerateInvoice";
import SalesRegister from "@/pages/sales/SalesRegister";
import SalesKPIs from "@/pages/sales/SalesKPIs";
import CustomerAnalytics from "@/pages/sales/CustomerAnalytics";
import ReceivablesAging from "@/pages/sales/ReceivablesAging";
import SaleDetail from "@/pages/sales/SaleDetail";
import GSTDashboard from "@/pages/gst/GSTDashboard";
import Reconciliation from "@/pages/gst/Reconciliation";
import GSTReports from "@/pages/gst/GSTReports";
import Analysis from "@/pages/Analysis";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import PartyList from "@/pages/parties/PartyList";
import PartyProfile from "@/pages/parties/PartyProfile";
import PartySuppliers from "@/pages/parties/PartySuppliers";
import PartyCustomers from "@/pages/parties/PartyCustomers";
import PartyAnalytics from "@/pages/parties/PartyAnalytics";
import AddParty from "@/pages/parties/AddParty";
import ProductList from "@/pages/products/ProductList";
import ProductForm from "@/pages/products/ProductForm";
import ProductDetail from "@/pages/products/ProductDetail";
import CategoryManagement from "@/pages/products/CategoryManagement";

export function AppLayout() {
  const { user } = useAuth();

  // No company onboarding - company is automatically loaded from session
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 p-6 overflow-auto">
            <Routes>
              {/* Home */}
              <Route path="home" element={<Home />} />
                
                                
                {/* Purchases */}
                <Route path="purchases/upload" element={<UploadBill />} />
                <Route path="purchases/manual" element={<ManualPurchaseEntry />} />
                <Route path="purchases/:id/edit" element={<ManualPurchaseEntry />} />
                <Route path="purchases/register" element={<PurchaseRegister />} />
                <Route path="purchases/:id" element={<PurchaseDetail />} />
                <Route path="purchases/kpis" element={<PurchaseKPIs />} />
                <Route path="purchases/vendors" element={<VendorAnalytics />} />
                <Route path="purchases/payables" element={<PayablesAging />} />
                
                {/* Parties */}
                <Route path="parties" element={<PartyList />} />
                <Route path="parties/suppliers" element={<PartySuppliers />} />
                <Route path="parties/customers" element={<PartyCustomers />} />
                <Route path="parties/analytics" element={<PartyAnalytics />} />
                <Route path="parties/new" element={<AddParty />} />
                <Route path="parties/:partyId" element={<PartyProfile />} />
                <Route path="parties/:partyId/edit" element={<div>Edit Party - Coming Soon</div>} />
                
                {/* Products */}
                <Route path="products" element={<ProductList />} />
                <Route path="products/new" element={<ProductForm />} />
                <Route path="products/categories" element={<CategoryManagement />} />
                <Route path="products/:id" element={<ProductDetail />} />
                <Route path="products/:id/edit" element={<ProductForm />} />
                
                {/* Sales */}
                <Route path="sales/invoice" element={<GenerateInvoice />} />
                <Route path="sales/register" element={<SalesRegister />} />
                <Route path="sales/:id" element={<SaleDetail />} />
                <Route path="sales/kpis" element={<SalesKPIs />} />
                <Route path="sales/customers" element={<CustomerAnalytics />} />
                <Route path="sales/receivables" element={<ReceivablesAging />} />
                
                {/* GST */}
                <Route path="gst/dashboard" element={<GSTDashboard />} />
                <Route path="gst/reconciliation" element={<Reconciliation />} />
                <Route path="gst/reports" element={<GSTReports />} />
                
                {/* Analytics */}
                <Route path="analysis" element={<Analysis />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
                
                {/* Default redirect */}
                <Route path="*" element={<Home />} />
              </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
