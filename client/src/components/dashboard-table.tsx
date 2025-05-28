import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, ExternalLink } from "lucide-react";
import { Consignment } from "@shared/schema";

interface DashboardTableProps {
  consignments: Consignment[];
  onViewDetails: (consignment: Consignment) => void;
}

export default function DashboardTable({ consignments, onViewDetails }: DashboardTableProps) {
  // Fixed columns using correct field names from database
  const columns = [
    { key: 'pickupLivetrackLink', label: 'Tracking link' },
    { key: 'origin', label: 'Pickup from' },
    { key: 'documentString2', label: 'Deliver to' },
    { key: 'customerOrderNumber', label: 'Reference' },
    { key: 'pickupCalculatedEta', label: 'ETA' },
    { key: 'shipper', label: 'Customer Name' },
    { key: 'pickupOutcomeDate', label: 'Delivered on' },
    { key: 'pickupOutcome', label: 'Status' }
  ];

  const getFieldValue = (consignment: Consignment, fieldKey: string): string => {
    const value = (consignment as any)[fieldKey];
    
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    // Handle ETA fields - convert from Excel serial date to AEST
    if (fieldKey === 'pickupCalculatedEta' && typeof value === 'string') {
      try {
        const excelDate = parseFloat(value);
        // Excel serial date to JavaScript date (Excel epoch is 1900-01-01, but adjusted for leap year bug)
        const jsDate = new Date((excelDate - 25569) * 86400 * 1000);
        // Convert to AEST (UTC+10)
        const aestDate = new Date(jsDate.getTime() + (10 * 60 * 60 * 1000));
        return aestDate.toLocaleString('en-AU', {
          timeZone: 'Australia/Sydney',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return String(value);
      }
    }

    // Handle date fields - convert from Excel serial date to AEST
    if (fieldKey === 'pickupOutcomeDate' && typeof value === 'string') {
      try {
        const excelDate = parseFloat(value);
        const jsDate = new Date((excelDate - 25569) * 86400 * 1000);
        const aestDate = new Date(jsDate.getTime() + (10 * 60 * 60 * 1000));
        return aestDate.toLocaleDateString('en-AU', {
          timeZone: 'Australia/Sydney',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
      } catch {
        return String(value);
      }
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

  const renderCellContent = (consignment: Consignment, column: { key: string; label: string }) => {
    const value = (consignment as any)[column.key];
    
    // Render tracking link as a button
    if (column.key === 'pickupLivetrackLink' && value && value !== '-') {
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(value, '_blank')}
          className="h-8 px-3 text-blue-600 hover:text-blue-800 hover:bg-blue-50 border-blue-200"
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Track
        </Button>
      );
    }
    
    return getFieldValue(consignment, column.key);
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
                    {renderCellContent(consignment, column)}
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