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
  { value: "deliveryCalculatedEta", label: "Delivery Calculated ETA" },
  { value: "timeSpentInTheUnloadingArea", label: "Time Spent in the Unloading Area" },
  { value: "deliveryOutcomeCausal", label: "Delivery Outcome Causal" },
  { value: "deliveryArrivalDate", label: "Delivery Arrival Date" },
  { value: "deliveryOutcomeDate", label: "Delivery Outcome Date" },
  { value: "deliveryUnloadDate", label: "Delivery Unload Date" },
  { value: "deliveryOutcomeNote", label: "Delivery Outcome Note" },
  { value: "deliveryLastPosition", label: "Delivery Last Position" },
  { value: "deliveryLastPositionDate", label: "Delivery Last Position Date" },
  { value: "pickupPlannedEta", label: "Pickup Planned ETA" },
  { value: "etaDeliveryOnDeparture", label: "ETA Delivery On Departure" },
  { value: "deliveryLiveDistanceKm", label: "Delivery Live Distance [km]" },
  { value: "deliveryDistanceKm", label: "Delivery Distance [km]" },
  { value: "deliveryOutcomeTransmissionDate", label: "Delivery Outcome Transmission Date" },
  { value: "deliveryOutcomeReceiptDate", label: "Delivery Outcome Receipt Date" },
  { value: "deliveryUnloadSequence", label: "Delivery Unload Sequence" },
  { value: "deliveryTimeWindow", label: "Delivery Time Window" },
  { value: "pickupArrivalDate", label: "Pickup Arrival Date" },
  { value: "pickupOutcomeDate", label: "Pickup Outcome Date" },
  { value: "pickupLoadDate", label: "Pickup Load Date" },
  { value: "pickupOutcomeReason", label: "Pickup Outcome Reason" },
  { value: "groupCausalPickupOutcome", label: "Group Causal Pickup Outcome" },
  { value: "pickupOutcomeNote", label: "Pickup Outcome Note" },
  { value: "pickupLastPosition", label: "Pickup Last Position" },
  { value: "pickupLastPositionDate", label: "Pickup Last Position Date" },
  { value: "pickupCalculatedEta", label: "Pickup Calculated ETA" },
  { value: "etaPickupOnDeparture", label: "ETA Pickup On Departure" },
  { value: "pickupLiveDistanceKm", label: "Pickup Live Distance [km]" },
  { value: "pickupDistanceKm", label: "Pickup Distance [km]" },
  { value: "pickupOutcomeReceiptDate", label: "Pickup Outcome Receipt Date" },
  { value: "pickupLoadSequence", label: "Pickup Load Sequence" },
  { value: "pickupTimeWindow", label: "Pickup Time Window" },
  { value: "fromMasterDataCode", label: "From - Master Data Code" },
  { value: "shipperCity", label: "Shipper City" },
  { value: "shipperProvince", label: "Shipper Province" },
  { value: "shipperMasterDataCode", label: "Shipper - Master Data Code" },
  { value: "depot", label: "Depot" },
  { value: "depotMasterDataCode", label: "Depot - Master Data Code" },
  { value: "recipientMasterDataCode", label: "Recipient - Master Data Code" },
  { value: "deliveryCity", label: "Delivery City" },
  { value: "deliveryProvince", label: "Delivery Province" },
  { value: "carrierMasterDataCode", label: "Carrier - Master Data Code" },
  { value: "subCarrier", label: "Sub Carrier" },
  { value: "subCarrierMasterDataCode", label: "Sub Carrier - Master Data Code" },
  { value: "orderDate", label: "Order Date" },
  { value: "documentNote", label: "Document Note" },
  { value: "orderType", label: "Order Type" },
  { value: "orderSeries", label: "Order Series" },
  { value: "shipperOrderReferenceNumber", label: "Shipper Order Reference Number" },
  { value: "errorDescription", label: "Error Description" },
  { value: "driverPhone", label: "Driver Phone" },
  { value: "tractorLicensePlate", label: "Tractor License Plate" },
  { value: "trailerLicensePlate", label: "Trailer License Plate" },
  { value: "deliveryOutcome", label: "Delivery Outcome" },
  { value: "deliveryPunctuality", label: "Delivery Punctuality" },
  { value: "deliveryGeolocalizationState", label: "Delivery Geolocalization State" },
  { value: "pickupOutcome", label: "Pickup Outcome" },
  { value: "pickupPunctuality", label: "Pickup Punctuality" },
  { value: "pickupGeolocationState", label: "Pickup Geolocation State" },
  { value: "deliveryState", label: "Delivery State" },
  { value: "pickupState", label: "Pickup State" },
  { value: "destinationCoordinates", label: "Destination Coordinates" },
  { value: "departureCoordinates", label: "Departure Coordinates" },
  { value: "expectedTemperature", label: "Expected Temperature" },
  { value: "deliveryMaximumDate", label: "Delivery Maximum Date" },
  { value: "deliveryMinimumDate", label: "Delivery Minimum Date" },
  { value: "pickupMinimumDate", label: "Pickup Minimum Date" },
  { value: "pickupMaximumDate", label: "Pickup Maximum Date" },
  { value: "volumeM3", label: "Volume [m³]" },
  { value: "linearMetersM", label: "Linear Meters [m]" },
  { value: "groundBases", label: "Ground Bases" },
  { value: "documentDate1", label: "Document Date1" },
  { value: "documentDate2", label: "Document Date2" },
  { value: "documentDate3", label: "Document Date3" },
  { value: "documentString1", label: "Document String1" },
  { value: "documentString3", label: "Document String3" },
  { value: "timeSpentInTheLoadingArea", label: "Time Spent in the Loading Area" },
  { value: "deliveryOutcomeInArea", label: "Delivery Outcome in Area" },
  { value: "pickupOutcomeInArea", label: "Pickup Outcome in Area" },
  { value: "deliveryOutcomePosition", label: "Delivery Outcome Position" },
  { value: "pickupOutcomePosition", label: "Pickup Outcome Position" },
  { value: "seals", label: "Seals" },
  { value: "taskId", label: "TaskID" },
  { value: "idCreationImport", label: "ID Creation Import" },
  { value: "expectedPaymentMethodCode", label: "Expected Payment Method Code" },
  { value: "expectedPaymentMethod", label: "Expected Payment Method" },
  { value: "deliveryOutcomeRegistrationDate", label: "Delivery Outcome Registration Date" },
  { value: "pickupOutcomeRegistrationDate", label: "Pickup Outcome Registration Date" },
  { value: "deliveryPinIsValid", label: "Delivery Pin Is Valid" },
  { value: "pickUpPinIsValid", label: "Pick Up Pin Is Valid" },
  { value: "expectedPaymentNotes", label: "Expected Payment Notes" },
  { value: "deliveryPodFiles", label: "Delivery PoD Files" },
  { value: "pickupPodFiles", label: "Pickup PoD Files" },
  { value: "departureDateInitiallyPlannedByTheContext", label: "Departure Date Initially Planned by the Context" },
  { value: "orderCarrierMobileTelephoneNumber", label: "Order Carrier Mobile Telephone Number" },
  { value: "orderCarrierTelephoneNumber", label: "Order Carrier Telephone Number" },
  { value: "orderPickupEmail", label: "Order Pickup Email" },
  { value: "orderPickupMobileTelephoneNumber", label: "Order Pickup Mobile Telephone Number" },
  { value: "orderPickupTelephoneNumber", label: "Order Pickup Telephone Number" },
  { value: "orderDeliveryEmail", label: "Order Delivery Email" },
  { value: "orderDeliveryMobileTelephoneNumber", label: "Order Delivery Mobile Telephone Number" },
  { value: "orderDeliveryTelephoneNumber", label: "Order Delivery Telephone Number" },
  { value: "orderSubCarrierEmail", label: "Order Sub Carrier Email" },
  { value: "orderSubCarrierMobileTelephoneNumber", label: "Order Sub Carrier Mobile Telephone Number" },
  { value: "orderSubCarrierTelephoneNumber", label: "Order Sub Carrier Telephone Number" },
  { value: "orderShipperEmail", label: "Order Shipper Email" },
  { value: "orderShipperMobileTelephoneNumber", label: "Order Shipper Mobile Telephone Number" },
  { value: "orderShipperTelephoneNumber", label: "Order Shipper Telephone Number" },
  { value: "forbiddenTags", label: "Forbidden Tags" },
  { value: "pickupPlannedServiceTime", label: "Pickup Planned Service Time" },
  { value: "deliveryPlannedServiceTime", label: "Delivery Planned Service Time" },
  { value: "externalReference", label: "External Reference" },
  { value: "depotPhoneNumberSpecifiedInTheOrder", label: "Depot Phone Number Specified in the Order" },
  { value: "depotMobilePhoneNumberSpecifiedInTheOrder", label: "Depot Mobile Phone Number Specified in the Order" },
  { value: "receivedPickupPodFiles", label: "Received Pickup PoD Files" },
  { value: "requiredTagsDescription", label: "Required Tags Description" },
  { value: "forbiddenTagsDescription", label: "Forbidden Tags Description" },
  { value: "fromPostalCode", label: "From - Postal Code" },
  { value: "toPostalCode", label: "To - Postal Code" },
  { value: "fromCountry", label: "From - Country" },
  { value: "toCountry", label: "To - Country" },
  { value: "pickupEtaDeviation", label: "Pickup ETA Deviation" },
  { value: "pickupLivetrackLink", label: "Pickup Livetrack Link" },
  { value: "vehicleDescription", label: "Vehicle Description" },
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

    // Exact mapping for your Excel column names
    const exactMappings: Record<string, string> = {
      'vehicle code': 'vehicleCode',
      'delivery eta deviation': 'deliveryEtaDeviation',
      'received delivery pod files': 'receivedDeliveryPodFiles',
      'trip number': 'tripNumber',
      'from': 'from',
      'to': 'to',
      'carrier': 'carrier',
      'driver': 'driver',
      'customer order number': 'customerOrderNumber',
      'document_string2': 'documentString2',
      'delivery livetrack link': 'deliveryLivetrackLink',
      'required tags': 'requiredTags',
      'order carrier email': 'orderCarrierEmail',
      'order number': 'orderNumber',
      // Additional common mappings
      'delivery planned eta': 'deliveryPlannedEta',
      'recorded temperature': 'recordedTemperature',
      'quantity unit of measurement1': 'quantityUnitOfMeasurement1',
      'quantity unit of measurement2': 'quantityUnitOfMeasurement2',
      'group causal delivery outcome': 'groupCausalDeliveryOutcome',
    };

    const exactMatch = exactMappings[normalizedHeader];
    if (exactMatch) {
      return exactMatch;
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
    
    // Send RAW Excel data directly to smart backend - no frontend mapping needed!
    const importRows = fileData.slice(1).map((row) => {
      const rowData: any = {};
      headers.forEach((header, index) => {
        // Use original Excel header names exactly as they appear
        if (row[index] !== undefined && row[index] !== null && row[index] !== '') {
          rowData[header] = row[index];
        }
      });
      return rowData;
    });

    console.log('Sending raw Excel data to smart backend:', {
      totalRows: importRows.length,
      sampleHeaders: headers.slice(0, 10),
      sampleRow: importRows[0]
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
          description: `Successfully imported ${result.importedCount} records with smart column mapping!`,
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