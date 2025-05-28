import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import { Consignment } from "@shared/schema";
import { formatToAEST } from "@/lib/utils";

interface DataTableProps {
  consignments: Consignment[];
  onViewDetails: (consignment: Consignment) => void;
}

export default function DataTable({ consignments, onViewDetails }: DataTableProps) {
  const [visibleFields, setVisibleFields] = useState<string[]>([]);
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({});

  // Load settings from localStorage
  useEffect(() => {
    const savedVisible = localStorage.getItem('visible-fields');
    const savedLabels = localStorage.getItem('field-labels');
    
    if (savedVisible) {
      setVisibleFields(JSON.parse(savedVisible));
    } else {
      // Default fields that actually have data
      setVisibleFields(['shipper', 'driver']);
    }
    
    if (savedLabels) {
      setFieldLabels(JSON.parse(savedLabels));
    }
  }, []);

  const getDisplayValue = (consignment: Consignment, fieldKey: string): string => {
    const value = (consignment as any)[fieldKey];
    
    if (!value) return '-';
    
    // Handle JSON/array fields
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `${value.length} items`;
      }
      return 'Object data';
    }
    
    // Handle dates
    if (fieldKey.includes('date') || fieldKey.includes('eta')) {
      return formatToAEST(value);
    }
    
    return String(value);
  };

  const getFieldLabel = (fieldKey: string): string => {
    if (fieldLabels[fieldKey]) {
      return fieldLabels[fieldKey];
    }
    // Convert snake_case to Title Case
    return fieldKey
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (visibleFields.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No columns selected for display.</p>
        <p className="text-sm mt-2">Go to Settings to choose which columns to show.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {visibleFields.map((fieldKey) => (
              <TableHead key={fieldKey} className="font-semibold whitespace-nowrap">
                {getFieldLabel(fieldKey)}
              </TableHead>
            ))}
            <TableHead className="w-20">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {consignments.map((consignment) => (
            <TableRow key={consignment.id} className="hover:bg-gray-50">
              {visibleFields.map((fieldKey) => (
                <TableCell key={fieldKey} className="max-w-48">
                  <div className="truncate" title={getDisplayValue(consignment, fieldKey)}>
                    {getDisplayValue(consignment, fieldKey)}
                  </div>
                </TableCell>
              ))}
              <TableCell>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewDetails(consignment)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}