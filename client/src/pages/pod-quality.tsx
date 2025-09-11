import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { 
  Camera, 
  ExternalLink, 
  Thermometer, 
  FileSignature, 
  Download,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  LogOut,
  BarChart3,
  RefreshCw,
  Home,
  X
} from "lucide-react";
import { Link } from "wouter";
import { getUser, logout } from "@/lib/auth";
import { Consignment } from "@shared/schema";

interface PhotoGalleryProps {
  trackingLink: string;
  consignmentNo: string;
}

function PhotoGallery({ trackingLink, consignmentNo }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const extractPhotosFromTracking = async (trackingLink: string) => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch the tracking page HTML through our authenticated proxy
      const response = await apiRequest('GET', `/api/proxy-tracking?url=${encodeURIComponent(trackingLink)}`);
      const html = await response.text();
      
      // Debug: Log a snippet of the HTML to see what we're working with
      console.log('HTML snippet:', html.substring(0, 1000));
      
      // Extract Azure blob storage URLs for images
      // Looking for URLs like: https://axylogdata.blob.core.windows.net/...jpg
      let imageUrlRegex = /https:\/\/axylogdata\.blob\.core\.windows\.net\/[^"'\s]+\.(jpg|jpeg|png|gif)/gi;
      let matches = html.match(imageUrlRegex) || [];
      
      // If no matches, try broader patterns
      if (matches.length === 0) {
        console.log('No Azure blob URLs found, trying broader patterns...');
        
        // Try any image URLs
        imageUrlRegex = /https:\/\/[^"'\s]+\.(jpg|jpeg|png|gif)/gi;
        matches = html.match(imageUrlRegex) || [];
        console.log('Found image URLs:', matches);
        
        // Try looking for specific patterns in the HTML
        const srcPattern = /src\s*=\s*["']([^"']*\.(jpg|jpeg|png|gif)[^"']*)["']/gi;
        const srcMatches = [];
        let match;
        while ((match = srcPattern.exec(html)) !== null) {
          srcMatches.push(match[1]);
        }
        console.log('Found src attributes:', srcMatches);
        
        // Combine all found images
        matches = [...matches, ...srcMatches];
      }
      
      // Remove duplicates and filter valid image URLs
      const uniquePhotos = Array.from(new Set(matches));
      console.log('Final photo URLs:', uniquePhotos);
      
      setPhotos(uniquePhotos);
    } catch (err) {
      console.error('Error extracting photos:', err);
      setError('Unable to extract photos from tracking link');
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  };

  // Extract photos when component mounts or tracking link changes
  useEffect(() => {
    if (trackingLink) {
      extractPhotosFromTracking(trackingLink);
    }
  }, [trackingLink]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-8">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-lg font-medium">Loading photos...</p>
          <p className="text-sm text-gray-500">Extracting images from tracking system</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full py-8">
        <div className="text-center text-red-500">
          <AlertTriangle className="h-8 w-8 mx-auto mb-4" />
          <p className="text-lg font-medium">{error}</p>
          <Button 
            onClick={() => window.open(trackingLink, '_blank')} 
            variant="outline" 
            className="mt-4"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Full Tracking Page
          </Button>
        </div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex items-center justify-center h-full py-8 text-gray-500">
        <div className="text-center">
          <Camera className="h-8 w-8 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium">No photos found</p>
          <p className="text-sm">Photos may not be available for this consignment</p>
          <Button 
            onClick={() => window.open(trackingLink, '_blank')} 
            variant="outline" 
            className="mt-4"
            size="sm"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Tracking Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <p className="text-sm text-gray-600">
          Found {photos.length} photo{photos.length !== 1 ? 's' : ''} for {consignmentNo}
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto">
        {photos.map((photoUrl, index) => (
          <div 
            key={index}
            className="relative group cursor-pointer border rounded-lg overflow-hidden hover:shadow-lg transition-shadow bg-white"
            onClick={() => window.open(photoUrl, '_blank')}
            data-testid={`photo-${index}`}
          >
            <img
              src={photoUrl}
              alt={`POD Photo ${index + 1} for ${consignmentNo}`}
              className="w-full h-48 object-cover"
              onError={(e) => {
                // Hide broken images
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
              <ExternalLink className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
              <p className="text-white text-sm font-medium">Photo {index + 1}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PODMetrics {
  photoCount: number;
  hasSignature: boolean;
  temperatureCompliant: boolean;
  hasTrackingLink: boolean;
  deliveryTime: string | null;
  qualityScore: number;
  hasReceiverName: boolean;
}

interface PODAnalysis {
  consignment: Consignment;
  metrics: PODMetrics;
}

export default function PODQuality() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedWarehouse, setSelectedWarehouse] = useState("all");
  const [selectedShipper, setSelectedShipper] = useState("all");
  const [selectedDriver, setSelectedDriver] = useState("all");
  const [selectedTempZone, setSelectedTempZone] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [selectedConsignment, setSelectedConsignment] = useState<Consignment | null>(null);
  const user = getUser();

  // Fetch all consignments and filter for delivered ones
  const { data: allConsignments = [], isLoading } = useQuery({
    queryKey: ['/api/consignments'],
  });

  // Helper function to map status labels
  const getStatusDisplay = (consignment: Consignment) => {
    const deliveryStateLabel = (consignment as any).delivery_StateLabel;
    const pickupStateLabel = (consignment as any).pickUp_StateLabel;
    
    const mapStatus = (status: string | null, isPickup: boolean = false) => {
      if (!status) return null;
      if (status === 'Traveling') return 'In Transit';
      if (status === 'GPS not present') return 'In Transit';
      if (status === 'Positive outcome') return isPickup ? 'Picked Up' : 'Delivered';
      if (status === 'Delivered') return 'Delivered';
      if (status === 'Not delivered') return 'Failed Delivery';
      if (status === 'Not picked up') return 'Failed Pickup';
      if (status === 'Negative outcome') return isPickup ? 'Failed Pickup' : 'Failed Delivery';
      if (status === 'Arrived') return 'Arrived';
      return status;
    };
    
    return mapStatus(deliveryStateLabel, false) || mapStatus(pickupStateLabel, true) || 'In Transit';
  };

  // Helper function to extract temperature zone from documentNote
  const getTemperatureZone = (consignment: Consignment) => {
    const tempZone = consignment.documentNote?.split('\\')[0] || consignment.expectedTemperature || 'Standard';
    
    // Filter out internal depot operations
    if (tempZone === 'Return to depot' || tempZone?.toLowerCase().includes('return to depot')) {
      return 'Internal Transfer';
    }
    
    return tempZone;
  };

  // Filter for delivered consignments
  const deliveredConsignments = (allConsignments as Consignment[]).filter((consignment: Consignment) => {
    const status = getStatusDisplay(consignment);
    return status === 'Delivered';
  });

  // Get unique values for filter dropdowns
  const warehouseCompanies = Array.from(
    new Set(deliveredConsignments.map(c => c.warehouseCompanyName).filter(Boolean))
  ).sort();

  const shipperCompanies = Array.from(
    new Set(deliveredConsignments.map(c => (c as any).shipperCompanyName).filter(Boolean))
  ).sort();

  const driverNames = Array.from(
    new Set(deliveredConsignments.map(c => c.driverName).filter(Boolean))
  ).sort();

  const temperatureZones = Array.from(
    new Set(deliveredConsignments.map(c => getTemperatureZone(c)).filter(Boolean))
  ).sort();

  // Analyze POD quality for each consignment
  const analyzePOD = (consignment: Consignment): PODAnalysis => {
    const photoCount = countPhotos(consignment);
    const hasSignature = Boolean(consignment.deliverySignatureName);
    const hasReceiverName = Boolean(consignment.deliverySignatureName && consignment.deliverySignatureName.trim().length > 0);
    const temperatureCompliant = checkTemperatureCompliance(consignment);
    const hasTrackingLink = Boolean(consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink);
    const deliveryTime = consignment.delivery_OutcomeDateTime;
    
    // Calculate quality score based on your 5 criteria:
    // 1. 3+ photos (required - negative scoring if less)
    // 2. Signed 
    // 3. Name of receiver
    // 4. Temperature compliance
    // 5. Clear photos (TBD - not implemented yet)
    
    let score = 0;
    
    // Photo scoring: 3+ = good, 2 = negative, 1 = more negative, 0 = complete fail
    if (photoCount >= 3) {
      score += 25; // Good photo count
    } else if (photoCount === 2) {
      score -= 10; // Negative for 2 photos
    } else if (photoCount === 1) {
      score -= 20; // More negative for 1 photo
    } else {
      score -= 50; // Complete fail for 0 photos
    }
    
    if (hasSignature) score += 25;
    if (hasReceiverName) score += 25;
    if (temperatureCompliant) score += 25;
    // Clear photos criteria TBD
    
    // Ensure score doesn't go below 0
    score = Math.max(0, score);
    
    const metrics: PODMetrics = {
      photoCount,
      hasSignature,
      temperatureCompliant,
      hasTrackingLink,
      deliveryTime,
      qualityScore: score,
      hasReceiverName
    };

    return { consignment, metrics };
  };

  // Count photos from POD files using Axylog file count data
  const countPhotos = (consignment: Consignment): number => {
    let count = 0;
    
    // First check if we have actual file count data from Axylog API
    const deliveryFileCount = (consignment as any).deliveryReceivedFileCount || 0;
    const pickupFileCount = (consignment as any).pickupReceivedFileCount || 0;
    
    // Use the file count data from Axylog API if available
    if (deliveryFileCount > 0 || pickupFileCount > 0) {
      count = Number(deliveryFileCount) + Number(pickupFileCount);
      
      // Subtract signatures from file count since they're included in the total
      // but we want to count actual photos only
      if (consignment.deliverySignatureName && deliveryFileCount > 0) {
        count = Math.max(0, count - 1); // Subtract delivery signature
      }
      if (consignment.pickupSignatureName && pickupFileCount > 0) {
        count = Math.max(0, count - 1); // Subtract pickup signature  
      }
      
      return count;
    }
    
    // Fallback: Check if actual file paths are provided
    if (consignment.deliveryPodFiles) {
      count += consignment.deliveryPodFiles.split(',').filter(f => f.trim()).length;
    }
    if (consignment.receivedDeliveryPodFiles) {
      count += consignment.receivedDeliveryPodFiles.split(',').filter(f => f.trim()).length;
    }
    
    // If no file paths but we have delivery signatures and tracking links,
    // estimate based on presence of other delivery evidence
    if (count === 0) {
      // If there's a delivery signature, likely at least 1 photo
      if (consignment.deliverySignatureName) {
        count += 1;
      }
      
      // If there's a tracking link and it's delivered, likely photos exist
      if (consignment.deliveryLiveTrackLink && getStatusDisplay(consignment) === 'Delivered') {
        count += Math.max(1, count); // At least 1 photo if delivered with tracking
      }
    }
    
    return count;
  };

  // Format temperature display for expected vs actual
  const formatTemperatureDisplay = (consignment: Consignment) => {
    // Extract expected temperature from document_note (e.g., "Frozen -18C to -20C")
    let expected = 'N/A';
    if (consignment.documentNote) {
      const tempMatch = consignment.documentNote.match(/^([^\\n]+)/);
      if (tempMatch) {
        expected = tempMatch[1].trim();
        // Clean up the temperature format
        if (expected.includes('\\n') || expected.includes('\\')) {
          expected = expected.split('\\')[0].trim();
        }
      }
    }
    
    // Fallback to expectedTemperature field if available
    if (expected === 'N/A' && consignment.expectedTemperature) {
      expected = consignment.expectedTemperature;
    }
    
    // Get actual temperature readings from Axylog fields
    const temp1 = (consignment as any).amountToCollect;
    const temp2 = (consignment as any).amountCollected;
    const tempPayment = (consignment as any).paymentMethod;
    
    let actualTemps = [];
    
    // amountToCollect = Temp 1 (999 = default/blank)
    if (temp1 && temp1 !== 999 && temp1 !== '999' && !isNaN(parseFloat(temp1.toString()))) {
      actualTemps.push(`${temp1}°C`);
    }
    
    // amountCollected = Temp 2  
    if (temp2 && temp2 !== 999 && temp2 !== '999' && !isNaN(parseFloat(temp2.toString()))) {
      actualTemps.push(`${temp2}°C`);
    }
    
    // paymentMethod = Additional temp reading  
    if (tempPayment && tempPayment !== 999 && tempPayment !== '999' && !isNaN(parseFloat(tempPayment))) {
      actualTemps.push(`${tempPayment}°C`);
    }
    
    let actual = actualTemps.length > 0 ? actualTemps.join(', ') : 'No readings available';
    
    return { expected, actual };
  };

  // Check if temperature requirements were met using actual recorded temperatures
  const checkTemperatureCompliance = (consignment: Consignment): boolean => {
    // Get expected temperature from document_note or expectedTemperature field
    let expectedTemp = consignment.expectedTemperature;
    if (!expectedTemp && consignment.documentNote) {
      const tempMatch = consignment.documentNote.match(/^([^\\n]+)/);
      if (tempMatch) {
        expectedTemp = tempMatch[1].trim();
      }
    }
    
    // If no expected temperature is specified, we can't determine compliance
    if (!expectedTemp) return true;
    
    // Parse temperature range from expected temp zone (e.g., "Frozen -18C to -20C")
    const parseTemperatureRange = (tempZone: string) => {
      // Look for patterns like "-18C to -20C", "0C to +4C", "-18 to -20", "0–4°C", "2–8°C", etc.
      // Updated regex to handle optional + signs and various separators
      const rangeMatch = tempZone.match(/([+-]?\d+)\s*(?:C|°C)?\s*(?:to|–|-)\s*([+-]?\d+)\s*(?:C|°C)?/i);
      if (rangeMatch) {
        const temp1 = parseFloat(rangeMatch[1]);
        const temp2 = parseFloat(rangeMatch[2]);
        return {
          min: Math.min(temp1, temp2),
          max: Math.max(temp1, temp2)
        };
      }
      
      // Look for single temperature values (e.g., "14°C", "+14°C")
      const singleMatch = tempZone.match(/([+-]?\d+)\s*(?:C|°C)/i);
      if (singleMatch) {
        const temp = parseFloat(singleMatch[1]);
        return { min: temp, max: temp };
      }
      return null;
    };
    
    // Get the expected temperature range
    const expectedRange = parseTemperatureRange(expectedTemp);
    if (!expectedRange) {
      // Fallback to text matching if we can't parse numeric ranges
      const expectedLower = expectedTemp.toLowerCase();
      const documentNote = consignment.documentNote;
      if (!documentNote) return true;
      
      const actualTempZone = documentNote.split('\\')[0].toLowerCase();
      
      if (expectedLower.includes('frozen') || expectedLower.includes('freezer')) {
        return actualTempZone.includes('frozen') || actualTempZone.includes('freezer');
      }
      
      if (expectedLower.includes('chiller')) {
        return actualTempZone.includes('chiller');
      }
      
      return true; // If we can't determine, assume compliant
    }
    
    // Get all actual temperature readings
    const temp1 = (consignment as any).amountToCollect;
    const temp2 = (consignment as any).amountCollected;
    const tempPayment = (consignment as any).paymentMethod;
    
    let actualTemps = [];
    
    // Collect all valid temperature readings (filter out 999 values)
    if (temp1 && temp1 !== 999 && temp1 !== '999' && !isNaN(parseFloat(temp1.toString()))) {
      actualTemps.push(parseFloat(temp1.toString()));
    }
    if (temp2 && temp2 !== 999 && temp2 !== '999' && !isNaN(parseFloat(temp2.toString()))) {
      actualTemps.push(parseFloat(temp2.toString()));
    }
    if (tempPayment && tempPayment !== 999 && tempPayment !== '999' && !isNaN(parseFloat(tempPayment))) {
      actualTemps.push(parseFloat(tempPayment));
    }
    
    // If no actual temperature readings, assume compliant
    if (actualTemps.length === 0) return true;
    
    // Check if ANY actual temperature falls within the expected range
    return actualTemps.some(actualTemp => 
      actualTemp >= expectedRange.min && actualTemp <= expectedRange.max
    );
  };

  // Process and filter consignments
  const podAnalyses: PODAnalysis[] = deliveredConsignments
    .map(analyzePOD)
    .filter((analysis: PODAnalysis) => {
      const consignment = analysis.consignment;
      const metrics = analysis.metrics;
      
      // Text search filter
      const matchesSearch = searchTerm === "" || 
        consignment.consignmentNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        consignment.shipToCompanyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        consignment.driverName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Warehouse filter
      const matchesWarehouse = selectedWarehouse === "all" || 
        consignment.warehouseCompanyName === selectedWarehouse;
      
      // Shipper filter
      const matchesShipper = selectedShipper === "all" || 
        (consignment as any).shipperCompanyName === selectedShipper;
      
      // Driver filter
      const matchesDriver = selectedDriver === "all" || 
        consignment.driverName === selectedDriver;
      
      // Temperature zone filter
      const tempZone = getTemperatureZone(consignment);
      const matchesTempZone = selectedTempZone === "all" || tempZone === selectedTempZone;
      
      // Date range filter (use delivery outcome date)
      const matchesDateRange = (() => {
        if (!fromDate && !toDate) return true;
        
        const deliveryDate = metrics.deliveryTime;
        if (!deliveryDate) return true; // Show consignments without delivery dates
        
        // Convert to AEST timezone for comparison
        const utcDate = new Date(deliveryDate);
        const aestDate = new Date(utcDate.getTime() + (10 * 60 * 60 * 1000)); // Add 10 hours for AEST
        const dateString = aestDate.toISOString().split('T')[0];
        
        if (fromDate && toDate) {
          return dateString >= fromDate && dateString <= toDate;
        } else if (fromDate) {
          return dateString >= fromDate;
        } else if (toDate) {
          return dateString <= toDate;
        }
        return true;
      })();
      
      // Quality filter
      const matchesQuality = (() => {
        switch (selectedFilter) {
          case "excellent":
            return metrics.qualityScore >= 80;
          case "good":
            return metrics.qualityScore >= 60 && metrics.qualityScore < 80;
          case "poor":
            return metrics.qualityScore < 60;
          case "missing-photos":
            return metrics.photoCount === 0;
          case "missing-signature":
            return !metrics.hasSignature;
          case "temp-issues":
            return !metrics.temperatureCompliant;
          default:
            return true;
        }
      })();
      
      return matchesSearch && matchesWarehouse && matchesShipper && 
             matchesDriver && matchesTempZone && matchesDateRange && matchesQuality;
    });

  // Calculate summary statistics
  const totalDeliveries = podAnalyses.length;
  const avgPhotoCount = totalDeliveries > 0 ? 
    podAnalyses.reduce((sum, a) => sum + a.metrics.photoCount, 0) / totalDeliveries : 0;
  const signatureRate = totalDeliveries > 0 ? 
    (podAnalyses.filter(a => a.metrics.hasSignature).length / totalDeliveries) * 100 : 0;
  const tempComplianceRate = totalDeliveries > 0 ? 
    (podAnalyses.filter(a => a.metrics.temperatureCompliant).length / totalDeliveries) * 100 : 0;
  const avgQualityScore = totalDeliveries > 0 ? 
    podAnalyses.reduce((sum, a) => sum + a.metrics.qualityScore, 0) / totalDeliveries : 0;

  const getQualityBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-100 text-yellow-800">Good</Badge>;
    return <Badge className="bg-red-100 text-red-800">Poor</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleString('en-AU', {
        timeZone: 'Australia/Sydney',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="animate-pulse space-y-4 p-6">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Handle sync from Axylog
  const handleSyncFromAxylog = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/axylog/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          syncFromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 7 days
          syncToDate: new Date().toISOString().split('T')[0]
        })
      });

      if (response.ok) {
        // Refresh the consignments data
        window.location.reload();
      } else {
        console.error('Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="gradient-primary shadow-header z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-3xl font-bold text-white">ChillTrack</h1>
            <span className="ml-3 text-blue-100 text-sm">POD Quality Analysis</span>
          </div>
          
          <div className="flex items-center space-x-3">
            <Link href="/">
              <Button variant="ghost" className="text-white hover:bg-white/10">
                <Home className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            
            <Button 
              onClick={handleSyncFromAxylog}
              disabled={isSyncing}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Axylog'}
            </Button>
            
            <div className="hidden md:flex items-center text-white/90 text-sm mr-4 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
              <span>{user?.email}</span>
            </div>

            <Button 
              className="gradient-accent hover:opacity-90 text-white border-0"
              onClick={logout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 bg-gradient-to-br from-blue-50 via-white to-purple-50">

        <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDeliveries}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Avg Photos per POD</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgPhotoCount.toFixed(1)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Signature Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{signatureRate.toFixed(1)}%</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Avg Quality Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgQualityScore.toFixed(0)}/100</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <div className="gradient-card shadow-card rounded-xl p-6 mb-8 border border-white/20">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters & Search</h3>
          
          {/* Main Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 items-end mb-6">
            <div className="relative lg:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <Search className="h-5 w-5 text-primary" />
                <label className="text-sm font-semibold text-gray-700">
                  Search
                </label>
              </div>
              <Input
                placeholder="Consignment no, company, driver..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full border-gray-200 focus:border-primary focus:ring-primary/20"
                data-testid="input-search-pod"
              />
            </div>
            
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-5 bg-blue-500 rounded"></div>
                <label className="text-sm font-semibold text-gray-700">
                  Warehouse
                </label>
              </div>
              <select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:border-primary focus:ring-primary/20 focus:outline-none"
                data-testid="select-warehouse"
              >
                <option value="all">All Warehouses</option>
                {warehouseCompanies.map((warehouse) => (
                  <option key={warehouse || 'unknown'} value={warehouse || ''}>
                    {warehouse}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-5 bg-green-500 rounded"></div>
                <label className="text-sm font-semibold text-gray-700">
                  Shipper
                </label>
              </div>
              <select
                value={selectedShipper}
                onChange={(e) => setSelectedShipper(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:border-primary focus:ring-primary/20 focus:outline-none"
                data-testid="select-shipper"
              >
                <option value="all">All Shippers</option>
                {shipperCompanies.map((shipper) => (
                  <option key={shipper} value={shipper}>
                    {shipper}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-5 bg-purple-500 rounded"></div>
                <label className="text-sm font-semibold text-gray-700">
                  Driver
                </label>
              </div>
              <select
                value={selectedDriver}
                onChange={(e) => setSelectedDriver(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:border-primary focus:ring-primary/20 focus:outline-none"
                data-testid="select-driver"
              >
                <option value="all">All Drivers</option>
                {driverNames.map((driver) => (
                  <option key={driver} value={driver || ''}>
                    {driver || 'Unknown Driver'}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Thermometer className="h-5 w-5 text-primary" />
                <label className="text-sm font-semibold text-gray-700">
                  Temp Zone
                </label>
              </div>
              <select
                value={selectedTempZone}
                onChange={(e) => setSelectedTempZone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-md focus:border-primary focus:ring-primary/20 focus:outline-none"
                data-testid="select-temp-zone"
              >
                <option value="all">All Zones</option>
                {temperatureZones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Range Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-6">
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-primary" />
                <label className="text-sm font-semibold text-gray-700">
                  From Date
                </label>
              </div>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full border-gray-200 focus:border-primary focus:ring-primary/20"
                data-testid="input-from-date"
              />
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-primary" />
                <label className="text-sm font-semibold text-gray-700">
                  To Date
                </label>
              </div>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full border-gray-200 focus:border-primary focus:ring-primary/20"
                data-testid="input-to-date"
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <div className="flex items-center bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                <span className="text-sm font-medium text-gray-700">{podAnalyses.length}</span>
                <span className="text-sm text-gray-500 ml-1">found</span>
              </div>
              {(fromDate || toDate) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFromDate("");
                    setToDate("");
                  }}
                  className="text-xs"
                  data-testid="button-clear-dates"
                >
                  Clear Dates
                </Button>
              )}
            </div>
          </div>
          
          {/* Quality Filter Buttons */}
          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-5 w-5 bg-yellow-500 rounded"></div>
              <label className="text-sm font-semibold text-gray-700">
                Quality Filters
              </label>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedFilter === "all" ? "default" : "outline"}
                onClick={() => setSelectedFilter("all")}
                size="sm"
                data-testid="button-filter-all"
              >
                All
              </Button>
              <Button
                variant={selectedFilter === "excellent" ? "default" : "outline"}
                onClick={() => setSelectedFilter("excellent")}
                size="sm"
                data-testid="button-filter-excellent"
              >
                Excellent (80+)
              </Button>
              <Button
                variant={selectedFilter === "good" ? "default" : "outline"}
                onClick={() => setSelectedFilter("good")}
                size="sm"
                data-testid="button-filter-good"
              >
                Good (60-79)
              </Button>
              <Button
                variant={selectedFilter === "poor" ? "default" : "outline"}
                onClick={() => setSelectedFilter("poor")}
                size="sm"
                data-testid="button-filter-poor"
              >
                Poor (&lt;60)
              </Button>
              <Button
                variant={selectedFilter === "missing-photos" ? "default" : "outline"}
                onClick={() => setSelectedFilter("missing-photos")}
                size="sm"
                data-testid="button-filter-missing-photos"
              >
                No Photos
              </Button>
              <Button
                variant={selectedFilter === "missing-signature" ? "default" : "outline"}
                onClick={() => setSelectedFilter("missing-signature")}
                size="sm"
                data-testid="button-filter-missing-signature"
              >
                No Signature
              </Button>
            </div>
          </div>
        </div>

        {/* POD Quality List */}
        <div className="gradient-card shadow-card rounded-xl border border-white/20">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-xl font-bold text-gray-900">Delivery POD Analysis</h3>
            <p className="text-gray-600 mt-1">
              Quality analysis for {podAnalyses.length} delivered consignments
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              {podAnalyses.map((analysis) => {
                const { consignment, metrics } = analysis;
                return (
                  <div
                    key={consignment.id}
                    className="bg-white border-2 border-gray-100 rounded-xl p-6 hover:border-primary/20 hover:shadow-md transition-all duration-200"
                    data-testid={`pod-analysis-${consignment.id}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-xl text-gray-900 mb-2" data-testid={`text-consignment-${consignment.id}`}>
                          {consignment.consignmentNo}
                        </h3>
                        <p className="text-base text-gray-700 font-medium mb-1" data-testid={`text-company-${consignment.id}`}>
                          {consignment.shipToCompanyName}
                        </p>
                        <p className="text-sm text-gray-600" data-testid={`text-delivery-time-${consignment.id}`}>
                          Delivered: {formatDate(metrics.deliveryTime)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {getQualityBadge(metrics.qualityScore)}
                        <span className="text-2xl font-bold text-gray-900" data-testid={`text-score-${consignment.id}`}>
                          {metrics.qualityScore}/100
                        </span>
                      </div>
                    </div>

                    {/* POD Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                      <div 
                        className="bg-gray-50 rounded-lg p-4 border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                        onClick={() => {
                          setSelectedConsignment(consignment);
                          setPhotoModalOpen(true);
                        }}
                        data-testid={`button-photos-${consignment.id}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Camera className="h-5 w-5 text-blue-600" />
                            <span className="text-sm font-semibold text-gray-700">Photos</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {metrics.photoCount === 0 && <XCircle className="h-5 w-5 text-red-500" />}
                            {metrics.photoCount > 0 && <CheckCircle className="h-5 w-5 text-green-500" />}
                            <ExternalLink className="h-4 w-4 text-gray-400" />
                          </div>
                        </div>
                        <p className="text-lg font-bold text-gray-900" data-testid={`text-photos-${consignment.id}`}>
                          {metrics.photoCount} photos
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FileSignature className="h-5 w-5 text-purple-600" />
                            <span className="text-sm font-semibold text-gray-700">Signature</span>
                          </div>
                          {metrics.hasSignature ? 
                            <CheckCircle className="h-5 w-5 text-green-500" /> : 
                            <XCircle className="h-5 w-5 text-red-500" />
                          }
                        </div>
                        <p className="text-lg font-bold text-gray-900" data-testid={`text-signature-${consignment.id}`}>
                          {metrics.hasSignature ? 'Signed' : 'Missing'}
                        </p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Thermometer className="h-5 w-5 text-orange-600" />
                            <span className="text-sm font-semibold text-gray-700">Temperature</span>
                          </div>
                          {metrics.temperatureCompliant ? 
                            <CheckCircle className="h-5 w-5 text-green-500" /> : 
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          }
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600">
                            Expected: <span className="font-medium">{formatTemperatureDisplay(consignment).expected}</span>
                          </p>
                          <p className="text-sm text-gray-600">
                            Actual: <span className="font-medium text-gray-900">{formatTemperatureDisplay(consignment).actual}</span>
                          </p>
                          <p className={`text-lg font-bold ${metrics.temperatureCompliant ? 'text-green-600' : 'text-yellow-600'}`} data-testid={`text-temperature-${consignment.id}`}>
                            {metrics.temperatureCompliant ? 'Compliant' : 'Non-Compliant'}
                          </p>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <ExternalLink className="h-5 w-5 text-green-600" />
                            <span className="text-sm font-semibold text-gray-700">Tracking</span>
                          </div>
                        </div>
                        {metrics.hasTrackingLink && consignment.deliveryLiveTrackLink ? (
                          <a
                            href={consignment.deliveryLiveTrackLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid={`button-track-${consignment.id}`}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Live Track
                            </Button>
                          </a>
                        ) : (
                          <p className="text-sm text-gray-500">No tracking link</p>
                        )}
                      </div>
                    </div>

                    {/* Additional Details */}
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-semibold text-gray-700">Driver:</span>
                          <span className="ml-2 text-gray-900" data-testid={`text-driver-${consignment.id}`}>
                            {consignment.driverName || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">Temp Zone:</span>
                          <span className="ml-2 text-gray-900" data-testid={`text-temp-zone-${consignment.id}`}>
                            {consignment.expectedTemperature || getTemperatureZone(consignment) || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {podAnalyses.length === 0 && (
                <div className="text-center py-8 text-gray-500" data-testid="text-no-results">
                  No delivered consignments found matching your criteria.
                </div>
              )}
            </div>
          </div>
        </div>
        </main>

        {/* Photo Viewer Modal */}
        <Dialog open={photoModalOpen} onOpenChange={setPhotoModalOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>POD Photos - {selectedConsignment?.consignmentNo}</DialogTitle>
              <DialogDescription>
                {selectedConsignment?.shipToCompanyName} • {selectedConsignment && countPhotos(selectedConsignment)} photos
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              {selectedConsignment?.deliveryLiveTrackLink || selectedConsignment?.pickupLiveTrackLink ? (
                <PhotoGallery 
                  trackingLink={selectedConsignment.deliveryLiveTrackLink || selectedConsignment.pickupLiveTrackLink || ''}
                  consignmentNo={selectedConsignment.consignmentNo || ''}
                />
              ) : (
                <div className="flex items-center justify-center h-[70vh] text-gray-500 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <Camera className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium">No tracking link available</p>
                    <p className="text-sm">Photos cannot be displayed without a live tracking link</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center pt-4 border-t">
              <p className="text-sm text-gray-600">
                Click any photo to view in full size. Photos are extracted from the live tracking system.
              </p>
              {(selectedConsignment?.deliveryLiveTrackLink || selectedConsignment?.pickupLiveTrackLink) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const link = selectedConsignment.deliveryLiveTrackLink || selectedConsignment.pickupLiveTrackLink;
                    if (link) window.open(link, '_blank');
                  }}
                  data-testid="button-open-external"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Full Tracking Page
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}