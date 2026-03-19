import {
  Home, Upload, PenLine, FileText, BarChart3, Users, Clock,
  Receipt, TrendingUp, UserCheck, ChevronDown,
  LayoutDashboard, GitCompare, FileBarChart,
  PieChart, FileOutput, Settings, ShoppingCart, DollarSign,
  Building2, Plus, TrendingUp as TrendingUpIcon, Users as UsersIcon,
  Package, FolderTree, Lock,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
 import {
   Sidebar,
   SidebarContent,
   SidebarFooter,
   SidebarGroup,
   SidebarGroupContent,
   SidebarGroupLabel,
   SidebarHeader,
   SidebarMenu,
   SidebarMenuButton,
   SidebarMenuItem,
   useSidebar,
 } from "@/components/ui/sidebar";
 import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import logo from "../../../favicon_io/logo.png";

const navGroups = [
  {
    label: null,
    items: [{ title: "Home", url: "/app/home", icon: Home }],
  },
    {
    label: "Purchases",
    icon: ShoppingCart,
    items: [
      { title: "Upload Bill", url: "/app/purchases/upload", icon: Upload },
      { title: "Manual Entry", url: "/app/purchases/manual", icon: PenLine },
      { title: "Purchase Register", url: "/app/purchases/register", icon: FileText },
      { title: "Purchase KPIs", url: "/app/purchases/kpis", icon: BarChart3 },
      { title: "Vendor Analytics", url: "/app/purchases/vendors", icon: Users },
      { title: "Payables & Aging", url: "/app/purchases/payables", icon: Clock },
    ],
  },
  {
    label: "Parties",
    icon: Building2,
    items: [
      { title: "All Parties", url: "/app/parties", icon: UsersIcon },
      { title: "Suppliers", url: "/app/parties/suppliers", icon: ShoppingCart },
      { title: "Customers", url: "/app/parties/customers", icon: DollarSign },
      { title: "Analytics", url: "/app/parties/analytics", icon: TrendingUpIcon },
    ],
  },
  {
    label: "Products",
    icon: Package,
    items: [
      { title: "All Products", url: "/app/products", icon: Package },
      { title: "Categories", url: "/app/products/categories", icon: FolderTree },
    ],
  },
  {
    label: "Sales",
    icon: DollarSign,
    items: [
      { title: "Generate Invoice", url: "/app/sales/invoice", icon: Receipt },
      { title: "Sales Register", url: "/app/sales/register", icon: FileText },
      { title: "Sales KPIs", url: "/app/sales/kpis", icon: TrendingUp },
      { title: "Customer Analytics", url: "/app/sales/customers", icon: UserCheck },
      { title: "Receivables & Aging", url: "/app/sales/receivables", icon: Clock },
    ],
  },
  {
    label: "GST",
    icon: FileBarChart,
    locked: true,
    items: [
      { title: "GST Dashboard", url: "/app/gst/dashboard", icon: LayoutDashboard, locked: true },
      { title: "Reconciliation", url: "/app/gst/reconciliation", icon: GitCompare, locked: true },
      { title: "GST Reports", url: "/app/gst/reports", icon: FileBarChart, locked: true },
    ],
  },
  {
    label: null,
    items: [
      { title: "Analysis", url: "/app/analysis", icon: PieChart },
      { title: "Reports", url: "/app/reports", icon: FileOutput, locked: true },
      { title: "Settings", url: "/app/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="p-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <img src={logo} alt="The Airco Billsage" className="h-8 w-8 rounded-lg object-contain bg-white" />
            <div>
              <p className="text-sm font-semibold text-sidebar-accent-foreground">The Airco Billsage</p>
              <p className="text-xs text-sidebar-muted">Smart Business Management</p>
            </div>
          </div>
        )}
        {collapsed && (
          <img src={logo} alt="The Airco Billsage" className="h-8 w-8 rounded-lg object-contain bg-white mx-auto" />
        )}
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group, gi) => {
          if (group.label) {
            const isGroupActive = group.items.some((i) => currentPath.startsWith(i.url));
            return (
              <Collapsible key={gi} defaultOpen={isGroupActive || gi < 3} className="group/collapsible">
                <SidebarGroup>
                  <CollapsibleTrigger asChild>
                    <SidebarGroupLabel className="cursor-pointer hover:text-sidebar-accent-foreground transition-colors">
                      {!collapsed && (
                        <>
                          {group.label}
                          {(group as any).locked && <Lock className="ml-1 h-3 w-3 text-muted-foreground" />}
                          <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                        </>
                      )}
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {group.items.map((item) => {
                          const isLocked = (item as any).locked;
                          return (
                            <SidebarMenuItem key={item.url}>
                              <SidebarMenuButton 
                                asChild={!isLocked} 
                                isActive={currentPath === item.url}
                                className={isLocked ? "opacity-50 cursor-not-allowed" : ""}
                                onClick={isLocked ? (e: React.MouseEvent) => e.preventDefault() : undefined}
                              >
                                {isLocked ? (
                                  <div className="flex items-center gap-2 px-2 py-1.5">
                                    <item.icon className="h-4 w-4" />
                                    {!collapsed && <span>{item.title}</span>}
                                    {!collapsed && <Lock className="ml-auto h-3 w-3 text-muted-foreground" />}
                                  </div>
                                ) : (
                                  <NavLink to={item.url} end>
                                    <item.icon className="h-4 w-4" />
                                    {!collapsed && <span>{item.title}</span>}
                                  </NavLink>
                                )}
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          }

          return (
            <SidebarGroup key={gi}>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const isLocked = (item as any).locked;
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton 
                          asChild={!isLocked} 
                          isActive={currentPath === item.url}
                          className={isLocked ? "opacity-50 cursor-not-allowed" : ""}
                          onClick={isLocked ? (e: React.MouseEvent) => e.preventDefault() : undefined}
                        >
                          {isLocked ? (
                            <div className="flex items-center gap-2 px-2 py-1.5">
                              <item.icon className="h-4 w-4" />
                              {!collapsed && <span>{item.title}</span>}
                              {!collapsed && <Lock className="ml-auto h-3 w-3 text-muted-foreground" />}
                            </div>
                          ) : (
                            <NavLink to={item.url} end>
                              <item.icon className="h-4 w-4" />
                              {!collapsed && <span>{item.title}</span>}
                            </NavLink>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="p-3">
        {!collapsed && (
          <p className="text-[10px] text-sidebar-muted text-center">v1.0.0 · FY 2024-25</p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
