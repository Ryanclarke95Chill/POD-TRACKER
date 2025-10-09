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
  ChevronDown,
  Download,
  TrendingUp,
  Users,
  Package,
  ExternalLink,
  Eye,
  Filter,
  X,
  BarChart3,
  ArrowUpDown,
  LogOut,
  Lightbulb,
  TrendingDown
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Consignment } from "@shared/schema";
import { calculatePODScore, getQualityTier, getPhotoCount, getActualTemperature, parseRequiredTemperature } from "@/utils/podMetrics";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { getUser, logout } from "@/lib/auth";

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

type ConsignmentWithPhotoCount = Consignment & { actualPhotoCount?: number };

export default function PODQualityDashboard() {
  const user = getUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  
  const [filters, setFilters] = useState<Filters>({
    shipper: "all",
    warehouse: "all",
    driver: "all",
    fromDate: "",
    toDate: ""
  });
  
  const [dataLoaded, setDataLoaded] = useState(false); // Track if user triggered load
  const [insightsExpanded, setInsightsExpanded] = useState(true); // Track insights section expansion
  
  const [photoModal, setPhotoModal] = useState<{
    isOpen: boolean;
    photos: string[];
    signatures: string[];
    consignmentNo: string;
  }>({ isOpen: false, photos: [], signatures: [], consignmentNo: "" });
  const [loadingPhotos, setLoadingPhotos] = useState<number | null>(null);
  const [photoLoadRetries, setPhotoLoadRetries] = useState<Map<number, number>>(new Map());
  const [photoThumbnails, setPhotoThumbnails] = useState<Map<number, string[]>>(new Map());
  const { toast } = useToast();
  
  // Check if filters are applied (require at least date filter)
  const hasFiltersApplied = !!(filters.fromDate || filters.toDate);
  
  // Fetch consignments
  const { data: consignmentsData, isLoading, refetch } = useQuery<{
    consignments: ConsignmentWithPhotoCount[];
    totalCount: number;
  }>({
    queryKey: ["/api/consignments/stats"],
    enabled: dataLoaded && hasFiltersApplied,  // Only fetch when user clicks load button AND filters are applied
    refetchInterval: dataLoaded && hasFiltersApplied ? 60000 : false, // Refresh every minute only when enabled
  });
  
  const consignments = consignmentsData?.consignments || [];
  
  // Get unique shippers, warehouses, and drivers for filter dropdowns
  const uniqueShippers = Array.from(new Set(consignments.map((c: Consignment) => (c as any).shipperCompanyName).filter((name): name is string => Boolean(name)))).sort();
  const uniqueWarehouses = Array.from(new Set(consignments.map((c: Consignment) => c.warehouseCompanyName).filter((name): name is string => Boolean(name)))).sort();
  const uniqueDrivers = Array.from(new Set(consignments.map((c: Consignment) => c.driverName).filter((name): name is string => Boolean(name)))).sort();
  
  // Filter consignments based on search and filters
  const filteredConsignments = consignments.filter((c: Consignment) => {
    // Only show Positive delivery outcomes
    if ((c as any).delivery_OutcomeEnum !== 'Positive') {
      return false;
    }
    
    // Exclude internal depot transfers where CUSTOMER is a Chill depot/location
    // Legitimate deliveries have real customers delivered TO Chill depots (warehouse)
    const customerName = (c.shipToCompanyName || '').toLowerCase().trim();
    
    // Filter out if customer is a Chill internal location (depot transfer)
    const isInternalChillLocation = 
      customerName.includes('chill') && (
        customerName.includes('depot') ||
        customerName.match(/^chill\s+(vic|qld|wa|nsw|sa)$/i) ||
        customerName.match(/^\*?chill\s+(vic|qld|wa|nsw|sa)$/i)
      );
    
    if (isInternalChillLocation) {
      return false;
    }
    
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
  
  // Sort by syncedAt descending (most recent first)
  const sortedConsignments = [...filteredConsignments].sort((a, b) => {
    if (!a.syncedAt && !b.syncedAt) return 0;
    if (!a.syncedAt) return 1;
    if (!b.syncedAt) return -1;
    return new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime();
  });
  
  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filters]);
  
  // Pagination calculations
  const totalPages = Math.ceil(sortedConsignments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedConsignments = sortedConsignments.slice(startIndex, endIndex);
  
  // Load photo thumbnails for current page
  useEffect(() => {
    const loadThumbnails = async () => {
      for (const consignment of paginatedConsignments) {
        if (photoThumbnails.has(consignment.id)) continue;
        
        const trackingLink = consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink;
        if (!trackingLink) continue;
        
        try {
          const res = await apiRequest(
            'GET',
            `/api/consignments/${consignment.id}/photos`
          );
          const data = await res.json() as { photos: string[]; signatures: string[] };
          if (data.photos && data.photos.length > 0) {
            setPhotoThumbnails(prev => new Map(prev).set(consignment.id, data.photos));
          }
        } catch (error) {
          // Silently fail for thumbnails
        }
      }
    };
    
    loadThumbnails();
  }, [paginatedConsignments]);
  
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
    
    filteredConsignments.forEach((c: ConsignmentWithPhotoCount) => {
      const metrics = calculatePODScore(c, c.actualPhotoCount);
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
      receiverNameCount: number;
    }>();
    
    filteredConsignments.forEach((c: ConsignmentWithPhotoCount) => {
      const warehouse = c.warehouseCompanyName || "Unknown Warehouse";
      const metrics = calculatePODScore(c, c.actualPhotoCount);
      
      if (!warehouseMap.has(warehouse)) {
        warehouseMap.set(warehouse, {
          warehouse,
          deliveryCount: 0,
          totalScore: 0,
          totalPhotos: 0,
          signaturesCount: 0,
          tempCompliantCount: 0,
          receiverNameCount: 0
        });
      }
      
      const data = warehouseMap.get(warehouse)!;
      data.deliveryCount++;
      data.totalScore += metrics.qualityScore;
      data.totalPhotos += metrics.photoCount;
      if (metrics.hasSignature) data.signaturesCount++;
      if (metrics.temperatureCompliant) data.tempCompliantCount++;
      if (metrics.hasReceiverName) data.receiverNameCount++;
    });
    
    return Array.from(warehouseMap.values()).map(w => ({
      warehouse: w.warehouse,
      deliveryCount: w.deliveryCount,
      avgScore: Math.round(w.totalScore / w.deliveryCount),
      photoRate: Math.round((w.totalPhotos / w.deliveryCount) * 10) / 10,
      signatureRate: Math.round((w.signaturesCount / w.deliveryCount) * 100),
      tempComplianceRate: Math.round((w.tempCompliantCount / w.deliveryCount) * 100),
      receiverNameRate: Math.round((w.receiverNameCount / w.deliveryCount) * 100)
    })).sort((a, b) => b.avgScore - a.avgScore);
  }, [filteredConsignments]);
  
  // Calculate driver performance data
  const driverPerformance = useMemo(() => {
    const driverMap = new Map<string, {
      driver: string;
      deliveryCount: number;
      totalScore: number;
      totalPhotos: number;
      receiverNameCount: number;
      tempCompliantCount: number;
    }>();
    
    filteredConsignments.forEach((c: ConsignmentWithPhotoCount) => {
      const driver = c.driverName || "Unknown Driver";
      const metrics = calculatePODScore(c, c.actualPhotoCount);
      
      if (!driverMap.has(driver)) {
        driverMap.set(driver, {
          driver,
          deliveryCount: 0,
          totalScore: 0,
          totalPhotos: 0,
          receiverNameCount: 0,
          tempCompliantCount: 0
        });
      }
      
      const data = driverMap.get(driver)!;
      data.deliveryCount++;
      data.totalScore += metrics.qualityScore;
      data.totalPhotos += metrics.photoCount;
      if (metrics.hasReceiverName) data.receiverNameCount++;
      if (metrics.temperatureCompliant) data.tempCompliantCount++;
    });
    
    return Array.from(driverMap.values()).map(d => ({
      driver: d.driver,
      deliveryCount: d.deliveryCount,
      avgScore: Math.round(d.totalScore / d.deliveryCount),
      photoRate: Math.round((d.totalPhotos / d.deliveryCount) * 10) / 10,
      receiverNameRate: Math.round((d.receiverNameCount / d.deliveryCount) * 100),
      tempComplianceRate: Math.round((d.tempCompliantCount / d.deliveryCount) * 100)
    })).sort((a, b) => b.avgScore - a.avgScore);
  }, [filteredConsignments]);
  
  // Generate warehouse-specific insights
  const warehouseInsights = useMemo(() => {
    return warehouseComparison.map(w => {
      const issues: string[] = [];
      
      if (w.photoRate < 2) {
        issues.push(`Low photo coverage (${w.photoRate} avg photos/delivery)`);
      }
      if (w.receiverNameRate < 80) {
        issues.push(`Receiver names missing in ${100 - w.receiverNameRate}% of deliveries`);
      }
      if (w.tempComplianceRate < 85) {
        issues.push(`Temperature compliance at ${w.tempComplianceRate}%`);
      }
      
      return {
        warehouse: w.warehouse,
        avgScore: w.avgScore,
        issues: issues.length > 0 ? issues : ['All metrics performing well']
      };
    });
  }, [warehouseComparison]);
  
  // Load photos for a consignment using thumbnail-first strategy
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
    
    setLoadingPhotos(consignment.id);
    const currentRetries = photoLoadRetries.get(consignment.id) || 0;
    
    try {
      // Step 1: Get thumbnails first (fast)
      const thumbnailResponse = await apiRequest('GET', `/api/consignments/${consignment.id}/photos`);
      const thumbnailData = await thumbnailResponse.json();
      
      if (!thumbnailData.success) {
        toast({
          title: "Failed to load photos",
          description: thumbnailData.error || "An error occurred while loading photos",
          variant: "destructive"
        });
        return;
      }
      
      // Check if thumbnails are being prepared
      if (thumbnailData.status === 'preparing' && currentRetries < 5) {
        setPhotoLoadRetries(new Map(photoLoadRetries.set(consignment.id, currentRetries + 1)));
        
        if (currentRetries === 0) {
          toast({
            title: "Loading photos...",
            description: "Photos are being processed, this may take a moment",
          });
        }
        
        const delay = Math.min(1000 * Math.pow(1.5, currentRetries), 5000);
        setTimeout(() => loadPhotos(consignment), delay);
        return;
      }
      
      // Reset retry count
      setPhotoLoadRetries(new Map(photoLoadRetries.set(consignment.id, 0)));
      
      if ((!thumbnailData.photos || thumbnailData.photos.length === 0) && 
          (!thumbnailData.signatures || thumbnailData.signatures.length === 0)) {
        toast({
          title: "No photos available",
          description: "No photos found for this consignment. They may not have been uploaded yet.",
          variant: "destructive"
        });
        return;
      }
      
      // Show modal with thumbnails immediately
      const currentConsignmentNo = consignment.consignmentNo || consignment.orderNumberRef || "";
      setPhotoModal({
        isOpen: true,
        photos: thumbnailData.photos || [],
        signatures: thumbnailData.signatures || [],
        consignmentNo: currentConsignmentNo
      });
      
      // Step 2: Trigger full-res loading in background
      apiRequest('GET', `/api/consignments/${consignment.id}/photos/full-res`)
        .then(async fullResResponse => {
          const fullResData = await fullResResponse.json();
          if (fullResData.success && (fullResData.photos?.length > 0 || fullResData.signatures?.length > 0)) {
            // Only update if this consignment is still the active modal
            setPhotoModal(prev => {
              // Verify this full-res response matches the currently open modal
              if (prev.consignmentNo === currentConsignmentNo && prev.isOpen) {
                return {
                  ...prev,
                  photos: fullResData.photos || prev.photos,
                  signatures: fullResData.signatures || prev.signatures
                };
              }
              // Stale response, ignore it
              return prev;
            });
          }
        })
        .catch(error => {
          console.log('Full-res loading skipped or failed:', error);
          // Silent fail - thumbnails are already displayed
        });
        
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
    setDataLoaded(false); // Reset data load state
  };
  
  // Handler to update filters and reset data loaded state
  const updateFilter = (key: keyof Filters, value: string) => {
    setFilters({...filters, [key]: value});
    setDataLoaded(false); // Reset when filters change
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
      <div className="flex-1 flex flex-col">
        <header className="gradient-primary shadow-header z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-white">ChillTrack</h1>
              <span className="ml-3 text-blue-100 text-sm">POD Quality Dashboard</span>
            </div>
            
            <div className="flex items-center space-x-3">
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
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Header */}
      <header className="gradient-primary shadow-lg z-10 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-3xl font-bold text-white">ChillTrack</h1>
            <span className="ml-3 text-blue-100 text-sm">POD Quality Dashboard</span>
          </div>
          
          <div className="flex items-center space-x-3">
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
      
      {/* FILTERS SECTION - TOP PRIORITY */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Filter className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Filter Consignments</h2>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  {activeFilterCount} active
                </Badge>
              )}
            </div>
            
            <div className="flex gap-2">
              {activeFilterCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={resetFilters}
                  data-testid="button-reset-filters"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              )}
              <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} size="sm" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Sync
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                From Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={filters.fromDate}
                onChange={(e) => updateFilter("fromDate", e.target.value)}
                className="w-full"
                data-testid="input-date-from"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                To Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={filters.toDate}
                onChange={(e) => updateFilter("toDate", e.target.value)}
                className="w-full"
                data-testid="input-date-to"
              />
            </div>

            {/* Shipper */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Shipper</label>
              <Select value={filters.shipper} onValueChange={(val) => updateFilter("shipper", val)}>
                <SelectTrigger data-testid="select-shipper">
                  <SelectValue placeholder="All Shippers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shippers</SelectItem>
                  {uniqueShippers.map((shipper) => (
                    <SelectItem key={shipper} value={shipper}>{shipper}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Warehouse */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Warehouse</label>
              <Select value={filters.warehouse} onValueChange={(val) => updateFilter("warehouse", val)}>
                <SelectTrigger data-testid="select-warehouse">
                  <SelectValue placeholder="All Warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {uniqueWarehouses.map((warehouse) => (
                    <SelectItem key={warehouse} value={warehouse}>{warehouse}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Driver */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Driver</label>
              <Select value={filters.driver} onValueChange={(val) => updateFilter("driver", val)}>
                <SelectTrigger data-testid="select-driver">
                  <SelectValue placeholder="All Drivers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drivers</SelectItem>
                  {uniqueDrivers.map((driver) => (
                    <SelectItem key={driver} value={driver}>{driver}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search and Load Button */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by consignment, order, driver, customer, city..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>

            <Button
              onClick={() => {
                if (!hasFiltersApplied) {
                  toast({
                    title: "Please select a date range",
                    description: "Select at least a 'From Date' or 'To Date' to load data",
                    variant: "destructive"
                  });
                  return;
                }
                setDataLoaded(true);
              }}
              className="gradient-accent text-white h-10 px-8 font-semibold"
              disabled={!hasFiltersApplied || dataLoaded}
              data-testid="button-load-data"
            >
              {dataLoaded ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Data Loaded
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Load Data
                </>
              )}
            </Button>

            <Button onClick={() => refetch()} variant="outline" disabled={!dataLoaded || !hasFiltersApplied} className="h-10">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Status Message */}
          {!hasFiltersApplied && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Please select at least a date range to load consignments
              </p>
            </div>
          )}
          {hasFiltersApplied && !dataLoaded && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Filters selected. Click "Load Data" to fetch consignments
              </p>
            </div>
          )}
          {dataLoaded && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Showing {sortedConsignments.length} of {consignments.length} deliveries
                {activeFilterCount > 0 && <span className="ml-1">({activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active)</span>}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
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
              Receiver Name
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.signatureRate}%</div>
            <p className="text-xs text-gray-500">Receiver name recorded</p>
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
                    <Bar dataKey="signatureRate" fill="#10b981" name="Receiver Name (%)" />
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
                      <th className="text-center p-3 font-medium text-gray-700">Receiver Name %</th>
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
      
      {/* Insights Section */}
      {filteredConsignments.length > 0 && (
        <Card>
          <CardHeader 
            className="cursor-pointer hover:bg-gray-50 transition-colors" 
            onClick={() => setInsightsExpanded(!insightsExpanded)}
          >
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Performance Insights
                </CardTitle>
                <CardDescription>Driver rankings and warehouse improvement areas</CardDescription>
              </div>
              <ChevronDown className={`h-5 w-5 transition-transform ${insightsExpanded ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
          
          {insightsExpanded && (
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Driver Performance */}
                <div>
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Driver Performance
                  </h3>
                  
                  {/* Top Performers */}
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      Top Performers
                    </h4>
                    <div className="space-y-2">
                      {driverPerformance.slice(0, 3).map((driver, idx) => (
                        <div key={driver.driver} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{driver.driver}</div>
                            <div className="text-xs text-gray-600">{driver.deliveryCount} deliveries</div>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${
                              driver.avgScore >= 90 ? 'text-green-600' :
                              driver.avgScore >= 75 ? 'text-blue-600' :
                              'text-yellow-600'
                            }`}>
                              {driver.avgScore}%
                            </div>
                            <div className="text-xs text-gray-500">{driver.photoRate} photos avg</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Low Performers */}
                  {driverPerformance.length > 3 && (
                    <div>
                      <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                        <TrendingDown className="h-4 w-4" />
                        Needs Improvement
                      </h4>
                      <div className="space-y-2">
                        {driverPerformance.slice(-3).reverse().map((driver, idx) => (
                          <div key={driver.driver} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{driver.driver}</div>
                              <div className="text-xs text-gray-600">{driver.deliveryCount} deliveries</div>
                            </div>
                            <div className="text-right">
                              <div className={`text-lg font-bold ${
                                driver.avgScore >= 75 ? 'text-blue-600' :
                                driver.avgScore >= 60 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {driver.avgScore}%
                              </div>
                              <div className="text-xs text-gray-500">{driver.photoRate} photos avg</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Warehouse Improvement Areas */}
                <div>
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Warehouse Improvement Areas
                  </h3>
                  <div className="space-y-3">
                    {warehouseInsights.map((insight) => (
                      <div key={insight.warehouse} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-gray-900">{insight.warehouse}</h4>
                          <span className={`text-sm font-semibold ${
                            insight.avgScore >= 90 ? 'text-green-600' :
                            insight.avgScore >= 75 ? 'text-blue-600' :
                            insight.avgScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {insight.avgScore}%
                          </span>
                        </div>
                        <ul className="space-y-1">
                          {insight.issues.map((issue, idx) => (
                            <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                              <span className={`mt-1 ${
                                issue.includes('well') ? 'text-green-500' : 'text-amber-500'
                              }`}>
                                {issue.includes('well') ? '✓' : '•'}
                              </span>
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}
      
      {/* Consignments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Consignments</CardTitle>
          <CardDescription>
            Detailed POD quality scores for {sortedConsignments.length} deliveries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dataLoaded && (
            <div className="space-y-3">
              {paginatedConsignments.map((consignment: ConsignmentWithPhotoCount) => {
              const metrics = calculatePODScore(consignment, consignment.actualPhotoCount);
              const tier = getQualityTier(metrics.qualityScore);
              const trackingLink = consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink;
              const actualTemp = getActualTemperature(consignment);
              
              // Parse expected temperature from document_note
              const tempRange = parseRequiredTemperature(consignment.documentNote);
              const expectedTemp = tempRange ? `${tempRange.min}°C to ${tempRange.max}°C` : 
                                   (consignment.documentNote?.toLowerCase().includes('dry') ? 'Dry' : null);
              
              const thumbnail = photoThumbnails.get(consignment.id);
              
              return (
                <Card key={consignment.id} className="hover:shadow-md transition-shadow" data-testid={`card-consignment-${consignment.id}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                      {/* Main Information */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Package className="h-4 w-4 text-gray-400" />
                              <span className="font-semibold text-gray-900" data-testid={`text-order-${consignment.id}`}>
                                {consignment.orderNumberRef || consignment.consignmentNo || '-'}
                              </span>
                              {consignment.syncedAt && (
                                <span className="text-xs text-gray-400 ml-2" title={new Date(consignment.syncedAt).toLocaleString()}>
                                  synced {(() => {
                                    const now = Date.now();
                                    const synced = new Date(consignment.syncedAt).getTime();
                                    const diffMs = now - synced;
                                    const diffMins = Math.floor(diffMs / 60000);
                                    const diffHours = Math.floor(diffMs / 3600000);
                                    if (diffMins < 1) return 'just now';
                                    if (diffMins < 60) return `${diffMins}m ago`;
                                    if (diffHours < 24) return `${diffHours}h ago`;
                                    return new Date(consignment.syncedAt).toLocaleDateString();
                                  })()}
                                </span>
                              )}
                            </div>
                            {consignment.consignmentNo && consignment.consignmentNo !== consignment.orderNumberRef && (
                              <div className="text-xs text-gray-500 ml-6">{consignment.consignmentNo}</div>
                            )}
                          </div>
                          <div className={`px-3 py-1 rounded-full font-semibold text-lg ${
                            metrics.qualityScore >= 90 
                              ? "bg-green-100 text-green-800"
                              : metrics.qualityScore >= 75
                              ? "bg-blue-100 text-blue-800"
                              : metrics.qualityScore >= 60
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`} data-testid={`badge-score-${consignment.id}`}>
                            {metrics.qualityScore}%
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Customer</div>
                            <div className="font-medium text-gray-900">{consignment.shipToCompanyName || '-'}</div>
                            <div className="text-xs text-gray-500">{consignment.shipToCity || '-'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Warehouse / Depot</div>
                            <div className="font-medium text-gray-900">{consignment.warehouseCompanyName || '-'}</div>
                            <div className="text-xs text-gray-500">
                              <Users className="h-3 w-3 inline mr-1" />
                              {consignment.driverName || "No driver assigned"}
                            </div>
                          </div>
                        </div>
                        
                        {/* POD Quality Metrics */}
                        <div className="flex items-center gap-4 pt-3 border-t">
                          <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-1 px-2 py-1 rounded ${metrics.photoCount >= 3 ? 'bg-green-50' : metrics.photoCount > 0 ? 'bg-yellow-50' : 'bg-red-50'}`}>
                              <Camera className={`h-4 w-4 ${metrics.photoCount >= 3 ? 'text-green-600' : metrics.photoCount > 0 ? 'text-yellow-600' : 'text-red-600'}`} data-testid={`icon-photos-${consignment.id}`} />
                              <span className={`text-sm font-medium ${metrics.photoCount >= 3 ? 'text-green-700' : metrics.photoCount > 0 ? 'text-yellow-700' : 'text-red-700'}`} data-testid={`text-photo-count-${consignment.id}`}>
                                {metrics.photoCount} {metrics.photoCount === 1 ? 'photo' : 'photos'}
                              </span>
                            </div>
                          </div>
                          
                          <div className={`flex items-center gap-1 px-2 py-1 rounded ${metrics.hasReceiverName ? 'bg-green-50' : 'bg-red-50'}`}>
                            <FileSignature className={`h-4 w-4 ${metrics.hasReceiverName ? 'text-green-600' : 'text-red-600'}`} />
                            <span className={`text-sm font-medium ${metrics.hasReceiverName ? 'text-green-700' : 'text-red-700'}`}>
                              {metrics.hasReceiverName ? 'Receiver name ✓' : 'No receiver name'}
                            </span>
                          </div>
                          
                          {(consignment.documentNote || actualTemp) && (
                            <div className={`flex items-center gap-1 px-2 py-1 rounded ${metrics.temperatureCompliant ? 'bg-green-50' : 'bg-red-50'}`}>
                              <Thermometer className={`h-4 w-4 ${metrics.temperatureCompliant ? 'text-green-600' : 'text-red-600'}`} />
                              <div className={`text-xs font-medium ${metrics.temperatureCompliant ? 'text-green-700' : 'text-red-700'}`}>
                                <div className="flex items-center gap-1">
                                  <span className="opacity-70">Expected:</span>
                                  <span>{expectedTemp || '-'}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="opacity-70">Recorded:</span>
                                  <span>{actualTemp ? `${actualTemp}°C` : '-'}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div className="ml-auto flex gap-2">
                            {trackingLink && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => loadPhotos(consignment)}
                                disabled={loadingPhotos === consignment.id}
                                data-testid={`button-view-photos-${consignment.id}`}
                              >
                                {loadingPhotos === consignment.id ? (
                                  <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Loading...
                                  </>
                                ) : (
                                  <>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Photos
                                  </>
                                )}
                              </Button>
                            )}
                            {trackingLink && (
                              <a
                                href={trackingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button size="sm" variant="outline" data-testid={`link-tracking-${consignment.id}`}>
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Track
                                </Button>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Photo Thumbnails Section */}
                      {thumbnail && Array.isArray(thumbnail) && thumbnail.length > 0 && (
                        <div className="border-t pt-3">
                          <div className="flex gap-2 flex-wrap">
                            {thumbnail.map((photo, index) => (
                              <div 
                                key={index}
                                className="w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200 cursor-pointer hover:border-blue-400 transition-colors"
                                onClick={() => loadPhotos(consignment)}
                              >
                                <img 
                                  src={photo} 
                                  alt={`Delivery photo ${index + 1}`} 
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {filteredConsignments.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No consignments found matching your filters
              </div>
            )}
          </div>
          )}
          
          {/* Pagination Controls */}
          {dataLoaded && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t pt-4">
              <div className="text-sm text-gray-600">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredConsignments.length)} of {filteredConsignments.length} consignments
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        size="sm"
                        variant={currentPage === pageNum ? "default" : "outline"}
                        onClick={() => setCurrentPage(pageNum)}
                        data-testid={`button-page-${pageNum}`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  data-testid="button-next-page"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
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
      </main>
    </div>
  );
}