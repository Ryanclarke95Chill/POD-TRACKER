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
  
  const user = getUser();

  // Fetch all consignments and filter for delivered ones
  const { data: allConsignments = [], isLoading } = useQuery({
    queryKey: ['/api/consignments'],
  });

  // Filter for delivered consignments
  const deliveredConsignments = (allConsignments as Consignment[]).filter((consignment: Consignment) => {
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
    
    const status = mapStatus(deliveryStateLabel, false) || mapStatus(pickupStateLabel, true) || 'In Transit';
    return status === 'Delivered';
  });

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
    if (consignment.deliveryPodFiles) {
      // Assume comma-separated list of file paths/URLs
      count += consignment.deliveryPodFiles.split(',').filter(f => f.trim()).length;
    }
    if (consignment.receivedDeliveryPodFiles) {
      count += consignment.receivedDeliveryPodFiles.split(',').filter(f => f.trim()).length;
    }
    return count;
  };

  // Check if temperature requirements were met
  const checkTemperatureCompliance = (consignment: Consignment): boolean => {
    // If no expected temperature is specified, we can't determine compliance
    if (!consignment.expectedTemperature) return true;
    
    // Extract temperature zone from document note (first line before \\)
    const documentNote = consignment.documentNote;
    if (!documentNote) return true; // No actual temperature data to compare
    
    const actualTempZone = documentNote.split('\\')[0];
    const expectedTemp = consignment.expectedTemperature;
    
    // Basic compliance check - if the expected temperature contains keywords that match the actual zone
    const normalizeTemp = (temp: string) => temp.toLowerCase().trim();
    const expectedLower = normalizeTemp(expectedTemp);
    const actualLower = normalizeTemp(actualTempZone);
    
    // Check for temperature zone compliance
    if (expectedLower.includes('frozen') || expectedLower.includes('freezer') || expectedLower.includes('-18') || expectedLower.includes('-20')) {
      return actualLower.includes('frozen') || actualLower.includes('freezer') || actualLower.includes('-18') || actualLower.includes('-20');
    }
    
    if (expectedLower.includes('chiller') || expectedLower.includes('0-4') || expectedLower.includes('0–4')) {
      return actualLower.includes('chiller') || actualLower.includes('0-4') || actualLower.includes('0–4');
    }
    
    if (expectedLower.includes('dry') || expectedLower.includes('ambient')) {
      return actualLower.includes('dry') || actualLower.includes('ambient') || !actualLower.includes('frozen') && !actualLower.includes('chiller');
    }
    
    // If we can't determine compliance, assume compliant (benefit of doubt)
    return true;
  };

  // Process and filter consignments
  const podAnalyses: PODAnalysis[] = deliveredConsignments
    .map(analyzePOD)
    .filter((analysis: PODAnalysis) => {
      const consignment = analysis.consignment;
      const metrics = analysis.metrics;
      
      // Text search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matches = 
          consignment.consignmentNo?.toLowerCase().includes(searchLower) ||
          consignment.shipToCompanyName?.toLowerCase().includes(searchLower) ||
          consignment.driverName?.toLowerCase().includes(searchLower);
        if (!matches) return false;
      }
      
      // Quality filter
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
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by consignment no, company, or driver..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-pod"
                  />
                </div>
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
          </CardContent>
        </Card>

        {/* POD Quality List */}
        <Card>
          <CardHeader>
            <CardTitle>Delivery POD Analysis</CardTitle>
            <CardDescription>
              Quality analysis for {podAnalyses.length} delivered consignments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {podAnalyses.map((analysis) => {
                const { consignment, metrics } = analysis;
                return (
                  <div
                    key={consignment.id}
                    className="border rounded-lg p-4 hover:bg-gray-50"
                    data-testid={`pod-analysis-${consignment.id}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg" data-testid={`text-consignment-${consignment.id}`}>
                          {consignment.consignmentNo}
                        </h3>
                        <p className="text-sm text-gray-600" data-testid={`text-company-${consignment.id}`}>
                          {consignment.shipToCompanyName}
                        </p>
                        <p className="text-sm text-gray-500" data-testid={`text-delivery-time-${consignment.id}`}>
                          Delivered: {formatDate(metrics.deliveryTime)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getQualityBadge(metrics.qualityScore)}
                        <span className="text-lg font-bold" data-testid={`text-score-${consignment.id}`}>
                          {metrics.qualityScore}/100
                        </span>
                      </div>
                    </div>

                    {/* POD Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <Camera className="h-4 w-4 text-gray-500" />
                        <span className="text-sm" data-testid={`text-photos-${consignment.id}`}>
                          {metrics.photoCount} photos
                        </span>
                        {metrics.photoCount === 0 && <XCircle className="h-4 w-4 text-red-500" />}
                        {metrics.photoCount > 0 && <CheckCircle className="h-4 w-4 text-green-500" />}
                      </div>

                      <div className="flex items-center gap-2">
                        <FileSignature className="h-4 w-4 text-gray-500" />
                        <span className="text-sm" data-testid={`text-signature-${consignment.id}`}>
                          {metrics.hasSignature ? 'Signed' : 'No signature'}
                        </span>
                        {metrics.hasSignature ? 
                          <CheckCircle className="h-4 w-4 text-green-500" /> : 
                          <XCircle className="h-4 w-4 text-red-500" />
                        }
                      </div>

                      <div className="flex items-center gap-2">
                        <Thermometer className="h-4 w-4 text-gray-500" />
                        <span className="text-sm" data-testid={`text-temperature-${consignment.id}`}>
                          {metrics.temperatureCompliant ? 'Temp OK' : 'Temp issue'}
                        </span>
                        {metrics.temperatureCompliant ? 
                          <CheckCircle className="h-4 w-4 text-green-500" /> : 
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        }
                      </div>

                      <div className="flex items-center gap-2">
                        {metrics.hasTrackingLink && consignment.deliveryLiveTrackLink && (
                          <a
                            href={consignment.deliveryLiveTrackLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            data-testid={`button-track-${consignment.id}`}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Live Track
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Additional Details */}
                    <div className="flex justify-between items-center text-sm text-gray-500">
                      <span data-testid={`text-driver-${consignment.id}`}>
                        Driver: {consignment.driverName || 'N/A'}
                      </span>
                      <span data-testid={`text-temp-zone-${consignment.id}`}>
                        {consignment.expectedTemperature && (
                          <>Temp Zone: {consignment.expectedTemperature}</>
                        )}
                      </span>
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
          </CardContent>
        </Card>
      </main>
    </div>
  );
}