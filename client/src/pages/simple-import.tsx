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
];

export default function SimpleImport() {
  const { toast } = useToast();
  const [fileData, setFileData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);

  // Auto-mapping that matches Excel column names directly to database fields
  const autoMapColumn = (columnHeader: string): string => {
    const directMappings: Record<string, string> = {
      'consignment_number': 'consignmentNumber',
      'customer_name': 'customerName', 
      'delivery_address': 'deliveryAddress',
      'pickup_address': 'pickupAddress',
      'status': 'status',
      'estimated_delivery_date': 'estimatedDeliveryDate',
      'temperature_zone': 'temperatureZone',
      'last_known_location': 'lastKnownLocation',
      'quantity': 'quantity',
      'pallets': 'pallets',
      'spaces': 'spaces',
      'delivery_run': 'deliveryRun',
      'weight_kg': 'weightKg',
      'cubic_meters': 'cubicMeters',
      'shipper': 'shipper',
      'receiver': 'receiver',
      'driver': 'driver',
      'vehicle': 'vehicle',
      'route': 'route',
      'notes': 'notes',
      'delivery_time': 'deliveryTime',
      'pickup_time': 'pickupTime',
      'consignment_type': 'consignmentType',
      'priority': 'priority',
      'delivery_zone': 'deliveryZone',
      'pickup_zone': 'pickupZone',
      'customer_reference': 'customerReference',
      'invoice_number': 'invoiceNumber',
      'product_description': 'productDescription',
      'special_instructions': 'specialInstructions',
      'delivery_instructions': 'deliveryInstructions',
      'pickup_instructions': 'pickupInstructions',
      'pickup_company': 'pickupCompany',
      'delivery_company': 'deliveryCompany',
      'pickup_contact_name': 'pickupContactName',
      'delivery_contact_name': 'deliveryContactName',
      'pickup_contact_phone': 'pickupContactPhone',
      'delivery_contact_phone': 'deliveryContactPhone',
      'delivery_date': 'deliveryDate',
      'date_delivered': 'dateDelivered',
      'consignment_required_delivery_date': 'consignmentRequiredDeliveryDate',
      'delivery_livetrack_link': 'deliveryLivetrackLink',
      'customer_order_number': 'customerOrderNumber',
      'document_string2': 'documentString2',
      'from_location': 'fromLocation',
      'to_location': 'toLocation',
      'group_causal_delivery_outcome': 'groupCausalDeliveryOutcome',
      'delivery_planned_eta': 'deliveryPlannedEta',
      'recorded_temperature': 'recordedTemperature',
      'quantity_unit_of_measurement': 'quantityUnitOfMeasurement',
      'quantity_unit_of_measurement1': 'quantityUnitOfMeasurement1',
      'quantity_unit_of_measurement2': 'quantityUnitOfMeasurement2',
      'pod_signature': 'podSignature',
      'delivery_proof': 'deliveryProof',
      'tracking_link': 'trackingLink',
      'consignment_reference': 'consignmentReference'
    };

    // Try exact match first (case-insensitive)
    const normalizedHeader = columnHeader.toLowerCase().trim();
    const exactMatch = directMappings[normalizedHeader];
    if (exactMatch) {
      return exactMatch;
    }

    // Try with spaces converted to underscores
    const withUnderscores = normalizedHeader.replace(/\s+/g, '_');
    const underscoreMatch = directMappings[withUnderscores];
    if (underscoreMatch) {
      return underscoreMatch;
    }

    return 'ignore';
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