import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, Plus, FileText, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";

const RETURN_GROUPS = [
  {
    group: "Monthly Returns",
    items: [
      { id: "G1", name: "GSTR-1 (Outward Supplies)", period: "Dec 2024", due: "11 Jan 2025", status: "pending", taxable: 8924500, tax: 991800 },
      { id: "G2", name: "GSTR-3B (Summary Return)", period: "Dec 2024", due: "20 Jan 2025", status: "ready", taxable: 8924500, tax: 541800 },
    ],
  },
  {
    group: "Reconciliation Reports",
    items: [
      { id: "R1", name: "GSTR-2B Reconciliation", period: "Dec 2024", due: "—", status: "action", taxable: 0, tax: 0 },
      { id: "R2", name: "ITC Utilization Report", period: "Dec 2024", due: "—", status: "ready", taxable: 0, tax: 0 },
    ],
  },
  {
    group: "Annual / Quarterly",
    items: [
      { id: "A1", name: "GSTR-9 (Annual Return)", period: "FY 2023-24", due: "31 Dec 2024", status: "filed", taxable: 0, tax: 0 },
      { id: "A2", name: "GSTR-9C (Reconciliation)", period: "FY 2023-24", due: "31 Dec 2024", status: "filed", taxable: 0, tax: 0 },
    ],
  },
];

const statusBadge = (s: string) => {
  if (s === "filed") return { cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" />, label: "Filed" };
  if (s === "ready") return { cls: "bg-blue-100 text-blue-700 border-blue-200", icon: <CheckCircle2 className="h-3 w-3" />, label: "Ready to file" };
  if (s === "action") return { cls: "bg-red-100 text-red-700 border-red-200", icon: <AlertTriangle className="h-3 w-3" />, label: "Action needed" };
  return { cls: "bg-amber-100 text-amber-700 border-amber-200", icon: <Clock className="h-3 w-3" />, label: "In progress" };
};

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function GSTReports() {
  const [generating, setGenerating] = useState(false);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">GST Filing Center</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Prepare, review, and file GST returns · Dec 2024</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => toast.info("Downloading all reports…")}>
            <Download className="h-3.5 w-3.5" /> Export All
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => { setGenerating(true); setTimeout(() => { setGenerating(false); toast.success("Reports regenerated"); }, 1500); }}>
            <Plus className="h-3.5 w-3.5" /> {generating ? "Generating…" : "Generate Reports"}
          </Button>
        </div>
      </div>

      {/* Filing readiness summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Filed", val: "2", cls: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
          { label: "Ready to File", val: "2", cls: "text-blue-600", bg: "" },
          { label: "Pending Action", val: "1", cls: "text-red-600", bg: "bg-red-50 border-red-200" },
          { label: "In Progress", val: "1", cls: "text-amber-600", bg: "" },
        ].map((s, i) => (
          <Card key={i} className={`p-3 ${s.bg}`}>
            <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${s.cls}`}>{s.val}</p>
          </Card>
        ))}
      </div>

      {/* Return Groups */}
      {RETURN_GROUPS.map((group) => (
        <section key={group.group}>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">{group.group}</h2>
          <div className="space-y-2">
            {group.items.map((item) => {
              const badge = statusBadge(item.status);
              return (
                <Card key={item.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                        <FileText className="h-4.5 w-4.5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{item.name}</p>
                          <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium ${badge.cls}`}>
                            {badge.icon} {badge.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">{item.period}</span>
                          {item.due !== "—" && (
                            <>
                              <span className="text-muted-foreground text-[10px]">·</span>
                              <span className="text-xs text-muted-foreground">Due {item.due}</span>
                            </>
                          )}
                          {item.taxable > 0 && (
                            <>
                              <span className="text-muted-foreground text-[10px]">·</span>
                              <span className="text-xs text-muted-foreground">Taxable: {fmt(item.taxable)} · Tax: {fmt(item.tax)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => toast.info(`Downloading ${item.name}…`)}>
                        <Download className="h-3.5 w-3.5" /> Download
                      </Button>
                      {item.status !== "filed" && (
                        <Button size="sm" className="text-xs" onClick={() => toast.success(`${item.name} filed successfully`)}>
                          {item.status === "action" ? "Resolve & File" : "File Now"}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ))}

      {/* Generate Custom Report */}
      <Card className="p-4 border-dashed">
        <h3 className="text-sm font-medium mb-3">Generate Custom Report</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Period</Label>
            <Select defaultValue="dec24">
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dec24">Dec 2024</SelectItem>
                <SelectItem value="nov24">Nov 2024</SelectItem>
                <SelectItem value="q3fy25">Q3 FY2025</SelectItem>
                <SelectItem value="fy2425">FY 2024-25 (YTD)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Report Type</Label>
            <Select defaultValue="gstr1">
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gstr1">GSTR-1</SelectItem>
                <SelectItem value="gstr3b">GSTR-3B</SelectItem>
                <SelectItem value="input">Input Register</SelectItem>
                <SelectItem value="recon">Reconciliation</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Format</Label>
            <Select defaultValue="pdf">
              <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="excel">Excel</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button size="sm" className="mt-3 gap-1.5 text-xs" onClick={() => toast.success("Custom report generation started")}>
          <Plus className="h-3.5 w-3.5" /> Generate Custom Report
        </Button>
      </Card>
    </div>
  );
}
