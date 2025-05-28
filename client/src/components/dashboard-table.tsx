import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye } from "lucide-react";
import { Consignment } from "@shared/schema";

interface DashboardTableProps {
  consignments: Consignment[];
  onViewDetails: (consignment: Consignment) => void;
}

export default function DashboardTable({ consignments, onViewDetails }: DashboardTableProps) {
  const [visibleFields, setVisibleFields] = useState<string[]>([]);
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = () => {
      try {
        // Load saved visible fields
        const savedVisible = localStorage.getItem('visible-fields');
        if (savedVisible) {
          setVisibleFields(JSON.parse(savedVisible));
        } else {
          // Default to fields that actually have data
          setVisibleFields(['shipper', 'driver']);
        }

        // Load saved field labels
        const savedLabels = localStorage.getItem('field-labels');
        if (savedLabels) {
          setFieldLabels(JSON.parse(savedLabels));
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        // Fallback to default fields
        setVisibleFields(['shipper', 'driver']);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

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

  const getFieldValue = (consignment: Consignment, fieldKey: string): string => {
    const value = (consignment as any)[fieldKey];
    
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    // Handle JSON strings or objects
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `${value.length} items`;
      }
      return 'Data';
    }

    // Handle JSON strings
    if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return `${parsed.length} events`;
        }
        return 'JSON data';
      } catch {
        return value;
      }
    }

    return String(value);
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p>Loading table settings...</p>
      </div>
    );
  }

  if (visibleFields.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-lg mb-2">No columns selected for display</p>
        <p className="text-sm">Visit Settings to choose which columns to show in your dashboard</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              {visibleFields.map((fieldKey) => (
                <TableHead key={fieldKey} className="font-semibold text-gray-700 whitespace-nowrap px-4 py-3">
                  {getFieldLabel(fieldKey)}
                </TableHead>
              ))}
              <TableHead className="w-20 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {consignments.length > 0 ? (
              consignments.map((consignment) => (
                <TableRow key={consignment.id} className="hover:bg-gray-50">
                  {visibleFields.map((fieldKey) => (
                    <TableCell key={fieldKey} className="px-4 py-3 max-w-48">
                      <div className="truncate" title={getFieldValue(consignment, fieldKey)}>
                        {getFieldValue(consignment, fieldKey)}
                      </div>
                    </TableCell>
                  ))}
                  <TableCell className="px-4 py-3 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewDetails(consignment)}
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell 
                  colSpan={visibleFields.length + 1} 
                  className="text-center py-8 text-gray-500"
                >
                  No consignments found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}