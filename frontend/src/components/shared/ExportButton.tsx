import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

interface ExportButtonProps {
  label?: string;
  data?: any[];
  filename?: string;
  columns?: { key: string; header: string }[];
}

export function ExportButton({ 
  label = "Export CSV", 
  data = [], 
  filename = "export",
  columns 
}: ExportButtonProps) {
  
  const handleExport = () => {
    if (!data || data.length === 0) {
      toast.error("No data to export");
      return;
    }

    try {
      // Determine columns from data if not provided
      const exportColumns = columns || Object.keys(data[0]).map(key => ({ key, header: key }));
      
      // Create CSV header
      const headers = exportColumns.map(col => col.header).join(',');
      
      // Create CSV rows
      const rows = data.map(item => 
        exportColumns.map(col => {
          const value = item[col.key];
          // Handle values with commas, quotes, or newlines
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      ).join('\n');
      
      const csvContent = `${headers}\n${rows}`;
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("Export completed", { description: `${data.length} records exported to CSV.` });
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Export failed", { description: "Could not generate CSV file." });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 text-xs"
      onClick={handleExport}
    >
      <Download className="h-3.5 w-3.5 mr-1.5" />
      {label}
    </Button>
  );
}
