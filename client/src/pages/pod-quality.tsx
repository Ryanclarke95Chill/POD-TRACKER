import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Camera, 
  Thermometer, 
  FileSignature, 
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Download,
  TrendingUp,
  Users,
  Package,
  ExternalLink,
  Eye,
  Filter,
  X,
  BarChart3,
  ArrowUpDown
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Consignment } from "@shared/schema";
import { calculatePODScore, getQualityTier, getPhotoCount, getActualTemperature } from "@/utils/podMetrics";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface PhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos: string[];
  signatures: string[];
  consignmentNo: string;
}

interface Filters {
  shipper: string;
  warehouse: string;
  driver: string;
  fromDate: string;
  toDate: string;
}

function PhotoModal({ isOpen, onClose, photos, signatures, consignmentNo }: PhotoModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewingSignatures, setViewingSignatures] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  
  const allImages = viewingSignatures ? signatures : photos;
  const currentImage = allImages[currentIndex];
  
  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : allImages.length - 1));
    setImageLoading(true);
  };
  
  const handleNext = () => {
    setCurrentIndex((prev) => (prev < allImages.length - 1 ? prev + 1 : 0));
    setImageLoading(true);
  };
  
  useEffect(() => {
    setCurrentIndex(0);
    setImageLoading(true);
  }, [viewingSignatures]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') onClose();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, allImages.length]);
  
  if (!isOpen) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>POD Photos - {consignmentNo}</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={!viewingSignatures ? "default" : "outline"}
                onClick={() => setViewingSignatures(false)}
              >
                Photos ({photos.length})
              </Button>
              <Button
                size="sm"
                variant={viewingSignatures ? "default" : "outline"}
                onClick={() => setViewingSignatures(true)}
              >
                Signatures ({signatures.length})
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="relative">
          {allImages.length > 0 ? (
            <>
              <div className="relative bg-gray-100 min-h-[400px] flex items-center justify-center">
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                )}
                <img
                  src={`/api/image?src=${encodeURIComponent(currentImage)}&w=900&q=90`}
                  alt={`${viewingSignatures ? 'Signature' : 'Photo'} ${currentIndex + 1}`}
                  className="max-w-full h-auto max-h-[600px] object-contain"
                  onLoad={() => setImageLoading(false)}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    // Fallback to original URL if image proxy fails
                    target.src = currentImage;
                    setImageLoading(false);
                  }}
                />
              </div>
              
              {allImages.length > 1 && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white"
                    onClick={handlePrevious}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white"
                    onClick={handleNext}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded">
                    {currentIndex + 1} / {allImages.length}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Camera className="h-12 w-12 mb-2 text-gray-300" />
              <p>No {viewingSignatures ? 'signatures' : 'photos'} available</p>
              <p className="text-sm mt-2">Photos may still be processing, please try again in a moment</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PODQualityDashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    shipper: "all",
    warehouse: "all",
    driver: "all",
    fromDate: "",
    toDate: ""
  });
  
  const [photoModal, setPhotoModal] = useState<{
    isOpen: boolean;
    photos: string[];
    signatures: string[];
    consignmentNo: string;
  }>({ isOpen: false, photos: [], signatures: [], consignmentNo: "" });
  const [loadingPhotos, setLoadingPhotos] = useState<number | null>(null);
  const [photoLoadRetries, setPhotoLoadRetries] = useState<Map<number, number>>(new Map());
  const { toast } = useToast();
  
  // Fetch consignments
  const { data: consignmentsData, isLoading, refetch } = useQuery<{
    consignments: Consignment[];
    totalCount: number;
  }>({
    queryKey: ["/api/consignments/stats"],
    enabled: true,
    refetchInterval: 60000, // Refresh every minute
  });
  
  const consignments = consignmentsData?.consignments || [];
  
  // Get unique shippers, warehouses, and drivers for filter dropdowns
  const uniqueShippers = Array.from(new Set(consignments.map((c: Consignment) => (c as any).shipperCompanyName).filter((name): name is string => Boolean(name)))).sort();
  const uniqueWarehouses = Array.from(new Set(consignments.map((c: Consignment) => c.warehouseCompanyName).filter((name): name is string => Boolean(name)))).sort();
  const uniqueDrivers = Array.from(new Set(consignments.map((c: Consignment) => c.driverName).filter((name): name is string => Boolean(name)))).sort();
  
  // Filter consignments based on search and filters
  const filteredConsignments = consignments.filter((c: Consignment) => {
    // Search filter
    const search = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || (
      c.consignmentNo?.toLowerCase().includes(search) ||
      c.orderNumberRef?.toLowerCase().includes(search) ||
      c.driverName?.toLowerCase().includes(search) ||
      c.shipToCompanyName?.toLowerCase().includes(search) ||
      c.shipToCity?.toLowerCase().includes(search)
    );
    
    if (!matchesSearch) return false;
    
    // Shipper filter
    const matchesShipper = filters.shipper === "all" || (c as any).shipperCompanyName === filters.shipper;
    
    // Warehouse filter
    const matchesWarehouse = filters.warehouse === "all" || c.warehouseCompanyName === filters.warehouse;
    
    // Driver filter
    const matchesDriver = filters.driver === "all" || c.driverName === filters.driver;
    
    // Date filtering logic - convert to AEST timezone (same as dashboard)
    const matchesDateRange = (() => {
      if (!filters.fromDate && !filters.toDate) return true;
      
      // Check multiple ETA fields as suggested
      const consignmentDate = (c as any).delivery_PlannedETA || 
                              (c as any).delivery_ETA || 
                              (c as any).delivery_FirstCalculatedETA ||
                              (c as any).pickUp_PlannedETA ||
                              (c as any).pickUp_ETA ||
                              (c as any).pickUp_FirstCalculatedETA ||
                              c.departureDateTime;
      if (!consignmentDate) return true; // Show consignments without dates
      
      // Convert UTC date to AEST (UTC+10) for comparison
      const utcDate = new Date(consignmentDate);
      const aestDate = new Date(utcDate.getTime() + (10 * 60 * 60 * 1000)); // Add 10 hours for AEST
      const dateString = aestDate.toISOString().split('T')[0];
      
      if (filters.fromDate && filters.toDate) {
        return dateString >= filters.fromDate && dateString <= filters.toDate;
      } else if (filters.fromDate) {
        return dateString >= filters.fromDate;
      } else if (filters.toDate) {
        return dateString <= filters.toDate;
      }
      return true;
    })();
    
    return matchesSearch && matchesShipper && matchesWarehouse && matchesDriver && matchesDateRange;
  });
  
  // Calculate overall statistics
  const stats = {
    total: filteredConsignments.length,
    avgScore: 0,
    goldCount: 0,
    silverCount: 0,
    bronzeCount: 0,
    needsImprovementCount: 0,
    avgPhotoCount: 0,
    signatureRate: 0,
    tempComplianceRate: 0,
  };
  
  if (filteredConsignments.length > 0) {
    let totalScore = 0;
    let totalPhotos = 0;
    let signaturesCount = 0;
    let tempCompliantCount = 0;
    
    filteredConsignments.forEach((c: Consignment) => {
      const metrics = calculatePODScore(c);
      totalScore += metrics.qualityScore;
      totalPhotos += metrics.photoCount;
      
      if (metrics.hasSignature) signaturesCount++;
      if (metrics.temperatureCompliant) tempCompliantCount++;
      
      const tier = getQualityTier(metrics.qualityScore);
      if (tier.tier === "Excellent") stats.goldCount++;
      else if (tier.tier === "Good") stats.silverCount++;
      else if (tier.tier === "Fair") stats.bronzeCount++;
      else stats.needsImprovementCount++;
    });
    
    stats.avgScore = Math.round(totalScore / filteredConsignments.length);
    stats.avgPhotoCount = Math.round((totalPhotos / filteredConsignments.length) * 10) / 10;
    stats.signatureRate = Math.round((signaturesCount / filteredConsignments.length) * 100);
    stats.tempComplianceRate = Math.round((tempCompliantCount / filteredConsignments.length) * 100);
  }
  
  // Calculate warehouse comparison data
  const warehouseComparison = useMemo(() => {
    const warehouseMap = new Map<string, {
      warehouse: string;
      deliveryCount: number;
      totalScore: number;
      totalPhotos: number;
      signaturesCount: number;
      tempCompliantCount: number;
    }>();
    
    filteredConsignments.forEach((c: Consignment) => {
      const warehouse = c.shipFromCompanyName || "Unknown Warehouse";
      const metrics = calculatePODScore(c);
      
      if (!warehouseMap.has(warehouse)) {
        warehouseMap.set(warehouse, {
          warehouse,
          deliveryCount: 0,
          totalScore: 0,
          totalPhotos: 0,
          signaturesCount: 0,
          tempCompliantCount: 0
        });
      }
      
      const data = warehouseMap.get(warehouse)!;
      data.deliveryCount++;
      data.totalScore += metrics.qualityScore;
      data.totalPhotos += metrics.photoCount;
      if (metrics.hasSignature) data.signaturesCount++;
      if (metrics.temperatureCompliant) data.tempCompliantCount++;
    });
    
    return Array.from(warehouseMap.values()).map(w => ({
      warehouse: w.warehouse,
      deliveryCount: w.deliveryCount,
      avgScore: Math.round(w.totalScore / w.deliveryCount),
      photoRate: Math.round((w.totalPhotos / w.deliveryCount) * 10) / 10,
      signatureRate: Math.round((w.signaturesCount / w.deliveryCount) * 100),
      tempComplianceRate: Math.round((w.tempCompliantCount / w.deliveryCount) * 100)
    })).sort((a, b) => b.avgScore - a.avgScore);
  }, [filteredConsignments]);
  
  // Load photos for a consignment with improved retry logic
  const loadPhotos = async (consignment: Consignment) => {
    const trackingLink = consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink;
    if (!trackingLink) {
      toast({
        title: "No tracking link",
        description: "This consignment doesn't have a tracking link for photos",
        variant: "destructive"
      });
      return;
    }
    
    // Extract token from tracking link - the token is the last part of the URL
    const token = trackingLink.split('/').pop() || trackingLink;
    
    setLoadingPhotos(consignment.id);
    const currentRetries = photoLoadRetries.get(consignment.id) || 0;
    
    try {
      // Use web scraping for fast, reliable photo retrieval
      const response = await apiRequest('GET', `/api/pod-photos?trackingToken=${encodeURIComponent(token)}&priority=high`);
      const data = await response.json();
      
      if (data.success) {
        if ((data.status === 'preparing' || (!data.photos?.length && !data.signaturePhotos?.length)) && currentRetries < 5) {
          // Increment retry count
          setPhotoLoadRetries(new Map(photoLoadRetries.set(consignment.id, currentRetries + 1)));
          
          // Show loading toast only on first retry
          if (currentRetries === 0) {
            toast({
              title: "Loading photos...",
              description: "Photos are being processed, this may take a moment",
            });
          }
          
          // Retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(1.5, currentRetries), 5000);
          setTimeout(() => loadPhotos(consignment), delay);
          return;
        }
        
        // Reset retry count on success
        setPhotoLoadRetries(new Map(photoLoadRetries.set(consignment.id, 0)));
        
        if ((!data.photos || data.photos.length === 0) && (!data.signaturePhotos || data.signaturePhotos.length === 0)) {
          toast({
            title: "No photos available",
            description: "No photos found for this consignment. They may not have been uploaded yet.",
            variant: "destructive"
          });
        } else {
          setPhotoModal({
            isOpen: true,
            photos: data.photos || [],
            signatures: data.signaturePhotos || [],
            consignmentNo: consignment.consignmentNo || consignment.orderNumberRef || ""
          });
        }
      } else {
        toast({
          title: "Failed to load photos",
          description: data.error || "An error occurred while loading photos",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Photo loading error:', error);
      toast({
        title: "Error",
        description: "Failed to load photos. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingPhotos(null);
    }
  };
  
  // Sync data mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/axylog/sync', {
        syncFromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        syncToDate: new Date().toISOString().split('T')[0]
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consignments/stats"] });
      toast({
        title: "Sync complete",
        description: "Data has been refreshed from Axylog",
      });
    },
    onError: () => {
      toast({
        title: "Sync failed",
        description: "Failed to sync data from Axylog",
        variant: "destructive"
      });
    }
  });
  
  const resetFilters = () => {
    setFilters({
      shipper: "all",
      warehouse: "all",
      driver: "all",
      fromDate: "",
      toDate: ""
    });
    setSearchTerm("");
  };
  
  const activeFilterCount = [
    filters.shipper !== "all",
    filters.warehouse !== "all",
    filters.driver !== "all",
    filters.fromDate !== "",
    filters.toDate !== ""
  ].filter(Boolean).length;
  
  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">POD Quality Dashboard</h1>
          <p className="text-gray-600">Monitor proof of delivery quality and compliance</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            <Download className="h-4 w-4 mr-2" />
            Sync Axylog
          </Button>
        </div>
      </div>
      
      {/* Dynamic Summary Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h2 className="text-xl font-semibold">Summary</h2>
          <p className="text-sm text-gray-600">
            Showing {filteredConsignments.length} of {consignments.length} deliveries
            {activeFilterCount > 0 && <span className="ml-1 text-blue-600">({activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active)</span>}
          </p>
        </div>
      </div>
      
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Average Score
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgScore}%</div>
            <p className="text-xs text-gray-500">Quality Score</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Photo Coverage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgPhotoCount}</div>
            <p className="text-xs text-gray-500">Avg photos per delivery</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <FileSignature className="h-4 w-4" />
              Signature Rate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.signatureRate}%</div>
            <p className="text-xs text-gray-500">Signatures captured</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Thermometer className="h-4 w-4" />
              Temperature
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tempComplianceRate}%</div>
            <p className="text-xs text-gray-500">Compliance rate</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Quality Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Quality Distribution</CardTitle>
          <CardDescription>Breakdown by quality tier</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="text-3xl font-bold text-green-700 mb-1">{stats.goldCount}</div>
              <div className="text-sm font-medium text-green-800">Excellent</div>
              <div className="text-xs text-green-600">90-100%</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-200">
              <div className="text-3xl font-bold text-blue-700 mb-1">{stats.silverCount}</div>
              <div className="text-sm font-medium text-blue-800">Good</div>
              <div className="text-xs text-blue-600">75-89%</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-yellow-50 border border-yellow-200">
              <div className="text-3xl font-bold text-yellow-700 mb-1">{stats.bronzeCount}</div>
              <div className="text-sm font-medium text-yellow-800">Fair</div>
              <div className="text-xs text-yellow-600">60-74%</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-red-50 border border-red-200">
              <div className="text-3xl font-bold text-red-700 mb-1">{stats.needsImprovementCount}</div>
              <div className="text-sm font-medium text-red-800">Poor</div>
              <div className="text-xs text-red-600">&lt;60%</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Warehouse Comparison */}
      {warehouseComparison.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Warehouse Performance Comparison
            </CardTitle>
            <CardDescription>Compare POD quality metrics across warehouses {activeFilterCount > 0 && "(filtered)"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Bar Chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={warehouseComparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="warehouse" angle={-45} textAnchor="end" height={100} fontSize={12} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="avgScore" fill="#3b82f6" name="Avg Score (%)" />
                    <Bar dataKey="signatureRate" fill="#10b981" name="Signature Rate (%)" />
                    <Bar dataKey="tempComplianceRate" fill="#f59e0b" name="Temp Compliance (%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* Comparison Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-medium text-gray-700">Warehouse</th>
                      <th className="text-center p-3 font-medium text-gray-700">Deliveries</th>
                      <th className="text-center p-3 font-medium text-gray-700">Avg Score</th>
                      <th className="text-center p-3 font-medium text-gray-700">Photos/Delivery</th>
                      <th className="text-center p-3 font-medium text-gray-700">Signature %</th>
                      <th className="text-center p-3 font-medium text-gray-700">Temp Compliance %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouseComparison.map((w, idx) => (
                      <tr key={w.warehouse} className="border-b hover:bg-gray-50/50">
                        <td className="p-3 font-medium text-gray-900">{w.warehouse}</td>
                        <td className="p-3 text-center text-gray-700">{w.deliveryCount}</td>
                        <td className="p-3 text-center">
                          <span className={`font-semibold ${
                            w.avgScore >= 90 ? 'text-green-600' :
                            w.avgScore >= 75 ? 'text-blue-600' :
                            w.avgScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {w.avgScore}%
                          </span>
                        </td>
                        <td className="p-3 text-center text-gray-700">{w.photoRate}</td>
                        <td className="p-3 text-center text-gray-700">{w.signatureRate}%</td>
                        <td className="p-3 text-center text-gray-700">{w.tempComplianceRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Consignments Table */}
      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Consignments</CardTitle>
                <CardDescription>Detailed POD quality scores</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="w-72">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search consignments..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="relative"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge className="ml-2 bg-blue-500 text-white">{activeFilterCount}</Badge>
                  )}
                </Button>
              </div>
            </div>
            
            {/* Filter Panel */}
            {showFilters && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium">Filters</h3>
                  <Button size="sm" variant="ghost" onClick={resetFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Shipper</label>
                    <Select value={filters.shipper} onValueChange={(v) => setFilters({...filters, shipper: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="All shippers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All shippers</SelectItem>
                        {uniqueShippers.map(shipper => (
                          <SelectItem key={shipper} value={shipper}>{shipper}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Warehouse</label>
                    <Select value={filters.warehouse} onValueChange={(v) => setFilters({...filters, warehouse: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="All warehouses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All warehouses</SelectItem>
                        {uniqueWarehouses.map(warehouse => (
                          <SelectItem key={warehouse} value={warehouse}>{warehouse}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Driver</label>
                    <Select value={filters.driver} onValueChange={(v) => setFilters({...filters, driver: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="All drivers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All drivers</SelectItem>
                        {uniqueDrivers.map(driver => (
                          <SelectItem key={driver} value={driver}>{driver}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">From Date</label>
                    <Input
                      type="date"
                      value={filters.fromDate}
                      onChange={(e) => setFilters({...filters, fromDate: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">To Date</label>
                    <Input
                      type="date"
                      value={filters.toDate}
                      onChange={(e) => setFilters({...filters, toDate: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium text-gray-700">Consignment</th>
                  <th className="text-left p-3 font-medium text-gray-700">Driver</th>
                  <th className="text-left p-3 font-medium text-gray-700">Destination</th>
                  <th className="text-left p-3 font-medium text-gray-700">Photos</th>
                  <th className="text-center p-3 font-medium text-gray-700">Signature</th>
                  <th className="text-left p-3 font-medium text-gray-700">Temperature</th>
                  <th className="text-center p-3 font-medium text-gray-700">Score</th>
                  <th className="text-center p-3 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredConsignments.slice(0, 100).map((consignment: Consignment) => {
                  const metrics = calculatePODScore(consignment);
                  const tier = getQualityTier(metrics.qualityScore);
                  const trackingLink = consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink;
                  const actualTemp = getActualTemperature(consignment);
                  const expectedTemp = consignment.expectedTemperature;
                  
                  return (
                    <tr key={consignment.id} className="border-b hover:bg-gray-50/50 transition-colors">
                      <td className="p-3">
                        <div>
                          <div className="font-medium text-gray-900">{consignment.consignmentNo || consignment.orderNumberRef}</div>
                          <div className="text-sm text-gray-500">{consignment.orderNumberRef}</div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm text-gray-700">{consignment.driverName || "-"}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-sm">
                          <div className="text-gray-900">{consignment.shipToCompanyName}</div>
                          <div className="text-gray-500">{consignment.shipToCity}</div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          <Camera className={`h-4 w-4 ${metrics.photoCount > 0 ? 'text-green-600' : 'text-red-600'}`} data-testid={`icon-photos-${consignment.id}`} />
                          <span className={`text-sm font-medium ${metrics.photoCount > 0 ? 'text-green-700' : 'text-red-700'}`} data-testid={`text-photo-count-${consignment.id}`}>
                            {metrics.photoCount}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {metrics.hasSignature ? (
                          <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                        )}
                      </td>
                      <td className="p-3">
                        {expectedTemp === "Dry" || !expectedTemp ? (
                          <span className="text-sm text-gray-500">N/A</span>
                        ) : (
                          <div className="text-sm">
                            <div className={`font-medium ${metrics.temperatureCompliant ? 'text-green-700' : 'text-red-700'}`}>
                              {actualTemp ? `${actualTemp}°C` : 'Not recorded'}
                            </div>
                            <div className="text-gray-500 text-xs">{expectedTemp}</div>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className={`inline-flex items-center justify-center px-3 py-1 rounded-full font-medium text-sm ${
                          metrics.qualityScore >= 90 
                            ? "bg-green-100 text-green-800 border border-green-200"
                            : metrics.qualityScore >= 75
                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                            : metrics.qualityScore >= 60
                            ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                            : "bg-red-100 text-red-800 border border-red-200"
                        }`}>
                          {metrics.qualityScore}%
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex gap-1 justify-center">
                          {trackingLink && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => loadPhotos(consignment)}
                              disabled={loadingPhotos === consignment.id}
                              data-testid={`button-view-photos-${consignment.id}`}
                            >
                              {loadingPhotos === consignment.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {trackingLink && (
                            <a
                              href={trackingLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex"
                            >
                              <Button size="sm" variant="ghost" data-testid={`link-tracking-${consignment.id}`}>
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {filteredConsignments.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No consignments found matching your filters
              </div>
            )}
            
            {filteredConsignments.length > 100 && (
              <div className="text-center py-4 text-sm text-gray-500">
                Showing first 100 of {filteredConsignments.length} consignments
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Photo Modal */}
      <PhotoModal
        isOpen={photoModal.isOpen}
        onClose={() => setPhotoModal({ ...photoModal, isOpen: false })}
        photos={photoModal.photos}
        signatures={photoModal.signatures}
        consignmentNo={photoModal.consignmentNo}
      />
    </div>
  );
}