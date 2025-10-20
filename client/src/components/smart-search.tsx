import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface SmartSearchProps {
  value: string;
  onChange: (value: string) => void;
  resultCount?: number;
}

export function SmartSearch({ value, onChange, resultCount }: SmartSearchProps) {
  const [isFocused, setIsFocused] = useState(false);
  
  const searchFields = [
    { label: "Consignment #", icon: "📦" },
    { label: "Order Ref", icon: "🔖" },
    { label: "Driver", icon: "🚚" },
    { label: "Customer", icon: "🏢" },
    { label: "City", icon: "📍" }
  ];

  return (
    <div className="flex-1">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        Smart Search
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
        <Input
          placeholder="Search across all fields..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          className="pl-10 pr-10"
          data-testid="input-search"
        />
        {value && (
          <button
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10"
            data-testid="button-clear-search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        
        {/* Search Field Indicators - Show on focus or when searching */}
        {(isFocused || value) && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-20 animate-in fade-in slide-in-from-top-1">
            <div className="flex flex-col gap-2">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Searching across:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {searchFields.map((field) => (
                  <Badge 
                    key={field.label}
                    variant="outline" 
                    className="text-xs bg-blue-50 text-blue-700 border-blue-200"
                  >
                    <span className="mr-1">{field.icon}</span>
                    {field.label}
                  </Badge>
                ))}
              </div>
              {value && resultCount !== undefined && (
                <div className="text-xs text-gray-500 mt-1 pt-2 border-t border-gray-100">
                  Found <span className="font-semibold text-blue-600">{resultCount}</span> matching deliveries
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
