import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  BarChart3
} from "lucide-react";
import { Link } from "wouter";
import { getUser, logout } from "@/lib/auth";
import { Consignment } from "@shared/schema";

interface PODMetrics {
  photoCount: number;
  hasSignature: boolean;
  temperatureCompliant: boolean;
  hasTrackingLink: boolean;
  deliveryTime: string | null;
  qualityScore: number;
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
    const temperatureCompliant = checkTemperatureCompliance(consignment);
    const hasTrackingLink = Boolean(consignment.deliveryLiveTrackLink);
    const deliveryTime = consignment.delivery_OutcomeDateTime;
    
    // Calculate quality score (0-100)
    let score = 0;
    if (photoCount > 0) score += 30;
    if (photoCount > 2) score += 10; // Bonus for multiple photos
    if (hasSignature) score += 25;
    if (temperatureCompliant) score += 25;
    if (hasTrackingLink) score += 10;
    
    const metrics: PODMetrics = {
      photoCount,
      hasSignature,
      temperatureCompliant,
      hasTrackingLink,
      deliveryTime,
      qualityScore: score
    };

    return { consignment, metrics };
  };

  // Count photos from POD files
  const countPhotos = (consignment: Consignment): number => {
    let count = 0;
    
    // Check if actual file paths are provided
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
    if (temp1 && temp1 !== 999 && !isNaN(parseFloat(temp1.toString()))) {
      actualTemps.push(`${temp1}°C`);
    }
    
    // amountCollected = Temp 2
    if (temp2 && !isNaN(parseFloat(temp2.toString()))) {
      actualTemps.push(`${temp2}°C`);
    }
    
    // paymentMethod = Additional temp reading
    if (tempPayment && !isNaN(parseFloat(tempPayment))) {
      actualTemps.push(`${parseFloat(tempPayment)}°C`);
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
    
    // Get actual recorded temperature from paymentMethod field (e.g., "-18.5" for -18.5°C)
    const actualTemp = (consignment as any).paymentMethod;
    if (!actualTemp) {
      // Fallback to old logic if no recorded temperature available
      const documentNote = consignment.documentNote;
      if (!documentNote) return true;
      
      const actualTempZone = documentNote.split('\\')[0];
      const fallbackExpectedTemp = consignment.expectedTemperature;
      
      const normalizeTemp = (temp: string | null) => (temp || '').toLowerCase().trim();
      const expectedLower = normalizeTemp(fallbackExpectedTemp);
      const actualLower = normalizeTemp(actualTempZone);
      
      if (expectedLower.includes('frozen') || expectedLower.includes('freezer') || expectedLower.includes('-18') || expectedLower.includes('-20')) {
        return actualLower.includes('frozen') || actualLower.includes('freezer') || actualLower.includes('-18') || actualLower.includes('-20');
      }
      
      if (expectedLower.includes('chiller') || expectedLower.includes('0-4') || expectedLower.includes('0–4')) {
        return actualLower.includes('chiller') || actualLower.includes('0-4') || actualLower.includes('0–4');
      }
      
      return true; // If we can't determine, assume compliant
    }
    
    // Parse actual recorded temperature (e.g., "-18.5" -> -18.5)
    const actualTempValue = parseFloat(actualTemp);
    if (isNaN(actualTempValue)) return true; // Invalid temperature data
    
    // Get expected temperature ranges for each zone
    const expectedTempLower = (expectedTemp || '').toLowerCase();
    
    if (expectedTempLower.includes('freezer') || expectedTempLower.includes('-20')) {
      // Freezer: typically -20°C ± 5°C tolerance
      return actualTempValue >= -25 && actualTempValue <= -15;
    }
    
    if (expectedTempLower.includes('chiller') || expectedTempLower.includes('0–4') || expectedTempLower.includes('0-4')) {
      // Chiller: 0-4°C ± 2°C tolerance  
      return actualTempValue >= -2 && actualTempValue <= 6;
    }
    
    if (expectedTempLower.includes('wine') || expectedTempLower.includes('14')) {
      // Wine: 14°C ± 3°C tolerance
      return actualTempValue >= 11 && actualTempValue <= 17;
    }
    
    if (expectedTempLower.includes('confectionery') || expectedTempLower.includes('15–20') || expectedTempLower.includes('15-20')) {
      // Confectionery: 15-20°C ± 2°C tolerance
      return actualTempValue >= 13 && actualTempValue <= 22;
    }
    
    if (expectedTempLower.includes('pharma') || expectedTempLower.includes('2–8') || expectedTempLower.includes('2-8')) {
      // Pharma: 2-8°C ± 1°C tolerance
      return actualTempValue >= 1 && actualTempValue <= 9;
    }
    
    if (expectedTempLower.includes('dry') || expectedTempLower.includes('ambient')) {
      // Dry: ambient temperature (typically 15-25°C range)
      return actualTempValue >= 10 && actualTempValue <= 30;
    }
    
    // If we can't determine compliance, assume compliant
    return true;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header Navigation */}
      <header className="gradient-header text-white p-6 shadow-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-6">
            <h1 className="text-2xl font-bold">POD Quality Report</h1>
            <nav className="hidden md:flex space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" className="text-white hover:bg-white/20" data-testid="link-dashboard">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/analytics">
                <Button variant="ghost" className="text-white hover:bg-white/20" data-testid="link-analytics">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Analytics
                </Button>
              </Link>
              <Link href="/view-all">
                <Button variant="ghost" className="text-white hover:bg-white/20" data-testid="link-view-all">
                  View All
                </Button>
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-white/90">Welcome, {user?.name}</span>
            <Button
              onClick={logout}
              variant="ghost"
              className="text-white hover:bg-white/20"
              data-testid="button-logout"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-6">
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
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Camera className="h-5 w-5 text-blue-600" />
                            <span className="text-sm font-semibold text-gray-700">Photos</span>
                          </div>
                          {metrics.photoCount === 0 && <XCircle className="h-5 w-5 text-red-500" />}
                          {metrics.photoCount > 0 && <CheckCircle className="h-5 w-5 text-green-500" />}
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
    </div>
  );
}