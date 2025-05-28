import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import { Consignment } from "@shared/schema";
import { formatToAEST } from "@/lib/utils";

interface ConsignmentTableProps {
  consignments: Consignment[];
  onViewDetails: (consignment: Consignment) => void;
}

// Default field labels using database column names
const DEFAULT_FIELD_LABELS: Record<string, string> = {
  consignment_number: "Consignment Number",
  customer_name: "Customer Name",
  delivery_address: "Delivery Address",
  pickup_address: "Pickup Address",
  status: "Status",
  estimated_delivery_date: "Estimated Delivery Date",
  temperature_zone: "Temperature Zone",
  vehicle_code: "Vehicle Code",
  delivery_planned_eta: "Delivery Planned ETA",
  carrier: "Carrier",
  driver: "Driver",
  from: "From",
  to: "To",
  delivery_outcome: "Delivery Outcome",
  expected_temperature: "Expected Temperature",
  weight_kg: "Weight (kg)",
  quantity: "Quantity"
};

// Default visible fields for dashboard
const DEFAULT_VISIBLE_FIELDS = [
  'consignment_number',
  'customer_name', 
  'delivery_address',
  'status',
  'estimated_delivery_date',
  'temperature_zone',
  'vehicle_code',
  'carrier'
];

export default function ConsignmentTable({ consignments, onViewDetails }: ConsignmentTableProps) {
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>(DEFAULT_FIELD_LABELS);
  const [visibleFields, setVisibleFields] = useState<string[]>(DEFAULT_VISIBLE_FIELDS);

  // Load settings from localStorage
  useEffect(() => {
    const savedLabels = localStorage.getItem('field-labels');
    const savedVisible = localStorage.getItem('visible-fields');
    
    if (savedLabels) {
      setFieldLabels({ ...DEFAULT_FIELD_LABELS, ...JSON.parse(savedLabels) });
    }
    
    if (savedVisible) {
      setVisibleFields(JSON.parse(savedVisible));
    }
  }, []);

  const getFieldValue = (consignment: Consignment, fieldKey: string): string => {
    const value = (consignment as any)[fieldKey];
    
    // Handle date formatting
    if (fieldKey.toLowerCase().includes('date') || fieldKey.toLowerCase().includes('eta')) {
      return value ? formatToAEST(value) : '-';
    }
    
    // Handle null/undefined values
    return value || '-';
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return 'default';
      case 'in transit':
        return 'secondary';
      case 'delayed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            {visibleFields.map((fieldKey) => (
              <TableHead key={fieldKey} className="font-semibold">
                {fieldLabels[fieldKey] || fieldKey}
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
                  {fieldKey === 'status' ? (
                    <Badge variant={getStatusBadgeVariant(getFieldValue(consignment, fieldKey))}>
                      {getFieldValue(consignment, fieldKey)}
                    </Badge>
                  ) : fieldKey === 'temperature_zone' ? (
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor: 
                            getFieldValue(consignment, fieldKey) === 'Chiller' ? '#3b82f6' :
                            getFieldValue(consignment, fieldKey) === 'Freezer' ? '#1e40af' :
                            getFieldValue(consignment, fieldKey) === 'Dry' ? '#f59e0b' : '#6b7280'
                        }}
                      />
                      <span className="text-sm">{getFieldValue(consignment, fieldKey)}</span>
                    </div>
                  ) : (
                    <div className="truncate" title={getFieldValue(consignment, fieldKey)}>
                      {getFieldValue(consignment, fieldKey)}
                    </div>
                  )}
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