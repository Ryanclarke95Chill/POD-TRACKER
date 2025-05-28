import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, Zap } from "lucide-react";
import * as XLSX from 'xlsx';

export default function SimpleImport() {
  const [fileData, setFileData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length > 0) {
          const headerRow = jsonData[0] as string[];
          setHeaders(headerRow);
          setFileData(jsonData as any[][]);
          setShowPreview(true);
          
          toast({
            title: "File uploaded successfully",
            description: `Found ${jsonData.length - 1} rows with ${headerRow.length} columns`,
          });
        }
      } catch (error) {
        toast({
          title: "Error reading file",
          description: "Please ensure the file is a valid Excel file",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
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
          <CardTitle className="flex items-center space-x-2">
            <FileSpreadsheet className="h-6 w-6" />
            <span>Excel Import</span>
          </CardTitle>
          <CardDescription>
            Upload your Excel file and let our smart system automatically map all columns
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="file-upload">Upload Excel File</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="cursor-pointer"
            />
          </div>

          {showPreview && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-blue-900">Smart Auto-Mapping Ready</h3>
                </div>
                <p className="text-blue-700 mt-2">
                  Your Excel file will be automatically processed with intelligent column mapping. 
                  Headers like "Weight [kg]" become "weight_kg", "Trip number" becomes "trip_number" automatically!
                </p>
                <div className="mt-3 text-sm text-blue-600">
                  <strong>Ready to import:</strong> {fileData.length - 1} rows with {headers.length} columns detected
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-md font-semibold mb-2">Data Preview (first 5 rows)</h4>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {headers.slice(0, 10).map((header, index) => (
                          <th key={index} className="px-3 py-2 text-left font-medium text-gray-700 border-b">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fileData.slice(1, 6).map((row, rowIndex) => (
                        <tr key={rowIndex} className={rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          {row.slice(0, 10).map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-3 py-2 border-b text-gray-900">
                              {cell || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {headers.length > 10 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Showing first 10 columns. Total columns: {headers.length}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex space-x-4">
            <Button 
              onClick={handleImport} 
              disabled={!showPreview || isUploading}
              className="flex items-center space-x-2"
            >
              <Upload className="h-4 w-4" />
              <span>{isUploading ? "Importing..." : "Import Data"}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}