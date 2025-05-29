import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, ExternalLink, GripVertical, ChevronLeft, ChevronRight } from "lucide-react";
import { Consignment } from "@shared/schema";
import { useState } from "react";

interface DashboardTableProps {
  consignments: Consignment[];
  onViewDetails: (consignment: Consignment) => void;
}

export default function DashboardTable({ consignments, onViewDetails }: DashboardTableProps) {
  // Column configuration for real Chill Transport Company data
  const [columns, setColumns] = useState([
    { key: 'consignmentNo', label: 'Consignment #' },
    { key: 'shipperCompanyName', label: 'Customer Name' },
    { key: 'shipFromCity', label: 'Pickup From' },
    { key: 'shipToCity', label: 'Deliver To' },
    { key: 'qty2', label: 'Pallets' },
    { key: 'qty1', label: 'Cartons' },
    { key: 'delivery_PlannedETA', label: 'ETA' }
  ]);

  const [draggedColumn, setDraggedColumn] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedColumn(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedColumn === null || draggedColumn === dropIndex) {
      setDraggedColumn(null);
      return;
    }

    const newColumns = [...columns];
    const draggedItem = newColumns[draggedColumn];
    
    // Remove the dragged item
    newColumns.splice(draggedColumn, 1);
    
    // Insert at new position
    newColumns.splice(dropIndex, 0, draggedItem);
    
    setColumns(newColumns);
    setDraggedColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
  };

  // Calculate pagination
  const totalPages = Math.ceil(consignments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentConsignments = consignments.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const getFieldValue = (consignment: Consignment, fieldKey: string): string => {
    let value = (consignment as any)[fieldKey];
    
    // Special handling for consignment number - use fallback logic if needed
    if (fieldKey === 'consignmentNo') {
      value = value || consignment.orderNumberRef || `REF-${consignment.id}`;
    }
    
    // Special handling for ETA - use pickup or delivery ETA based on the order type
    if (fieldKey === 'delivery_PlannedETA') {
      // Use delivery ETA if available, otherwise use pickup ETA for pickup orders
      value = consignment.delivery_PlannedETA || consignment.pickUp_PlannedETA;
    }
    

    
    if (value === null || value === undefined || value === '') {
      return '-';
    }

    // Handle ETA fields - format ISO dates to Australian format
    if (fieldKey === 'delivery_PlannedETA' && typeof value === 'string') {
      try {
        const date = new Date(value);
        return date.toLocaleString('en-AU', {
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

    // Handle status with color coding
    if (fieldKey === 'status') {
      return String(value);
    }

    // Handle temperature zones
    if (fieldKey === 'temperatureZone') {
      return String(value);
    }

    // Handle tracking links
    if (fieldKey === 'trackingLink') {
      return value ? 'Available' : '-';
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

    // Add status badges for better visibility
    if (column.key === 'status') {
      const statusColor = value === 'Delivered' ? 'bg-green-100 text-green-800' :
                         value === 'Picked Up' ? 'bg-blue-100 text-blue-800' :
                         'bg-yellow-100 text-yellow-800';
      return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
          {value}
        </span>
      );
    }

    // Add temperature zone styling
    if (column.key === 'temperatureZone') {
      const tempColor = value?.includes('Frozen') ? 'text-blue-600' :
                       value?.includes('Chilled') ? 'text-green-600' :
                       'text-gray-600';
      return (
        <span className={`font-medium ${tempColor}`}>
          {value}
        </span>
      );
    }
    
    return getFieldValue(consignment, column.key);
  };

  return (
    <div className="rounded-lg border shadow-sm bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            {columns.map((column, index) => (
              <TableHead 
                key={column.key} 
                className={`font-semibold text-gray-700 cursor-move select-none ${
                  draggedColumn === index ? 'opacity-50' : ''
                }`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-gray-400" />
                  {column.label}
                </div>
              </TableHead>
            ))}
            <TableHead className="font-semibold text-gray-700">View Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {currentConsignments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="text-center py-8 text-gray-500">
                No consignments found
              </TableCell>
            </TableRow>
          ) : (
            currentConsignments.map((consignment) => (
              <TableRow key={consignment.id} className="hover:bg-gray-50">
                {columns.map((column) => (
                  <TableCell key={column.key} className="py-3">
                    {renderCellContent(consignment, column)}
                  </TableCell>
                ))}
                <TableCell className="py-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewDetails(consignment)}
                    className="h-8 px-3 text-blue-600 hover:text-blue-800 hover:bg-blue-50 border-blue-200"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      
      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1} to {Math.min(endIndex, consignments.length)} of {consignments.length} consignments
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-8"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            
            <div className="flex items-center gap-1">
              {/* Show page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => goToPage(pageNum)}
                    className="h-8 w-8 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-8"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}