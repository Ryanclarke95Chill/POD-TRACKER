import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/searchable-select";
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
    
    // Header content analysis with comprehensive pattern matching
    const suggestions = [
      // Tracking links - very broad pattern matching
      { field: 'trackingLink', score: 
        header.includes('tracking') || header.includes('track') ? 100 :
        header.includes('link') || header.includes('url') || header.includes('reference') ? 90 :
        header.includes('ref') || header.includes('trace') ? 80 : 0 },
      
      // Consignment references - catch many variations
      { field: 'consignmentNumber', score: 
        header.includes('consign') ? 100 :
        header.includes('order') || header.includes('job') ? 90 :
        header.includes('number') || header.includes('num') || header.includes('#') ? 80 :
        header.includes('id') || header.includes('code') ? 75 : 0 },
      
      // Customer information - very broad
      { field: 'customerName', score:
        header.includes('customer') || header.includes('client') ? 100 :
        header.includes('company') || header.includes('business') ? 95 :
        header.includes('name') || header.includes('receiver') ? 85 :
        header.includes('vendor') || header.includes('supplier') ? 80 : 0 },
      
      // Delivery addresses - catch many formats
      { field: 'deliveryAddress', score:
        header.includes('deliver') && header.includes('addr') ? 100 :
        header.includes('deliver') || header.includes('destination') ? 95 :
        header.includes('to') || header.includes('ship') ? 90 :
        header.includes('address') && !header.includes('pickup') && !header.includes('from') ? 85 : 0 },
      
      // Pickup addresses
      { field: 'pickupAddress', score:
        header.includes('pickup') || header.includes('collect') ? 100 :
        header.includes('origin') || header.includes('from') ? 95 :
        header.includes('source') || header.includes('start') ? 90 : 0 },
      
      // Status - broad matching
      { field: 'status', score:
        header.includes('status') || header.includes('state') ? 100 :
        header.includes('condition') || header.includes('progress') ? 90 : 0 },
      
      // Dates - very broad patterns
      { field: 'estimatedDeliveryDate', score:
        header.includes('deliver') && header.includes('date') ? 100 :
        header.includes('eta') || header.includes('estimated') ? 95 :
        header.includes('due') || header.includes('expected') ? 90 :
        header.includes('date') && header.includes('delivery') ? 85 : 0 },
      
      // Quantities - catch variations
      { field: 'quantity', score:
        header.includes('quantity') || header.includes('qty') ? 100 :
        header.includes('count') || header.includes('amount') ? 95 :
        header.includes('units') || header.includes('pieces') ? 90 :
        header.includes('items') || header.includes('total') ? 85 : 0 },
      
      // Pallets
      { field: 'pallets', score:
        header.includes('pallet') ? 100 :
        header.includes('skid') ? 90 : 0 },
      
      // Spaces
      { field: 'spaces', score:
        header.includes('space') ? 100 :
        header.includes('slot') || header.includes('position') ? 90 : 0 },
      
      // Temperature zones
      { field: 'temperatureZone', score:
        header.includes('temp') || header.includes('temperature') ? 100 :
        header.includes('zone') || header.includes('storage') ? 90 :
        header.includes('cold') || header.includes('frozen') ? 85 : 0 },
      
      // Location
      { field: 'lastKnownLocation', score:
        header.includes('location') ? 100 :
        header.includes('where') || header.includes('current') ? 90 :
        header.includes('last') || header.includes('position') ? 85 : 0 }
    ];
    
    // Find the highest scoring suggestion
    const bestMatch = suggestions.reduce((best, current) => 
      current.score > best.score ? current : best, { field: 'ignore', score: 0 });
    
    return bestMatch.score > 20 ? bestMatch.field : 'ignore';
  };

  // Apply smart suggestions automatically when file is loaded
  const applySuggestedMappings = (headersList: string[]) => {
    const suggestedMappings: Record<string, string> = {};
    headersList.forEach((header, index) => {
      const suggestion = suggestMapping(header, index);
      if (suggestion !== 'ignore') {
        suggestedMappings[header] = suggestion;
      }
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
              const headersList = rows[0].map(header => header || `Column ${rows[0].indexOf(header)}`);
              setHeaders(headersList);
              setFileData(rows);
              setShowPreview(true);
              
              // Skip auto-mapping - let user manually select
              
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
            
            // Skip auto-mapping - let user manually select
            
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
                        <SearchableSelect
                          options={["ignore", ...headers]}
                          value={mappedCsvHeader || "ignore"}
                          onChange={(value) => {
                            setFieldMapping(prev => {
                              const newMapping = { ...prev };
                              
                              // Clear any existing mapping for this system field
                              Object.keys(newMapping).forEach(key => {
                                if (newMapping[key] === systemField.value) {
                                  delete newMapping[key];
                                }
                              });
                              
                              // Clear any existing mapping for this CSV header (avoid conflicts)
                              if (value !== "ignore" && value !== "") {
                                Object.keys(newMapping).forEach(key => {
                                  if (key === value) {
                                    delete newMapping[key];
                                  }
                                });
                                
                                // Set new mapping
                                newMapping[value] = systemField.value;
                              }
                              
                              return newMapping;
                            });
                          }}
                          placeholder="Select your column..."
                          className="w-full"
                        />
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