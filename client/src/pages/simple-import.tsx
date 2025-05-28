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
  { value: "trackingLink", label: "Tracking Link" },
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
  { value: "deliveryRun", label: "Delivery Run" },
  { value: "weightKg", label: "Weight (kg)" },
  { value: "cubicMeters", label: "Cubic Meters" },
  { value: "shipper", label: "Shipper" },
  { value: "receiver", label: "Receiver" },
  { value: "driver", label: "Driver" },
  { value: "vehicle", label: "Vehicle" },
  { value: "route", label: "Route" },
  { value: "notes", label: "Notes" },
  { value: "deliveryTime", label: "Delivery Time" },
  { value: "pickupTime", label: "Pickup Time" },
  { value: "consignmentType", label: "Consignment Type" },
  { value: "priority", label: "Priority" },
  { value: "deliveryZone", label: "Delivery Zone" },
  { value: "pickupZone", label: "Pickup Zone" },
  { value: "customerReference", label: "Customer Reference" },
  { value: "invoiceNumber", label: "Invoice Number" },
  { value: "productDescription", label: "Product Description" },
  { value: "specialInstructions", label: "Special Instructions" },
  { value: "deliveryInstructions", label: "Delivery Instructions" },
  { value: "pickupInstructions", label: "Pickup Instructions" },
  { value: "pickupCompany", label: "Pickup Company" },
  { value: "deliveryCompany", label: "Delivery Company" },
  { value: "pickupContactName", label: "Pickup Contact Name" },
  { value: "deliveryContactName", label: "Delivery Contact Name" },
  { value: "pickupContactPhone", label: "Pickup Contact Phone" },
  { value: "deliveryContactPhone", label: "Delivery Contact Phone" },
  { value: "deliveryDate", label: "Delivery Date" },
  { value: "dateDelivered", label: "Date Delivered" },
  { value: "consignmentRequiredDeliveryDate", label: "Required Delivery Date" },
  { value: "deliveryLivetrackLink", label: "Delivery Livetrack Link" },
  { value: "customerOrderNumber", label: "Customer Order Number" },
  { value: "documentString2", label: "Document String 2" },
  { value: "fromLocation", label: "From Location" },
  { value: "toLocation", label: "To Location" },
  { value: "groupCausalDeliveryOutcome", label: "Group Causal Delivery Outcome" },
  { value: "deliveryPlannedEta", label: "Delivery Planned ETA" },
  { value: "recordedTemperature", label: "Recorded Temperature" },
  { value: "quantityUnitOfMeasurement", label: "Quantity Unit of Measurement" },
  { value: "quantityUnitOfMeasurement1", label: "Quantity Unit of Measurement 1" },
  { value: "quantityUnitOfMeasurement2", label: "Quantity Unit of Measurement 2" },
  { value: "podSignature", label: "POD Signature" },
  { value: "deliveryProof", label: "Delivery Proof" },
  { value: "vehicleCode", label: "Vehicle Code" },
  { value: "deliveryEtaDeviation", label: "Delivery ETA Deviation" },
  { value: "receivedDeliveryPodFiles", label: "Received Delivery PoD Files" },
  { value: "tripNumber", label: "Trip Number" },
  { value: "from", label: "From" },
  { value: "to", label: "To" },
  { value: "carrier", label: "Carrier" },
  { value: "requiredTags", label: "Required Tags" },
  { value: "orderCarrierEmail", label: "Order Carrier Email" },
  { value: "orderNumber", label: "Order Number" },
];

export default function SimpleImport() {
  const { toast } = useToast();
  const [fileData, setFileData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);

  // Perfect 1:1 mapping since Excel columns match database exactly
  const autoMapColumn = (columnHeader: string): string => {
    // Convert database field names to camelCase for the frontend
    const toCamelCase = (str: string): string => {
      return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    };

    // Clean the header and convert to camelCase
    const normalizedHeader = columnHeader.toLowerCase().trim();
    const camelCaseField = toCamelCase(normalizedHeader);
    
    // Check if this camelCase field exists in our SYSTEM_FIELDS
    const fieldExists = SYSTEM_FIELDS.find(field => field.value === camelCaseField);
    
    if (fieldExists) {
      return camelCaseField;
    }

    // For exact matches, just return the camelCase version
    // This handles cases like "shipper" -> "shipper", "status" -> "status"
    if (SYSTEM_FIELDS.find(field => field.value === normalizedHeader)) {
      return normalizedHeader;
    }

    // Special handling for common variations
    const specialMappings: Record<string, string> = {
      'delivery livetrack link': 'deliveryLivetrackLink',
      'customer order number': 'customerOrderNumber',
      'group causal delivery outcome': 'groupCausalDeliveryOutcome',
      'delivery planned eta': 'deliveryPlannedEta',
      'recorded temperature': 'recordedTemperature',
      'quantity unit of measurement1': 'quantityUnitOfMeasurement1',
      'quantity unit of measurement2': 'quantityUnitOfMeasurement2',
    };

    const specialMatch = specialMappings[normalizedHeader];
    if (specialMatch) {
      return specialMatch;
    }

    // Default to camelCase conversion for any field that might exist
    return camelCaseField;
  };

  // Auto-apply mapping when file is loaded
  const applyAutoMapping = (headers: string[]) => {
    const newMapping: Record<string, string> = {};
    headers.forEach(header => {
      newMapping[header] = autoMapColumn(header);
    });
    setFieldMapping(newMapping);
    
    localStorage.setItem('consignment-field-mapping', JSON.stringify(newMapping));
    
    toast({
      title: "Auto-mapping applied",
      description: `Automatically mapped ${Object.values(newMapping).filter(v => v !== 'ignore').length} columns`,
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        defval: '',
        raw: false
      }) as string[][];
      
      if (jsonData.length === 0) {
        toast({
          title: "Error",
          description: "The uploaded file appears to be empty.",
          variant: "destructive",
        });
        return;
      }

      const fileHeaders = jsonData[0] || [];
      const fileContent = jsonData.slice(1);
      
      setHeaders(fileHeaders);
      setFileData(fileContent);
      setShowPreview(true);
      
      // Apply auto-mapping
      applyAutoMapping(fileHeaders);
      
      toast({
        title: "File uploaded successfully",
        description: `Found ${fileContent.length} rows with ${fileHeaders.length} columns`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to parse the uploaded file.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const updateFieldMapping = (header: string, value: string) => {
    const newMapping = { ...fieldMapping, [header]: value };
    setFieldMapping(newMapping);
    localStorage.setItem('consignment-field-mapping', JSON.stringify(newMapping));
  };

  const handleImport = async () => {
    if (!fileData.length) {
      toast({
        title: "Error",
        description: "No data to import",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    const importRows = fileData.map((row) => {
      const mappedRow: any = {};
      headers.forEach((header, index) => {
        const fieldName = fieldMapping[header];
        if (fieldName && fieldName !== 'ignore') {
          mappedRow[fieldName] = row[index] || '';
        }
      });
      return mappedRow;
    });

    try {
      const response = await fetch("/api/admin/import-direct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ importRows })
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Import successful",
          description: result.message,
        });
        
        // Clear the form
        setFileData([]);
        setHeaders([]);
        setFieldMapping({});
        setShowPreview(false);
      } else {
        toast({
          title: "Import failed",
          description: result.message || "There was an error importing the data",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Import failed",
        description: "There was an error importing the data",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            Excel Import
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label htmlFor="file-upload" className="block text-sm font-medium mb-2">
                Upload Excel File
              </label>
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {showPreview && (
              <>
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Column Mapping</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {headers.map((header, index) => (
                      <div key={index} className="space-y-2">
                        <label className="block text-sm font-medium">
                          {header}
                        </label>
                        <SearchableSelect
                          options={SYSTEM_FIELDS.map(field => field.value)}
                          value={fieldMapping[header] || 'ignore'}
                          onChange={(value) => updateFieldMapping(header, value)}
                          placeholder="Select field..."
                          className="w-full"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Preview ({fileData.length} rows)</h3>
                  <div className="border rounded-md overflow-hidden">
                    <div className="overflow-x-auto max-h-96">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {headers.map((header, index) => (
                              <TableHead key={index} className="min-w-32">
                                <div className="space-y-1">
                                  <div className="font-medium">{header}</div>
                                  <div className="text-xs text-gray-500">
                                    {fieldMapping[header] === 'ignore' ? (
                                      <X className="h-3 w-3 text-red-500" />
                                    ) : (
                                      <Check className="h-3 w-3 text-green-500" />
                                    )}
                                    {SYSTEM_FIELDS.find(f => f.value === fieldMapping[header])?.label || 'Ignored'}
                                  </div>
                                </div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fileData.slice(0, 5).map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                              {row.map((cell, cellIndex) => (
                                <TableCell key={cellIndex} className="min-w-32">
                                  {cell}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button 
                    onClick={handleImport}
                    disabled={isUploading}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {isUploading ? 'Importing...' : 'Import Data'}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => applyAutoMapping(headers)}
                    disabled={isUploading}
                  >
                    Auto-Map Columns
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}