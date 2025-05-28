import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye } from "lucide-react";
import { Consignment } from "@shared/schema";

interface DashboardTableProps {
  consignments: Consignment[];
  onViewDetails: (consignment: Consignment) => void;
}

export default function DashboardTable({ consignments, onViewDetails }: DashboardTableProps) {
  // Fixed columns matching your screenshot exactly
  const columns = [
    { key: 'pickup_outcome', label: 'Status' },
    { key: 'recorded_temperature', label: 'Temperature' },
    { key: 'origin', label: 'From' },
    { key: 'destination', label: 'To' },
    { key: 'trip_number', label: 'Reference #' },
    { key: 'quantity', label: 'Cartons' },
    { key: 'pallets', label: 'Pallets' },
    { key: 'pickup_planned_eta', label: 'Planned ETA' },
    { key: 'pickup_calculated_eta', label: 'Live ETA' }
  ];

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

  return (
    <div className="rounded-lg border shadow-sm bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            {columns.map((column) => (
              <TableHead key={column.key} className="font-semibold text-gray-700">
                {column.label}
              </TableHead>
            ))}
            <TableHead className="font-semibold text-gray-700">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {consignments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="text-center py-8 text-gray-500">
                No consignments found
              </TableCell>
            </TableRow>
          ) : (
            consignments.map((consignment) => (
              <TableRow key={consignment.id} className="hover:bg-gray-50">
                {columns.map((column) => (
                  <TableCell key={column.key} className="py-3">
                    {getFieldValue(consignment, column.key)}
                  </TableCell>
                ))}
                <TableCell className="py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewDetails(consignment)}
                    className="h-8 w-8 p-0"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}