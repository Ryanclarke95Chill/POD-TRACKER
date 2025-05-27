import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, Check, X } from "lucide-react";
import * as XLSX from 'xlsx';

const SYSTEM_FIELDS = [
  { value: "ignore", label: "Don't import" },
  { value: "trackingLink", label: "Tracking Link (Column D)" },
  { value: "consignmentNumber", label: "Consignment Number" },
  { value: "customerName", label: "Customer Name" },
  { value: "deliveryAddress", label: "Delivery Address" },
  { value: "pickupAddress", label: "Pickup Address" },
  { value: "status", label: "Status" },
  { value: "estimatedDeliveryDate", label: "Estimated Delivery Date" },
  { value: "lastKnownLocation", label: "Last Known Location" },
  { value: "temperatureZone", label: "Temperature Zone" },
  { value: "quantity", label: "Quantity" },
  { value: "pallets", label: "Pallets" },
  { value: "spaces", label: "Spaces" },
];

export default function SimpleImport() {
  const { toast } = useToast();
  const [fileData, setFileData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);

  // Smart mapping suggestions based on column headers, position, and common patterns
  const suggestMapping = (columnHeader: string, columnIndex: number): string => {
    const header = columnHeader.toLowerCase().trim();
    
    // Position-based suggestions (Column D = index 3 for tracking links)
    if (columnIndex === 3 && (header.includes('track') || header.includes('link') || header.includes('url') || header.includes('reference'))) {
      return 'trackingLink';
    }
    
    // Header content analysis with priority scoring
    const suggestions = [
      // Tracking links (highest priority for Column D)
      { field: 'trackingLink', score: header.includes('tracking') ? 100 : header.includes('track') ? 90 : header.includes('link') ? 80 : header.includes('url') ? 70 : 0 },
      
      // Consignment references
      { field: 'consignmentNumber', score: 
        header === 'consignment number' || header === 'consignment_number' ? 100 :
        header === 'ref' || header === 'reference' ? 90 :
        header.includes('consign') && header.includes('num') ? 85 :
        header.includes('order') && header.includes('num') ? 75 : 0 },
      
      // Customer information
      { field: 'customerName', score:
        header === 'customer' || header === 'customer name' ? 100 :
        header === 'client' || header === 'company' ? 90 :
        header.includes('customer') ? 85 :
        header.includes('client') || header.includes('receiver') ? 75 : 0 },
      
      // Addresses
      { field: 'deliveryAddress', score:
        header === 'delivery address' || header === 'delivery_address' ? 100 :
        header === 'destination' || header === 'to' ? 90 :
        header.includes('deliver') && header.includes('addr') ? 85 :
        header.includes('destination') ? 75 : 0 },
      
      { field: 'pickupAddress', score:
        header === 'pickup address' || header === 'pickup_address' ? 100 :
        header === 'origin' || header === 'from' ? 90 :
        header.includes('pickup') || header.includes('collect') ? 85 :
        header.includes('origin') ? 75 : 0 },
      
      // Status and dates
      { field: 'status', score:
        header === 'status' || header === 'state' ? 100 :
        header === 'delivery status' ? 95 :
        header.includes('status') ? 80 : 0 },
      
      { field: 'estimatedDeliveryDate', score:
        header.includes('deliver') && header.includes('date') ? 100 :
        header.includes('eta') || header.includes('estimated') ? 90 :
        header.includes('due') && header.includes('date') ? 85 : 0 },
      
      // Quantities and logistics
      { field: 'quantity', score:
        header === 'quantity' || header === 'qty' ? 100 :
        header === 'count' || header === 'amount' ? 90 :
        header.includes('qty') || header.includes('units') ? 85 : 0 },
      
      { field: 'pallets', score:
        header === 'pallets' || header === 'pallet' ? 100 :
        header === 'pallet count' ? 95 :
        header.includes('pallet') ? 80 : 0 },
      
      { field: 'spaces', score:
        header === 'spaces' || header === 'space' ? 100 :
        header === 'space count' ? 95 :
        header.includes('space') ? 80 : 0 },
      
      // Temperature and location
      { field: 'temperatureZone', score:
        header.includes('temp') && header.includes('zone') ? 100 :
        header.includes('temperature') ? 90 :
        header.includes('temp') || header.includes('zone') ? 75 :
        header.includes('storage') ? 60 : 0 },
      
      { field: 'lastKnownLocation', score:
        header.includes('location') && header.includes('current') ? 100 :
        header.includes('last') && header.includes('location') ? 95 :
        header.includes('location') || header.includes('where') ? 80 : 0 }
    ];
    
    // Find the highest scoring suggestion
    const bestMatch = suggestions.reduce((best, current) => 
      current.score > best.score ? current : best, { field: 'ignore', score: 0 });
    
    return bestMatch.score > 50 ? bestMatch.field : 'ignore';
  };

  // Apply smart suggestions automatically when file is loaded
  const applySuggestedMappings = (headersList: string[]) => {
    const suggestedMappings: Record<string, string> = {};
    headersList.forEach((header, index) => {
      const suggestion = suggestMapping(header, index);
      suggestedMappings[index.toString()] = suggestion;
    });
    setFieldMapping(suggestedMappings);
    
    const mappedCount = Object.values(suggestedMappings).filter(val => val !== 'ignore').length;
    toast({
      title: "Smart mapping applied!",
      description: `Automatically mapped ${mappedCount} of ${headersList.length} columns. Column D prioritized for tracking links.`,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();

    if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
      // Handle Excel files
      reader.onload = (e) => {
        if (e.target?.result) {
          try {
            const data = new Uint8Array(e.target.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convert to JSON array
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            const rows = jsonData.map((row: any) => 
              Array.isArray(row) ? row.map(cell => cell?.toString() || '') : []
            ).filter(row => row.some(cell => cell.trim() !== ''));
            
            if (rows.length > 0) {
              const headersList = rows[0];
              setHeaders(headersList);
              setFileData(rows);
              setShowPreview(true);
              
              // Apply smart mapping suggestions automatically
              applySuggestedMappings(headersList);
              
              toast({
                title: "Excel file loaded successfully",
                description: `Found ${rows.length - 1} data rows with ${headersList.length} columns`
              });
            }
          } catch (error) {
            toast({
              title: "Error reading Excel file",
              description: "Unable to parse the Excel file. Please check the format.",
              variant: "destructive"
            });
          }
        }
        setIsUploading(false);
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Handle CSV files
      reader.onload = (e) => {
        if (e.target?.result) {
          const content = e.target.result as string;
          const rows = content.split('\n')
            .filter(line => line.trim())
            .map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));
          
          if (rows.length > 0) {
            const headersList = rows[0];
            setHeaders(headersList);
            setFileData(rows);
            setShowPreview(true);
            
            // Apply smart mapping suggestions automatically
            applySuggestedMappings(headersList);
            
            toast({
              title: "CSV file loaded successfully",
              description: `Found ${rows.length - 1} data rows with ${headersList.length} columns`
            });
          }
        }
        setIsUploading(false);
      };
      reader.readAsText(file);
    }
  };

  const updateFieldMapping = (csvField: string, systemField: string) => {
    setFieldMapping(prev => ({
      ...prev,
      [csvField]: systemField
    }));
  };

  const importData = async () => {
    const mappedFields = Object.entries(fieldMapping).filter(([_, value]) => value !== "ignore");
    
    if (mappedFields.length === 0) {
      toast({
        title: "No fields mapped",
        description: "Please map at least one field before importing",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    try {
      // Create the import data
      const importRows = fileData.slice(1).map(row => {
        const mappedRow: Record<string, string> = {};
        headers.forEach((header, index) => {
          const systemField = fieldMapping[header];
          if (systemField && systemField !== "ignore") {
            mappedRow[systemField] = row[index] || "";
          }
        });
        return mappedRow;
      });

      // Send data to backend for processing
      const response = await fetch("/api/admin/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          importRows,
          importToDatabase: true,
          updateExisting: false
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        toast({
          title: "Import completed successfully",
          description: `Successfully imported ${result.importedCount || importRows.length} records with ${mappedFields.length} mapped fields`
        });

        // Reset the form
        setFileData([]);
        setHeaders([]);
        setFieldMapping({});
        setShowPreview(false);
      } else {
        throw new Error(result.message || "Import failed");
      }
      
    } catch (error) {
      toast({
        title: "Import failed",
        description: "There was an error importing the data",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="bg-primary text-white shadow-md z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-white">ChillTrack</h1>
            <span className="ml-4 text-white/80">Import Data</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button 
              variant="ghost" 
              className="h-9 px-3 text-white hover:bg-white/10 hover:text-white"
              onClick={() => window.location.href = '/dashboard'}
            >
              Dashboard
            </Button>
            <Button 
              variant="ghost" 
              className="h-9 px-3 text-white hover:bg-white/10 hover:text-white"
              onClick={() => window.location.href = '/admin'}
            >
              Admin
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Simple Data Import</h1>
          <p className="text-gray-600">Upload your file and map columns to system fields</p>
        </div>

      {!showPreview ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileSpreadsheet className="h-5 w-5 mr-2" />
              Upload File
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Click to upload file</p>
                <p className="text-gray-500">CSV or Excel files accepted</p>
              </label>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Field Mapping */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Map Your Columns</CardTitle>
                  <p className="text-sm text-gray-600">
                    For each system field, select which column from your file contains that data
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applySuggestedMappings(headers)}
                  className="flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                  Smart Mapping
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {SYSTEM_FIELDS.filter(field => field.value !== "ignore").map((systemField, index) => {
                  // Find which CSV header is mapped to this system field
                  const mappedCsvHeader = Object.entries(fieldMapping).find(([_, value]) => value === systemField.value)?.[0];
                  
                  return (
                    <div key={index} className="flex items-center space-x-4 p-3 border rounded-lg">
                      <div className="flex-1">
                        <label className="font-medium text-sm">{systemField.label}</label>
                        <p className="text-xs text-gray-500">System field</p>
                      </div>
                      <div className="flex-1">
                        <Select
                          value={mappedCsvHeader || "ignore"}
                          onValueChange={(value) => {
                            // Clear previous mapping for this system field
                            if (mappedCsvHeader) {
                              setFieldMapping(prev => ({
                                ...prev,
                                [mappedCsvHeader]: "ignore"
                              }));
                            }
                            
                            // Set new mapping if a CSV header is selected
                            if (value !== "ignore") {
                              setFieldMapping(prev => ({
                                ...prev,
                                [value]: systemField.value
                              }));
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select your column..." />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="p-2 border-b">
                              <input
                                type="text"
                                placeholder="Search your columns..."
                                className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                onChange={(e) => {
                                  const searchTerm = e.target.value.toLowerCase();
                                  const items = document.querySelectorAll('[data-csv-item]');
                                  items.forEach((item: any) => {
                                    const text = item.textContent?.toLowerCase() || '';
                                    item.style.display = text.includes(searchTerm) ? 'block' : 'none';
                                  });
                                }}
                              />
                            </div>
                            <SelectItem value="ignore" data-csv-item>
                              Don't map
                            </SelectItem>
                            {headers.map((header) => (
                              <SelectItem key={header} value={header} data-csv-item>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-8 flex justify-center">
                        {mappedCsvHeader ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <X className="h-4 w-4 text-gray-300" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Data Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Data Preview</CardTitle>
              <p className="text-sm text-gray-600">
                First 5 rows of your data
              </p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((header, index) => (
                        <TableHead key={index} className="min-w-32">
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fileData.slice(1, 6).map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <TableCell key={cellIndex} className="max-w-48 truncate">
                            {cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Import Actions */}
          <div className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={() => {
                setShowPreview(false);
                setFileData([]);
                setHeaders([]);
                setFieldMapping({});
              }}
            >
              Upload Different File
            </Button>
            <Button 
              onClick={importData}
              disabled={isUploading || Object.values(fieldMapping).every(v => v === "ignore")}
            >
              {isUploading ? "Importing..." : "Import Data"}
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}