import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { PartyProvider } from "@/hooks/usePartyStore";

// Public pages
import Landing from "./pages/Landing";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup.tsx";

// Protected pages
import Home from "./pages/Home";
import PurchaseRegister from "./pages/purchases/PurchaseRegister";
import PurchaseKPIs from "./pages/purchases/PurchaseKPIs";
import UploadBill from "./pages/purchases/UploadBill";
import ManualPurchaseEntry from "./pages/purchases/ManualPurchaseEntry";
import VendorAnalytics from "./pages/purchases/VendorAnalytics";
import PayablesAging from "./pages/purchases/PayablesAging";
import GenerateInvoice from "./pages/sales/GenerateInvoice";
import SalesRegister from "./pages/sales/SalesRegister";
import SalesKPIs from "./pages/sales/SalesKPIs";
import CustomerAnalytics from "./pages/sales/CustomerAnalytics";
import ReceivablesAging from "./pages/sales/ReceivablesAging";
import GSTDashboard from "./pages/gst/GSTDashboard";
import Reconciliation from "./pages/gst/Reconciliation";
import GSTReports from "./pages/gst/GSTReports";
import Analysis from "./pages/Analysis";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/auth/login" element={<Login />} />
      <Route path="/auth/signup" element={<Signup />} />
      
      {/* Protected routes */}
      <Route path="/app/*" element={
        <ProtectedRoute>
          <PartyProvider>
            <AppLayout />
          </PartyProvider>
        </ProtectedRoute>
      } />
      
      {/* Redirect old routes to new structure */}
      <Route path="/purchases/*" element={<Navigate to="/app/purchases" replace />} />
      <Route path="/sales/*" element={<Navigate to="/app/sales" replace />} />
      <Route path="/gst/*" element={<Navigate to="/app/gst" replace />} />
      
      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
