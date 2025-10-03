import { useState, useEffect, useCallback } from "react";
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
  X
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Consignment } from "@shared/schema";
import { calculatePODScore, getQualityTier, getPhotoCount, getActualTemperature } from "@/utils/podMetrics";
import { PhotoThumbnails } from "@/components/PhotoThumbnails";
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
  driver: string;
  city: string;
  scoreMin: number;
  scoreMax: number;
  tempCompliant: string;
  hasSignature: string;
  photoCount: string;
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
    driver: "all",
    city: "all",
    scoreMin: 0,
    scoreMax: 100,
    tempCompliant: "all",
    hasSignature: "all",
    photoCount: "all"
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
  
  // Get unique drivers and cities for filter dropdowns
  const uniqueDrivers = Array.from(new Set(consignments.map((c: Consignment) => c.driverName).filter((name): name is string => Boolean(name)))).sort();
  const uniqueCities = Array.from(new Set(consignments.map((c: Consignment) => c.shipToCity).filter((city): city is string => Boolean(city)))).sort();
  
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
    
    // Apply additional filters
    const metrics = calculatePODScore(c);
    
    // Driver filter
    if (filters.driver !== "all" && c.driverName !== filters.driver) return false;
    
    // City filter
    if (filters.city !== "all" && c.shipToCity !== filters.city) return false;
    
    // Score range filter
    if (metrics.qualityScore < filters.scoreMin || metrics.qualityScore > filters.scoreMax) return false;
    
    // Temperature compliance filter
    if (filters.tempCompliant === "yes" && !metrics.temperatureCompliant) return false;
    if (filters.tempCompliant === "no" && metrics.temperatureCompliant) return false;
    
    // Signature filter
    if (filters.hasSignature === "yes" && !metrics.hasSignature) return false;
    if (filters.hasSignature === "no" && metrics.hasSignature) return false;
    
    // Photo count filter
    if (filters.photoCount === "0" && metrics.photoCount > 0) return false;
    if (filters.photoCount === "1-2" && (metrics.photoCount === 0 || metrics.photoCount > 2)) return false;
    if (filters.photoCount === "3+" && metrics.photoCount < 3) return false;
    
    return true;
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
      // Force refresh to bypass cache
      const response = await apiRequest('GET', `/api/pod-photos?trackingToken=${encodeURIComponent(token)}&priority=high&force=true`);
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
      driver: "all",
      city: "all",
      scoreMin: 0,
      scoreMax: 100,
      tempCompliant: "all",
      hasSignature: "all",
      photoCount: "all"
    });
    setSearchTerm("");
  };
  
  const activeFilterCount = [
    filters.driver !== "all",
    filters.city !== "all",
    filters.scoreMin > 0 || filters.scoreMax < 100,
    filters.tempCompliant !== "all",
    filters.hasSignature !== "all",
    filters.photoCount !== "all"
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
                    <label className="text-sm font-medium mb-1 block">City</label>
                    <Select value={filters.city} onValueChange={(v) => setFilters({...filters, city: v})}>
                      <SelectTrigger>
                        <SelectValue placeholder="All cities" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All cities</SelectItem>
                        {uniqueCities.map(city => (
                          <SelectItem key={city} value={city}>{city}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Score Range</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.scoreMin}
                        onChange={(e) => setFilters({...filters, scoreMin: Number(e.target.value)})}
                        min={0}
                        max={100}
                        className="w-20"
                      />
                      <span className="self-center">-</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.scoreMax}
                        onChange={(e) => setFilters({...filters, scoreMax: Number(e.target.value)})}
                        min={0}
                        max={100}
                        className="w-20"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Temperature</label>
                    <Select value={filters.tempCompliant} onValueChange={(v) => setFilters({...filters, tempCompliant: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="yes">Compliant</SelectItem>
                        <SelectItem value="no">Non-compliant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Signature</label>
                    <Select value={filters.hasSignature} onValueChange={(v) => setFilters({...filters, hasSignature: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="yes">Has signature</SelectItem>
                        <SelectItem value="no">No signature</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Photo Count</label>
                    <Select value={filters.photoCount} onValueChange={(v) => setFilters({...filters, photoCount: v})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="0">No photos</SelectItem>
                        <SelectItem value="1-2">1-2 photos</SelectItem>
                        <SelectItem value="3+">3+ photos</SelectItem>
                      </SelectContent>
                    </Select>
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
                        <PhotoThumbnails
                          trackingLink={trackingLink}
                          photoCount={metrics.photoCount}
                          consignmentId={consignment.id}
                        />
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