import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Loader2, Upload, X, ArrowRight, CheckCircle2, Table, FileSpreadsheet } from "lucide-react";
import { getUser, logout } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// Create a schema for the filter form
const filterSchema = z.object({
  pickupDateFrom: z.string(),
  pickupDateTo: z.string(),
  deliveryEmail: z.string().email().optional().or(z.literal("")),
  customerName: z.string().optional(),
  importToDatabase: z.boolean().default(true),
  refreshExisting: z.boolean().default(false),
});

type FilterFormValues = z.infer<typeof filterSchema>;

export default function AdminPage() {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importCsvToDb, setImportCsvToDb] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResults, setImportResults] = useState<null | {
    fetched: number;
    imported: number;
    errors: number;
  }>(null);
  const user = getUser();

  // Set default dates (6 months ago to 6 months ahead)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const sixMonthsAhead = new Date();
  sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6);

  const form = useForm<FilterFormValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      pickupDateFrom: sixMonthsAgo.toISOString().split('T')[0],
      pickupDateTo: sixMonthsAhead.toISOString().split('T')[0],
      deliveryEmail: "",
      customerName: "",
      importToDatabase: true,
      refreshExisting: false
    }
  });

  // Handle CSV file selection
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "text/csv") {
      setSelectedFile(file);
      processCsvFile(file);
    } else if (file) {
      toast({
        title: "Invalid file format",
        description: "Please upload a CSV file.",
        variant: "destructive"
      });
    }
  };
  
  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "text/csv") {
        setSelectedFile(file);
        processCsvFile(file);
      } else {
        toast({
          title: "Invalid file format",
          description: "Please upload a CSV file.",
          variant: "destructive"
        });
      }
    }
  };
  
  // State for CSV mapping
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mappingRequired, setMappingRequired] = useState(false);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  
  // Process CSV file and detect headers
  const processCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        
        if (lines.length > 0) {
          // Extract headers
          const headers = lines[0].split(',').map(h => h.trim());
          setCsvHeaders(headers);
          
          // Set up initial field mapping with smart detection
          const initialMapping: Record<string, string> = {};
          
          // Mapping definitions with potential CSV field names
          const fieldMappingDefinitions: Record<string, string[]> = {
            "consignmentNumber": ["consignment", "reference", "order", "id", "orderid", "shipment", "ORDERREFERENCE", "linked order id"],
            "customerName": ["customer", "client", "recipient", "CUSTOMERCOMPANYNAME", "CUSTOMERCONTACTNAME", "ACCOUNTNAME"],
            "pickupAddress": ["pickup", "collection", "origin", "location street", "location city", "location country"],
            "deliveryAddress": ["delivery", "destination", "receiver", "location street", "location city", "location country"],
            "status": ["status", "state", "condition"],
            "estimatedDeliveryDate": ["estimated", "ETA", "date", "arrival", "timewindows", "TIME_WINDOWS_V2"],
            "temperatureZone": ["temperature", "temp", "zone", "DEFAULT TEMPERATURE", "description"],
            "lastKnownLocation": ["location", "position", "current", "tracking", "TASK ID"]
          };
          
          // Auto-detect and suggest mappings
          headers.forEach(header => {
            const lowerHeader = header.toLowerCase();
            
            // Find the best match for each header
            let bestMatch: string | null = null;
            let highestScore = 0;
            
            Object.entries(fieldMappingDefinitions).forEach(([fieldName, keywords]) => {
              keywords.forEach(keyword => {
                if (lowerHeader.includes(keyword.toLowerCase())) {
                  const score = keyword.length / header.length;
                  if (score > highestScore) {
                    highestScore = score;
                    bestMatch = fieldName;
                  }
                }
              });
            });
            
            if (bestMatch) {
              initialMapping[header] = bestMatch;
            } else {
              initialMapping[header] = "";
            }
          });
          
          setFieldMapping(initialMapping);
          
          // Create preview data (up to 5 rows)
          const previewLines = lines.slice(1, 6).map(line => line.split(',').map(cell => cell.trim()));
          setCsvPreview(previewLines);
          
          // Show mapping interface
          setMappingRequired(true);
          setShowMappingDialog(true);
          
          toast({
            title: "CSV File Loaded",
            description: `Successfully loaded CSV with ${headers.length} columns and ${lines.length - 1} rows.`,
            variant: "default"
          });
        }
      } catch (error) {
        console.error("Error processing CSV:", error);
        toast({
          title: "CSV Processing Error",
          description: "Failed to process the CSV file. Please check the format.",
          variant: "destructive"
        });
      }
    };
    
    reader.readAsText(file);
  };
  
  // Handle drag events
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  // Update field mapping
  const updateFieldMapping = (csvField: string, appField: string) => {
    setFieldMapping(prev => ({
      ...prev,
      [csvField]: appField
    }));
  };
  
  // Process and import CSV file with mapping
  const handleCsvImport = async () => {
    if (!selectedFile) return;
    
    if (mappingRequired && Object.values(fieldMapping).some(value => !value)) {
      toast({
        title: "Mapping Required",
        description: "Please map all required fields before importing.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsImportingCsv(true);
      setImportResults(null);
      
      // Create FormData to send the file
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("importToDatabase", importCsvToDb.toString());
      formData.append("updateExisting", updateExisting.toString());
      formData.append("fieldMapping", JSON.stringify(fieldMapping));
      
      // Send to API
      const response = await fetch("/api/admin/import", {
        method: "POST",
        body: formData,
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Import failed with status: ${response.status}`);
      }
      
      const result = await response.json();
      setImportResults(result);
      
      // Invalidate consignments query to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/consignments"] });
      
      toast({
        title: "CSV Import Completed",
        description: `Successfully processed ${result.fetched} records and imported ${result.imported} consignments.`,
        variant: "default"
      });
      
      // Reset state after successful import
      setSelectedFile(null);
      setMappingRequired(false);
      setCsvHeaders([]);
      setCsvPreview([]);
    } catch (error) {
      console.error("CSV Import failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "CSV Import Failed",
        description: `There was an error importing the CSV file: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setIsImportingCsv(false);
    }
  };

  async function onSubmit(values: FilterFormValues) {
    try {
      setIsImporting(true);
      setImportResults(null);
      
      // Format dates properly
      const formattedFrom = new Date(values.pickupDateFrom);
      formattedFrom.setHours(0, 0, 0, 0);
      
      const formattedTo = new Date(values.pickupDateTo);
      formattedTo.setHours(23, 59, 59, 999);
      
      // Send to API
      const response = await apiRequest("POST", "/api/admin/import", {
        pickupDateFrom: formattedFrom.toISOString(),
        pickupDateTo: formattedTo.toISOString(),
        deliveryEmail: values.deliveryEmail || undefined,
        customerName: values.customerName || undefined,
        importToDatabase: values.importToDatabase,
        refreshExisting: values.refreshExisting
      });
      
      const result = await response.json();
      setImportResults(result);
      
      // Invalidate consignments query to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/consignments"] });
      
      toast({
        title: "Import Completed",
        description: `Successfully fetched ${result.fetched} consignments and imported ${result.imported} to the database.`,
        variant: "default"
      });
    } catch (error) {
      console.error("Import failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Import Failed",
        description: `There was an error importing consignments: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary-dark via-primary to-primary-light text-white shadow-md z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-3xl font-bold text-white">ChillTrack</h1>
            <div className="flex items-center ml-3">
              <span className="mx-2 text-white/30">|</span>
              <div className="flex items-center bg-white/20 rounded-full px-3 py-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span className="text-sm font-medium">Admin Panel</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center px-3 py-1 bg-white/20 rounded-full text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span className="text-sm">{user?.email}</span>
            </div>
            <Button 
              variant="secondary" 
              className="bg-white text-primary hover:bg-white/90 transition-all shadow-sm"
              onClick={() => window.location.href = '/dashboard'}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
              Dashboard
            </Button>
            <Button 
              variant="outline" 
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border h-10 px-4 py-2 border-white/30 hover:bg-white/10 hover:text-white text-[000] bg-[#1ebaed]"
              onClick={logout}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Logout
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-neutral-800">Data Management</h2>
          <p className="text-neutral-500 mt-1">Import and manage your shipment consignments</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Import Consignments</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="api" className="w-full">
                  <TabsList className="w-full grid grid-cols-2 mb-6">
                    <TabsTrigger value="api">API Import</TabsTrigger>
                    <TabsTrigger value="csv">CSV Upload</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="api">
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="pickupDateFrom"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Pickup/Delivery Date From</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="pickupDateTo"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Pickup/Delivery Date To</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="deliveryEmail"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Delivery Email (Optional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="customer@example.com (leave blank for all)" {...field} />
                                </FormControl>
                                <FormDescription>
                                  Filter consignments by delivery email address or leave blank to import all
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="customerName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Customer Name (Optional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="Customer name" {...field} />
                                </FormControl>
                                <FormDescription>
                                  Filter consignments by customer name
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="importToDatabase"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>Import to Database</FormLabel>
                                  <FormDescription>
                                    Save fetched consignments to the database
                                  </FormDescription>
                                </div>
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="refreshExisting"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel>Refresh Existing</FormLabel>
                                  <FormDescription>
                                    Update existing consignments with latest data
                                  </FormDescription>
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <Button 
                          type="submit" 
                          className="w-full bg-primary hover:bg-primary-dark text-white" 
                          disabled={isImporting}
                        >
                          {isImporting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Importing...
                            </>
                          ) : (
                            "Import Consignments"
                          )}
                        </Button>
                      </form>
                    </Form>
                  </TabsContent>
                  
                  <TabsContent value="csv">
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-medium mb-2">CSV Import</h3>
                        <p className="text-sm text-neutral-500 mb-4">
                          Upload a CSV file with consignment data to import into the system. 
                          Any CSV format is supported - you can map fields to match our system.
                        </p>
                        
                        <div 
                          className={`border-2 ${isDragging ? 'border-primary bg-primary/5' : 'border-neutral-200'} border-dashed rounded-lg p-8 text-center mb-4 transition-all duration-200`}
                          onDragOver={handleDragOver}
                          onDragEnter={handleDragEnter}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                        >
                          <input
                            type="file"
                            id="csv-upload"
                            className="hidden"
                            accept=".csv"
                            onChange={handleCsvFileChange}
                            ref={fileInputRef}
                          />
                          
                          {selectedFile ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-center">
                                <div className="bg-green-100 text-green-700 p-3 rounded-full">
                                  <FileSpreadsheet className="h-6 w-6" />
                                </div>
                              </div>
                              <p className="text-sm font-medium">{selectedFile.name}</p>
                              <p className="text-xs text-neutral-500">
                                {(selectedFile.size / 1024).toFixed(2)} KB
                              </p>
                              <div className="flex items-center justify-center space-x-2 mt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedFile(null);
                                    setMappingRequired(false);
                                    setCsvHeaders([]);
                                    setCsvPreview([]);
                                    setShowMappingDialog(false);
                                  }}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Remove File
                                </Button>
                                
                                {mappingRequired && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowMappingDialog(true)}
                                  >
                                    <Table className="h-4 w-4 mr-1" />
                                    Edit Field Mapping
                                  </Button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div 
                              className="flex flex-col items-center justify-center cursor-pointer py-10"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <div className={`h-16 w-16 rounded-full flex items-center justify-center border-2 ${isDragging ? 'text-primary border-primary' : 'text-neutral-300 border-neutral-200'} mb-4`}>
                                <Upload className="h-8 w-8" />
                              </div>
                              <p className="text-base font-medium mb-2">Click to upload CSV file</p>
                              <p className="text-sm text-neutral-500 mb-2">or drag and drop</p>
                              <p className="text-xs text-neutral-400 max-w-xs">
                                Upload your consignment data in CSV format. The system will help you map fields.
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {/* Field Mapping Dialog */}
                        <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
                          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
                            <DialogHeader className="p-6 pb-2 sticky top-0 bg-white z-10">
                              <DialogTitle className="flex items-center text-xl">
                                <Table className="h-5 w-5 mr-2 text-primary" />
                                Map CSV Fields
                              </DialogTitle>
                              <DialogDescription>
                                Preview your data and map CSV fields to match the required fields in our system
                              </DialogDescription>
                            </DialogHeader>
                            
                            <div className="p-6 pt-2">
                              {/* Data Preview Section */}
                              <div className="mb-6">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="text-sm font-medium text-neutral-800">Data Preview</h4>
                                  <p className="text-xs text-neutral-500">Showing first 5 rows</p>
                                </div>
                                <div className="border rounded-lg overflow-hidden">
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm border-collapse">
                                      <thead>
                                        <tr className="bg-neutral-50">
                                          {csvHeaders.map((header, index) => (
                                            <th key={index} className="px-4 py-3 text-left font-medium text-neutral-700 border-b">
                                              {header}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {csvPreview.map((row, rowIndex) => (
                                          <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                                            {row.map((cell, cellIndex) => (
                                              <td key={cellIndex} className="px-4 py-2 text-neutral-700 truncate max-w-[200px] border-t">
                                                {cell}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Field Mapping Section */}
                              <div className="mb-6">
                                <div className="flex justify-between items-center mb-3">
                                  <h4 className="text-sm font-medium text-neutral-800">Field Mapping</h4>
                                  <div className="text-xs text-neutral-500 italic">
                                    <span className="inline-flex items-center mr-3">
                                      <CheckCircle2 className="h-3 w-3 text-green-500 mr-1" /> Auto-matched
                                    </span>
                                    <span className="inline-flex items-center">
                                      <span className="h-2 w-2 bg-amber-400 rounded-full mr-1"></span> Required fields
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="bg-neutral-50 p-4 mb-6 rounded-lg">
                                  <p className="text-sm">
                                    The system has automatically matched fields from your CSV to our system. 
                                    Please review and adjust if necessary. All required fields must be mapped.
                                  </p>
                                </div>
                                
                                <div className="space-y-2">
                                  {Object.entries({
                                    "consignmentNumber": "Consignment Number",
                                    "customerName": "Customer Name",
                                    "pickupAddress": "Pickup Address",
                                    "deliveryAddress": "Delivery Address",
                                    "status": "Status",
                                    "estimatedDeliveryDate": "Estimated Delivery Date",
                                    "temperatureZone": "Temperature Zone",
                                    "lastKnownLocation": "Last Known Location"
                                  }).map(([fieldKey, fieldLabel], index) => {
                                    // Find if any CSV header is mapped to this field
                                    const mappedHeader = Object.entries(fieldMapping).find(([_, value]) => value === fieldKey)?.[0];
                                    const isRequired = ["consignmentNumber", "customerName", "status"].includes(fieldKey);
                                    
                                    return (
                                      <div key={index} className={`p-4 border rounded-md ${isRequired ? 'border-amber-200 bg-amber-50/30' : 'border-neutral-200'}`}>
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <Label className="font-medium">
                                              {fieldLabel} {isRequired && <span className="text-amber-500">*</span>}
                                            </Label>
                                            <p className="text-xs text-neutral-500 mt-1">System field</p>
                                          </div>
                                          
                                          <div className="flex items-center">
                                            <ArrowRight className="mx-2 h-4 w-4 text-neutral-400" />
                                            
                                            <select
                                              className="min-w-[200px] rounded-md border border-neutral-200 p-2 bg-white"
                                              value={mappedHeader || ""}
                                              onChange={(e) => {
                                                // Clear previous mapping for this CSV header if exists
                                                if (mappedHeader) {
                                                  updateFieldMapping(mappedHeader, "");
                                                }
                                                
                                                // Set new mapping if a header is selected
                                                if (e.target.value) {
                                                  updateFieldMapping(e.target.value, fieldKey);
                                                }
                                              }}
                                            >
                                              <option value="">Select CSV field...</option>
                                              {csvHeaders.map((header, headerIndex) => (
                                                <option key={headerIndex} value={header}>{header}</option>
                                              ))}
                                            </select>
                                            
                                            {mappedHeader && (
                                              <button
                                                className="ml-2 text-neutral-400 hover:text-neutral-600"
                                                onClick={() => updateFieldMapping(mappedHeader, "")}
                                              >
                                                <X className="h-4 w-4" />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              
                              {/* Unmapped Fields Section */}
                              <div>
                                <h4 className="text-sm font-medium text-neutral-800 mb-3">Unmapped CSV Fields</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                  {csvHeaders.filter(header => !fieldMapping[header] || fieldMapping[header] === "ignore").map((header, index) => (
                                    <div key={index} className="border rounded p-2 text-sm flex items-center justify-between">
                                      <span className="truncate">{header}</span>
                                      <div className="flex items-center">
                                        <select
                                          className="ml-2 text-xs border rounded p-1"
                                          value={fieldMapping[header] || ""}
                                          onChange={(e) => updateFieldMapping(header, e.target.value)}
                                        >
                                          <option value="">Map...</option>
                                          <option value="consignmentNumber">Consignment Number</option>
                                          <option value="customerName">Customer Name</option>
                                          <option value="pickupAddress">Pickup Address</option>
                                          <option value="deliveryAddress">Delivery Address</option>
                                          <option value="status">Status</option>
                                          <option value="estimatedDeliveryDate">Estimated Delivery Date</option>
                                          <option value="temperatureZone">Temperature Zone</option>
                                          <option value="lastKnownLocation">Last Known Location</option>
                                          <option value="ignore">Ignore</option>
                                        </select>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                            
                            <DialogFooter className="p-4 border-t bg-neutral-50 sticky bottom-0">
                              <Button variant="outline" onClick={() => setShowMappingDialog(false)}>
                                Cancel
                              </Button>
                              <Button onClick={() => {
                                // Check if required fields are mapped
                                const requiredFields = ["consignmentNumber", "customerName", "status"];
                                const missingRequired = requiredFields.filter(field => 
                                  !Object.values(fieldMapping).includes(field)
                                );
                                
                                if (missingRequired.length > 0) {
                                  toast({
                                    title: "Missing Required Fields",
                                    description: `Please map the following required fields: ${missingRequired.join(", ")}`,
                                    variant: "destructive"
                                  });
                                  return;
                                }
                                
                                setShowMappingDialog(false);
                                toast({
                                  title: "Field Mapping Saved",
                                  description: "Your field mapping has been saved. Ready to import.",
                                  variant: "default"
                                });
                              }}>
                                Save Mapping
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        
                        <div className="flex flex-col md:flex-row gap-3 justify-between">
                          <div className="flex items-center space-x-2">
                            <Switch 
                              id="import-to-db" 
                              checked={importCsvToDb}
                              onCheckedChange={setImportCsvToDb}
                            />
                            <Label htmlFor="import-to-db">Import to database</Label>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <Switch 
                              id="update-existing" 
                              checked={updateExisting}
                              onCheckedChange={setUpdateExisting}
                            />
                            <Label htmlFor="update-existing">Update existing entries</Label>
                          </div>
                        </div>
                      </div>
                      
                      <Button 
                        className="w-full bg-primary hover:bg-primary-dark text-white" 
                        disabled={!selectedFile || isImportingCsv}
                        onClick={handleCsvImport}
                      >
                        {isImportingCsv ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          "Import CSV File"
                        )}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Import Results</CardTitle>
              </CardHeader>
              <CardContent>
                {importResults ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-md">
                        <p className="text-sm text-blue-600 font-medium">Fetched</p>
                        <p className="text-3xl font-bold text-blue-700">{importResults.fetched}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-md">
                        <p className="text-sm text-green-600 font-medium">Imported</p>
                        <p className="text-3xl font-bold text-green-700">{importResults.imported}</p>
                      </div>
                    </div>
                    
                    {importResults.errors > 0 && (
                      <div className="bg-red-50 p-4 rounded-md">
                        <p className="text-sm text-red-600 font-medium">Errors</p>
                        <p className="text-3xl font-bold text-red-700">{importResults.errors}</p>
                      </div>
                    )}
                    
                    <p className="text-sm text-neutral-500 mt-4">
                      Last import completed at: {new Date().toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8 text-neutral-500">
                    <p>No import has been run yet.</p>
                    <p className="text-sm mt-2">
                      Use the form to import consignments from Axylog.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <div className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>API Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-neutral-600">Data Mode:</span>
                      <span className="text-sm font-medium px-2 py-1 bg-amber-100 text-amber-800 rounded">Demo Data</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-neutral-600">Status:</span>
                      <span className="text-sm font-medium px-2 py-1 bg-green-100 text-green-800 rounded">Ready</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}