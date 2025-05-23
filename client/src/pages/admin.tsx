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
import { getToken, getUser, logout } from "@/lib/auth";
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
  const [importResults, setImportResults] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importCsvToDb, setImportCsvToDb] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvSearch, setCsvSearch] = useState("");
  const [fieldSearch, setFieldSearch] = useState("");
  
  // Define consignment fields with categories
  const consignmentFields = {
    "Basic Info": [
      { name: "consignmentNumber", label: "Consignment Number", required: true },
      { name: "customerName", label: "Customer Name", required: true },
    ],
    "Locations": [
      { name: "pickupAddress", label: "Pickup Address", required: false },
      { name: "deliveryAddress", label: "Delivery Address", required: false },
      { name: "lastKnownLocation", label: "Last Known Location", required: false },
    ],
    "Status & Dates": [
      { name: "status", label: "Status", required: true },
      { name: "estimatedDeliveryDate", label: "Estimated Delivery Date", required: false },
    ],
    "Properties": [
      { name: "temperatureZone", label: "Temperature Zone", required: false },
    ]
  };
  
  // Flatten required fields for easier validation
  const requiredFields = Object.values(consignmentFields)
    .flat()
    .filter(field => field.required)
    .map(field => field.name);
  
  // Form setup for filter form
  const form = useForm<FilterFormValues>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      pickupDateFrom: new Date().toISOString().split('T')[0],
      pickupDateTo: new Date().toISOString().split('T')[0],
      deliveryEmail: "",
      customerName: "",
      importToDatabase: true,
      refreshExisting: false,
    },
  });
  
  async function onSubmit(values: FilterFormValues) {
    setIsImporting(true);
    try {
      const res = await apiRequest("/api/admin/import", {
        method: "POST",
        body: JSON.stringify(values),
      });
      
      toast({
        title: "Import completed",
        description: `Successfully imported ${res.importedCount} consignments`,
      });
      
      // Refresh consignments list
      queryClient.invalidateQueries({
        queryKey: ['/api/consignments']
      });
      
    } catch (err) {
      console.error("Error importing:", err);
      toast({
        title: "Import failed",
        description: "There was an error importing consignments",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };
  
  // State for CSV mapping
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mappingRequired, setMappingRequired] = useState(false);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [combineFields, setCombineFields] = useState<Record<string, string[]>>({});
  const [fieldDelimiters, setFieldDelimiters] = useState<Record<string, string>>({});
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [currentlyEditingField, setCurrentlyEditingField] = useState<string | null>(null);
  
  // State for mapping templates
  const [savedTemplates, setSavedTemplates] = useState<Record<string, {mapping: Record<string, string>, combine: Record<string, string[]>}>>({});
  const [templateName, setTemplateName] = useState("");
  const [showSaveTemplateInput, setShowSaveTemplateInput] = useState(false);
  
  // State for CSV field dropdown
  const [csvFieldFilter, setCsvFieldFilter] = useState("");
  
  // Process CSV file and detect headers
  const processCsvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const content = e.target.result as string;
        const rows = content.split('\n')
          .map(row => row.split(',').map(cell => cell.trim().replace(/^"(.*)"$/, '$1')));
        
        // Remove any empty rows
        const nonEmptyRows = rows.filter(row => row.some(cell => cell.trim() !== ''));
        
        if (nonEmptyRows.length < 2) {
          toast({
            title: "Invalid CSV",
            description: "The CSV file doesn't contain enough data",
            variant: "destructive"
          });
          return;
        }
        
        const headers = nonEmptyRows[0];
        setCsvHeaders(headers);
        setCsvData(nonEmptyRows);
        
        // Take first 5 rows for preview (or all if fewer)
        const previewRows = nonEmptyRows.slice(1, Math.min(6, nonEmptyRows.length));
        setCsvPreview(previewRows);
        
        // Auto-map fields where names match
        const initialMapping: Record<string, string> = {};
        const autoMapped: string[] = [];
        
        // Try to match CSV headers to field names
        headers.forEach(header => {
          // Clean up header for matching
          const cleanHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
          
          // Try to find a matching field
          for (const category in consignmentFields) {
            const match = consignmentFields[category].find(field => {
              const cleanField = field.name.toLowerCase().replace(/[^a-z0-9]/g, '');
              return cleanField === cleanHeader || 
                cleanField.includes(cleanHeader) || 
                cleanHeader.includes(cleanField);
            });
            
            if (match) {
              initialMapping[header] = match.name;
              autoMapped.push(header);
              break;
            }
          }
        });
        
        setFieldMapping(initialMapping);
        setAutoMappedFields(autoMapped);
        
        // If there are unmapped required fields, show mapping dialog
        const mappedRequiredFields = Object.values(initialMapping).filter(value => 
          requiredFields.includes(value)
        );
        
        setMappingRequired(mappedRequiredFields.length < requiredFields.length);
        
        // Show mapping dialog to let user confirm/adjust mappings
        setShowMappingDialog(true);
      }
    };
    
    reader.readAsText(file);
  };
  
  // Track auto-mapped fields
  const [autoMappedFields, setAutoMappedFields] = useState<string[]>([]);
  
  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      processCsvFile(file);
    }
  };
  
  // Handle drag events
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length) {
      const file = files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setSelectedFile(file);
        processCsvFile(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV file",
          variant: "destructive"
        });
      }
    }
  };
  
  // Update field mapping
  const updateFieldMapping = (csvField: string, appField: string) => {
    // If switching to or from combined field, handle the combineFields state
    if (appField === "combine") {
      // Initialize combined fields if not already set
      if (!combineFields[csvField]) {
        setCombineFields(prev => ({
          ...prev,
          [csvField]: []
        }));
      }
    } else if (fieldMapping[csvField] === "combine") {
      // Remove from combined fields if changing from combine to something else
      setCombineFields(prev => {
        const newCombine = { ...prev };
        delete newCombine[csvField];
        return newCombine;
      });
    }
    
    // Update the field mapping
    setFieldMapping(prev => ({
      ...prev,
      [csvField]: appField
    }));
  };
  
  // Add a field to combine with another
  const addCombineField = (targetField: string, fieldToAdd: string) => {
    setCombineFields(prev => {
      // If this field is already in another combination, remove it
      const newCombine = { ...prev };
      
      // Find if the field is already used in another combination
      Object.keys(newCombine).forEach(key => {
        if (key !== targetField && newCombine[key].includes(fieldToAdd)) {
          newCombine[key] = newCombine[key].filter(f => f !== fieldToAdd);
        }
      });
      
      // Add to the target combination if not already there
      if (!newCombine[targetField]?.includes(fieldToAdd)) {
        newCombine[targetField] = [...(newCombine[targetField] || []), fieldToAdd];
      }
      
      return newCombine;
    });
  };
  
  // Remove a field from combination
  const removeCombineField = (targetField: string, fieldToRemove: string) => {
    setCombineFields(prev => {
      if (!prev[targetField]) return prev;
      
      return {
        ...prev,
        [targetField]: prev[targetField].filter(f => f !== fieldToRemove)
      };
    });
  };
  
  // Get combined preview for display
  const getCombinedPreview = (field: string, rowIndex: number = 0): string => {
    if (!combineFields[field] || combineFields[field].length === 0) return "";
    
    // Get the delimiter for this field or use default
    const delimiter = fieldDelimiters[field] || ", ";
    
    // Get all the fields that are combined and their values from the preview
    const combinedValues = combineFields[field].map(header => {
      const headerIndex = csvHeaders.indexOf(header);
      return headerIndex >= 0 && csvPreview[rowIndex]?.[headerIndex] || "";
    }).filter(Boolean);
    
    // Join with the specified delimiter
    return combinedValues.join(delimiter);
  };
  
  // Update delimiter for a field
  const updateDelimiter = (field: string, delimiter: string) => {
    setFieldDelimiters(prev => ({
      ...prev,
      [field]: delimiter
    }));
  };
  
  // Save current mapping as a template
  const saveAsTemplate = (name: string) => {
    if (!name.trim()) {
      toast({
        title: "Template Name Required",
        description: "Please provide a name for your template.",
        variant: "destructive"
      });
      return;
    }
    
    setSavedTemplates(prev => ({
      ...prev,
      [name]: { 
        mapping: { ...fieldMapping },
        combine: { ...combineFields }
      }
    }));
    
    setTemplateName("");
    setShowSaveTemplateInput(false);
    
    toast({
      title: "Template Saved",
      description: `Field mapping template "${name}" has been saved for future use.`,
      variant: "default"
    });
  };
  
  // Load a saved template
  const loadTemplate = (name: string) => {
    if (savedTemplates[name]) {
      // First, check if the template headers match current CSV headers
      const templateFields = Object.keys(savedTemplates[name].mapping);
      const matchingHeaderCount = templateFields.filter(field => csvHeaders.includes(field)).length;
      const matchPercentage = (matchingHeaderCount / templateFields.length) * 100;
      
      if (matchPercentage < 70) {
        toast({
          title: "Template Mismatch",
          description: `This template only matches ${matchPercentage.toFixed(0)}% of your CSV headers. You may need to adjust mappings manually.`,
          variant: "destructive"
        });
      }
      
      // Apply the template where headers match
      const newMapping: Record<string, string> = {};
      csvHeaders.forEach(header => {
        if (savedTemplates[name].mapping[header]) {
          newMapping[header] = savedTemplates[name].mapping[header];
        } else {
          newMapping[header] = "";
        }
      });
      
      // Apply combined fields
      const newCombineFields: Record<string, string[]> = {};
      const templateCombine = savedTemplates[name].combine || {};
      Object.keys(templateCombine).forEach(key => {
        if (csvHeaders.includes(key)) {
          // Only include fields that exist in the current CSV
          const validCombinedFields = templateCombine[key].filter(
            field => csvHeaders.includes(field)
          );
          
          if (validCombinedFields.length > 0) {
            newCombineFields[key] = validCombinedFields;
          }
        }
      });
      
      setFieldMapping(newMapping);
      setCombineFields(newCombineFields);
      
      toast({
        title: "Template Applied",
        description: `Field mapping template "${name}" has been applied.`,
        variant: "default"
      });
    }
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
      
      // Add combine fields mapping to formData
      formData.append("combineFields", JSON.stringify(combineFields));
      
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
      queryClient.invalidateQueries({
        queryKey: ['/api/consignments']
      });
      
      toast({
        title: "Import Successful",
        description: `Successfully imported ${result.importedCount} consignments.`,
        variant: "default"
      });
      
      setShowMappingDialog(false);
      setSelectedFile(null);
      setCsvData([]);
      setCsvHeaders([]);
      setCsvPreview([]);
      setFieldMapping({});
      setCombineFields({});
      
    } catch (error) {
      console.error("Error during import:", error);
      toast({
        title: "Import Failed",
        description: "There was an error importing consignments. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsImportingCsv(false);
    }
  };
  
  // Find all fields that are already mapped
  const usedFields = Object.values(fieldMapping).filter(value => value && value !== "ignore" && value !== "combine");
  
  // User credentials
  const user = getUser();
  
  // Handle admin logout
  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-neutral-500">
            Logged in as {user?.name || user?.email}
          </span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <ArrowRight className="h-5 w-5 mr-2 text-primary" />
              Import Consignments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="pickupDateFrom"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pickup Date From</FormLabel>
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
                        <FormLabel>Pickup Date To</FormLabel>
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
                        <FormLabel>Delivery Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Optional" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Optional" {...field} />
                        </FormControl>
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
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-2 rounded-md">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Import to database</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="refreshExisting"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-2 rounded-md">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Update existing records</FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
                
                <Button type="submit" disabled={isImporting} className="w-full">
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
            
            {/* Import results */}
            {importResults && (
              <div className="mt-4 p-4 bg-primary/10 rounded-lg">
                <h3 className="text-sm font-medium mb-2">Import Results</h3>
                <div className="text-sm space-y-1">
                  <p>Imported: {importResults.importedCount} consignments</p>
                  {importResults.errors > 0 && (
                    <p className="text-red-500">Errors: {importResults.errors}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-lg">
              <FileSpreadsheet className="h-5 w-5 mr-2 text-primary" />
              Import from CSV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div 
                className={`border-2 border-dashed rounded-lg ${isDragging ? 'border-primary bg-primary/5' : 'border-neutral-200'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".csv"
                  onChange={handleFileSelect}
                />
                
                {selectedFile ? (
                  <div className="p-6">
                    <div className="flex items-center mb-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="font-medium truncate">{selectedFile.name}</p>
                        <p className="text-sm text-neutral-500">
                          {(selectedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedFile(null);
                          setCsvData([]);
                          setCsvHeaders([]);
                          setFieldMapping({});
                          setShowMappingDialog(false);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {isImportingCsv ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : (
                      <Button
                        onClick={() => setShowMappingDialog(true)}
                        className="w-full"
                      >
                        Configure Field Mapping
                      </Button>
                    )}
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
                <DialogContent className="max-w-4xl h-[90vh] p-0 flex flex-col">
                  <DialogHeader className="p-6 pb-2 sticky top-0 bg-white z-10 border-b">
                    <DialogTitle className="flex items-center text-xl">
                      <Table className="h-5 w-5 mr-2 text-primary" />
                      Map CSV Fields
                    </DialogTitle>
                    <DialogDescription>
                      Preview your data and map CSV fields to match the required fields in our system
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="flex-grow overflow-y-auto p-0">
                    {/* Tab navigation for better organization */}
                    <Tabs defaultValue="preview" className="w-full">
                      <div className="px-6 border-b">
                        <TabsList className="grid grid-cols-2">
                          <TabsTrigger value="preview">1. Data Preview</TabsTrigger>
                          <TabsTrigger value="mapping">2. Field Mapping</TabsTrigger>
                        </TabsList>
                      </div>
                      
                      <TabsContent value="preview" className="px-6 py-4 mb-0">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-base font-medium text-neutral-800">CSV Data Preview</h4>
                          <p className="text-xs text-neutral-500">Showing first 5 rows</p>
                        </div>
                        
                        <div className="border rounded-lg overflow-hidden">
                          <div className="overflow-x-auto" style={{ maxHeight: '400px' }}>
                            <table className="w-full text-sm border-collapse">
                              <thead className="sticky top-0 z-10">
                                <tr className="bg-primary/10">
                                  {csvHeaders.map((header, index) => (
                                    <th key={index} className="px-3 py-3 text-left font-medium text-neutral-700 border-b whitespace-nowrap">
                                      {header}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {csvPreview.map((row, rowIndex) => (
                                  <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}>
                                    {row.map((cell, cellIndex) => (
                                      <td key={cellIndex} className="px-3 py-2 text-neutral-700 border-t whitespace-nowrap">
                                        {cell?.length > 20 ? `${cell.substring(0, 20)}...` : cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        
                        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-4">
                          <p className="text-sm text-blue-700 flex items-start">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2 flex-shrink-0">
                              <circle cx="12" cy="12" r="10"></circle>
                              <path d="M12 16v-4"></path>
                              <path d="M12 8h.01"></path>
                            </svg>
                            <span>This preview shows the raw data from your CSV file. Click on "Field Mapping" to connect these columns to our system fields.</span>
                          </p>
                        </div>
                      </TabsContent>
                      
                      <TabsContent value="mapping" className="px-6 py-4 mb-0">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
                          <h4 className="text-base font-medium text-neutral-800">Field Mapping</h4>
                          
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Template controls */}
                            {Object.keys(savedTemplates).length > 0 && (
                              <div className="relative inline-block">
                                <select 
                                  className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs"
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      loadTemplate(e.target.value);
                                    }
                                    e.target.value = ""; // Reset after selection
                                  }}
                                  defaultValue=""
                                >
                                  <option value="" disabled>Load template...</option>
                                  {Object.keys(savedTemplates).map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            
                            {/* Template save button or input */}
                            {showSaveTemplateInput ? (
                              <div className="relative flex items-center">
                                <input
                                  type="text"
                                  value={templateName}
                                  onChange={(e) => setTemplateName(e.target.value)}
                                  placeholder="Template name..."
                                  className="h-8 text-xs rounded-l-md border border-primary-dark focus:ring-0 focus:outline-none px-2 py-1 bg-white"
                                />
                                <button
                                  onClick={() => saveAsTemplate(templateName)}
                                  className="h-8 rounded-r-md bg-primary text-white px-2 text-xs border border-primary-dark"
                                >
                                  Save
                                </button>
                                <button 
                                  onClick={() => {
                                    setShowSaveTemplateInput(false);
                                    setTemplateName("");
                                  }}
                                  className="absolute right-0 -top-2 -mr-2 -mt-1 h-5 w-5 rounded-full bg-neutral-500 text-white flex items-center justify-center"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowSaveTemplateInput(true)}
                                className="h-8 rounded-md border border-neutral-200 bg-white text-xs px-2 py-1 flex items-center hover:bg-gray-50 transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                  <polyline points="7 3 7 8 15 8"></polyline>
                                </svg>
                                Save as Template
                              </button>
                            )}
                            
                            {/* Legend */}
                            <div className="text-xs text-neutral-500 italic flex gap-2 flex-wrap">
                              <span className="inline-flex items-center bg-white px-2 py-1 rounded-md border">
                                <CheckCircle2 className="h-3 w-3 text-green-500 mr-1" /> Auto-matched
                              </span>
                              <span className="inline-flex items-center bg-white px-2 py-1 rounded-md border">
                                <span className="h-2 w-2 bg-amber-400 rounded-full mr-1"></span> Required
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-neutral-50 p-4 mb-4 rounded-lg">
                          <p className="text-sm">
                            The system has automatically matched fields from your CSV to our system. 
                            Please review and adjust if necessary. All required fields must be mapped.
                          </p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Object.entries({
                            "consignmentNumber": "Consignment Number",
                            "customerName": "Customer Name",
                            "deliveryAddress": "Delivery Address",
                            "estimatedDeliveryDate": "Estimated Delivery Date",
                            "lastKnownLocation": "Last Known Location",
                            "pickupAddress": "Pickup Address",
                            "status": "Status",
                            "temperatureZone": "Temperature Zone"
                          }).sort((a, b) => a[1].localeCompare(b[1])).map(([fieldKey, fieldLabel], index) => {
                            // Find if any CSV header is mapped to this field
                            const mappedHeader = Object.entries(fieldMapping).find(([_, value]) => value === fieldKey)?.[0];
                            const isRequired = ["consignmentNumber", "customerName", "status"].includes(fieldKey);
                            const isMapped = !!mappedHeader;
                            
                            return (
                              <div key={index} className={`
                                p-4 border rounded-md
                                ${isRequired ? 'border-amber-200 bg-amber-50/30' : 'border-neutral-200'}
                                ${isMapped && (!mappedHeader || fieldMapping[mappedHeader] !== "ignore") ? 'border-green-200 bg-green-50/20' : ''}
                                ${mappedHeader && fieldMapping[mappedHeader] === "ignore" ? 'opacity-60 bg-gray-50' : ''}
                              `}>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="font-medium text-sm flex items-center">
                                    {fieldLabel} {isRequired && <span className="text-amber-500 ml-1">*</span>}
                                    {isMapped && (!mappedHeader || fieldMapping[mappedHeader] !== "ignore") && <CheckCircle2 className="h-3 w-3 text-green-500 ml-2" />}
                                  </label>
                                  
                                  {mappedHeader && (
                                    <div className="flex items-center space-x-2">
                                      <div className={`${isRequired ? 'opacity-50' : ''}`}>
                                        <Switch 
                                          checked={fieldMapping[mappedHeader] !== "ignore"}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              // Restore to normal mapping
                                              updateFieldMapping(mappedHeader, fieldKey);
                                            } else {
                                              // Set to ignore
                                              updateFieldMapping(mappedHeader, "ignore");
                                            }
                                          }}
                                          disabled={isRequired}
                                        />
                                      </div>
                                      <span className="text-xs text-neutral-500">
                                        {isRequired 
                                          ? "Required" 
                                          : fieldMapping[mappedHeader] !== "ignore" 
                                            ? "Active" 
                                            : "Ignored"
                                        }
                                      </span>
                                    </div>
                                  )}
                                </div>
                                
                                <p className="text-xs text-neutral-500 mt-1 mb-2">System field</p>
                                
                                <div className="mt-2">
                                  <div className="flex flex-col space-y-2">
                                    <div className="relative">
                                      <input
                                        type="text"
                                        placeholder="Search CSV fields..."
                                        value={csvSearch}
                                        onChange={(e) => setCsvSearch(e.target.value)}
                                        className="w-full px-3 py-1.5 text-sm border border-neutral-200 rounded-md focus:ring-1 focus:ring-primary focus:border-primary mb-1"
                                      />
                                      {csvSearch && (
                                        <button
                                          onClick={() => setCsvSearch("")}
                                          className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-neutral-200 flex items-center justify-center"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center space-x-2">
                                      <div className="w-full relative">
                                        <select
                                          className={`w-full rounded-md border border-neutral-200 p-2 bg-white
                                            ${mappedHeader && fieldMapping[mappedHeader] === "ignore" ? 'bg-gray-50 text-gray-400' : ''}
                                          `}
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
                                          {[...csvHeaders]
                                            .filter(header => !csvSearch || header.toLowerCase().includes(csvSearch.toLowerCase()))
                                            .sort((a, b) => a.localeCompare(b))
                                            .map((header, headerIndex) => (
                                              <option key={headerIndex} value={header}>{header}</option>
                                            ))}
                                        </select>
                                      </div>
                                      
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCurrentlyEditingField(fieldKey);
                                        }}
                                        className="flex-shrink-0 w-8 h-8 rounded-md border border-neutral-200 bg-white flex items-center justify-center hover:bg-neutral-50"
                                        title="Add more fields to combine"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M12 5v14M5 12h14" />
                                        </svg>
                                      </button>
                                    </div>
                                    
                                    {/* Field combination dialog */}
                                    {currentlyEditingField === fieldKey && (
                                      <div className="mt-3 border rounded-md p-3 bg-neutral-50">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-sm font-medium">Combine Fields</span>
                                          <button 
                                            onClick={() => setCurrentlyEditingField(null)}
                                            className="h-5 w-5 rounded-full bg-neutral-200 flex items-center justify-center"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                        
                                        <p className="text-xs text-neutral-500 mb-3">
                                          Select additional CSV fields to combine with the primary field.
                                        </p>
                                        
                                        <div className="mb-3">
                                          <div className="text-xs font-medium mb-1">Select delimiter:</div>
                                          <div className="flex flex-wrap gap-2">
                                            {[
                                              { label: "Comma (,)", value: ", " },
                                              { label: "Space", value: " " },
                                              { label: "Hyphen (-)", value: " - " },
                                              { label: "Newline", value: "\n" },
                                              { label: "Nothing", value: "" }
                                            ].map((delimiterOption) => (
                                              <button
                                                key={delimiterOption.value}
                                                type="button"
                                                onClick={() => updateDelimiter(fieldKey, delimiterOption.value)}
                                                className={`text-xs py-1 px-2 rounded-md border
                                                  ${(fieldDelimiters[fieldKey] || ", ") === delimiterOption.value 
                                                    ? 'bg-primary text-white border-primary' 
                                                    : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                                                  }`}
                                              >
                                                {delimiterOption.label}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                        
                                        <div className="text-xs font-medium mb-2">Select fields to combine:</div>
                                        
                                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1 mb-3 border rounded-md p-2 bg-white">
                                          <div className="relative mb-2">
                                            <input
                                              type="text"
                                              placeholder="Search fields..."
                                              value={fieldSearch}
                                              onChange={(e) => setFieldSearch(e.target.value)}
                                              className="w-full px-2 py-1 text-xs border border-neutral-200 rounded-md focus:ring-1 focus:ring-primary focus:border-primary"
                                            />
                                            {fieldSearch && (
                                              <button
                                                onClick={() => setFieldSearch("")}
                                                className="absolute right-1 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-neutral-200 flex items-center justify-center"
                                              >
                                                <X className="h-2 w-2" />
                                              </button>
                                            )}
                                          </div>
                                          
                                          {[...csvHeaders]
                                            .filter(header => !fieldSearch || header.toLowerCase().includes(fieldSearch.toLowerCase()))
                                            .sort((a, b) => a.localeCompare(b))
                                            .map((header) => (
                                              <div key={header} className="flex items-center">
                                                <Checkbox 
                                                  id={`combine-${fieldKey}-${header}`}
                                                  checked={header === mappedHeader || combineFields[fieldKey]?.includes(header) || false}
                                                  disabled={header === mappedHeader} // Primary field is always selected
                                                  onCheckedChange={(checked) => {
                                                    if (header === mappedHeader) return; // Skip the primary field
                                                    
                                                    if (checked) {
                                                      // Initialize combineFields for this field if it doesn't exist
                                                      if (!combineFields[fieldKey]) {
                                                        setCombineFields(prev => ({
                                                          ...prev,
                                                          [fieldKey]: [header]
                                                        }));
                                                      } else {
                                                        addCombineField(fieldKey, header);
                                                      }
                                                    } else {
                                                      removeCombineField(fieldKey, header);
                                                    }
                                                  }}
                                                  className="mr-2"
                                                />
                                                <label 
                                                  htmlFor={`combine-${fieldKey}-${header}`}
                                                  className={`text-xs cursor-pointer ${header === mappedHeader ? 'font-semibold' : ''}`}
                                                >
                                                  {header} {header === mappedHeader && <span className="text-primary-dark">(primary)</span>}
                                                </label>
                                              </div>
                                            ))}
                                        </div>
                                        
                                        <div className="mt-3 bg-white p-2 rounded border">
                                          <div className="flex justify-between items-center">
                                            <div className="text-xs font-medium">Preview:</div>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                // Show a different row in the preview
                                                // You could implement this to cycle through rows
                                                toast({
                                                  title: "Preview Feature",
                                                  description: "In a full implementation, this would let you cycle through data rows",
                                                  duration: 2000
                                                });
                                              }}
                                              className="text-xs text-primary"
                                            >
                                              Next Row
                                            </button>
                                          </div>
                                          
                                          <div className="text-xs font-mono bg-neutral-50 p-2 rounded mt-1 break-all border">
                                            {mappedHeader && (
                                              <span className="font-semibold">{csvPreview[0]?.[csvHeaders.indexOf(mappedHeader)] || ""}</span>
                                            )}
                                            
                                            {combineFields[fieldKey]?.map((field, i) => {
                                              const value = csvPreview[0]?.[csvHeaders.indexOf(field)] || "";
                                              if (!value) return null;
                                              
                                              return (
                                                <span key={field}>
                                                  <span className="text-neutral-400">{fieldDelimiters[fieldKey] || ", "}</span>
                                                  {value}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Combined fields indicators */}
                                    {combineFields[fieldKey]?.length > 0 && currentlyEditingField !== fieldKey && (
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        <span className="text-xs bg-primary-light/20 text-primary-dark rounded-md px-1.5 py-0.5 flex items-center">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M16 3h5v5"></path><path d="M4 20 L21 3"></path>
                                            <path d="M21 16v5h-5"></path><path d="M15 15l6 6"></path>
                                            <path d="M4 4l6 6"></path>
                                          </svg>
                                          Combined with {combineFields[fieldKey].length} field{combineFields[fieldKey].length !== 1 ? 's' : ''}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        <div className="mb-4 mt-6 bg-primary/10 border border-primary/20 rounded-lg p-4">
                          <p className="text-sm text-primary-dark flex items-start">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2 flex-shrink-0 text-primary">
                              <path d="m9 12 2 2 4-4"></path>
                              <path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9-9 9-9-1.8-9-9 1.8-9 9-9Z"></path>
                            </svg>
                            <span>All mapped fields will be used to import consignments. Be sure to map at least the required fields.</span>
                          </p>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                  
                  <DialogFooter className="p-4 border-t bg-neutral-50 mt-auto">
                    <Button variant="outline" onClick={() => setShowMappingDialog(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCsvImport} 
                      disabled={isImportingCsv}
                      className="ml-2"
                    >
                      {isImportingCsv ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        "Import CSV Data"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}