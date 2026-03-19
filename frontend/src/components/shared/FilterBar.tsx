import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

interface FilterOption {
  label: string;
  value: string;
}

interface FilterConfig {
  key: string;
  label: string;
  type: "select" | "search";
  options?: FilterOption[];
  placeholder?: string;
}

interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
}

export function FilterBar({ filters, values, onChange, onClear }: FilterBarProps) {
  const hasActive = Object.values(values).some((v) => v && v !== "all");

  return (
    <div className="flex items-center gap-3 flex-wrap mb-4">
      {filters.map((f) =>
        f.type === "search" ? (
          <div key={f.key} className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={f.placeholder || `Search ${f.label}...`}
              className="h-8 pl-8 w-48 text-sm"
              value={values[f.key] || ""}
              onChange={(e) => onChange(f.key, e.target.value)}
            />
          </div>
        ) : (
          <Select
            key={f.key}
            value={values[f.key] || "all"}
            onValueChange={(v) => onChange(f.key, v)}
          >
            <SelectTrigger className="h-8 w-[150px] text-sm">
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {f.label}</SelectItem>
              {f.options?.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      )}
      {hasActive && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClear}>
          <X className="h-3 w-3 mr-1" /> Clear
        </Button>
      )}
    </div>
  );
}
