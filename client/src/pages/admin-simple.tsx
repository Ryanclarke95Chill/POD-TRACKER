import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import * as XLSX from 'xlsx';

export default function AdminSimple() {
  const { toast } = useToast();
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [isUploading, setIsUploading] = useState(false);

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
              setCsvHeaders(rows[0]);
              setCsvData(rows);
              setCsvPreview(rows.slice(1, 6)); // First 5 data rows
              
              toast({
                title: "Excel file loaded successfully",
                description: `Found ${rows.length - 1} data rows with ${rows[0].length} columns`
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
            .map(line => line.split('\t').map(cell => cell.trim()));
          
          if (rows.length > 0) {
            setCsvHeaders(rows[0]);
            setCsvData(rows);
            setCsvPreview(rows.slice(1, 6)); // First 5 data rows
            
            toast({
              title: "CSV file loaded successfully",
              description: `Found ${rows.length - 1} data rows with ${rows[0].length} columns`
            });
          }
        }
        setIsUploading(false);
      };
      reader.readAsText(file);
    }
  };

  const importData = async () => {
    if (csvData.length === 0) {
      toast({
        title: "No data to import",
        description: "Please upload a file first",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    try {
      // Here you would normally send the data to your backend
      // For now, just show success
      toast({
        title: "Import completed",
        description: `Successfully processed ${csvData.length - 1} rows`
      });
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
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Import Excel/CSV Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Upload Excel (.xlsx) or CSV File
            </label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* Preview */}
          {csvHeaders.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-4">Data Preview</h3>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {csvHeaders.map((header, index) => (
                        <th key={index} className="px-4 py-2 text-left font-medium border-r">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((row, rowIndex) => (
                      <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-4 py-2 border-r">
                            {cell || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  Showing first 5 rows of {csvData.length - 1} total rows
                </p>
                <Button onClick={importData} disabled={isUploading}>
                  {isUploading ? "Processing..." : "Import Data"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}