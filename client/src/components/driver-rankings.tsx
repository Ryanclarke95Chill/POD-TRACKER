import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Trophy, Award, Medal, Star, TrendingUp, TrendingDown, Camera, FileSignature, Thermometer, Package } from "lucide-react";
import { Consignment } from "@shared/schema";
import { calculatePODScore, getQualityTier } from "@/utils/podMetrics";

interface ConsignmentWithPhotoCount extends Consignment {
  actualPhotoCount?: number;
}

interface DriverRankingsProps {
  consignments: ConsignmentWithPhotoCount[];
}

interface DriverStats {
  driverName: string;
  warehouse: string;
  deliveryCount: number;
  avgQualityScore: number;
  avgPhotoCount: number;
  signatureRate: number;
  tempComplianceRate: number;
  photoComplianceRate: number;
  tier: string;
  tierColor: string;
}

export function DriverRankings({ consignments }: DriverRankingsProps) {
  // Calculate driver statistics
  const driverStats = useMemo(() => {
    const statsMap = new Map<string, {
      warehouse: string;
      deliveryCount: number;
      totalScore: number;
      totalPhotos: number;
      signaturesCount: number;
      tempCompliantCount: number;
      photoCompliantCount: number;
    }>();

    consignments.forEach((c) => {
      const driverName = c.driverName;
      // Use warehouseCompanyName first, then fallback to shipFromCompanyName (depot they ship from)
      const warehouse = c.warehouseCompanyName || c.shipFromCompanyName || "Unknown";
      if (!driverName) return;

      const metrics = calculatePODScore(c, c.actualPhotoCount);
      const key = `${driverName}|${warehouse}`;

      if (!statsMap.has(key)) {
        statsMap.set(key, {
          warehouse,
          deliveryCount: 0,
          totalScore: 0,
          totalPhotos: 0,
          signaturesCount: 0,
          tempCompliantCount: 0,
          photoCompliantCount: 0,
        });
      }

      const stats = statsMap.get(key)!;
      stats.deliveryCount++;
      stats.totalScore += metrics.qualityScore;
      stats.totalPhotos += metrics.photoCount;
      if (metrics.hasSignature) stats.signaturesCount++;
      if (metrics.temperatureCompliant) stats.tempCompliantCount++;
      if (metrics.photoCount >= 3) stats.photoCompliantCount++;
    });

    const drivers: DriverStats[] = [];
    statsMap.forEach((stats, key) => {
      const [driverName, warehouse] = key.split("|");
      const avgScore = Math.round(stats.totalScore / stats.deliveryCount);
      const tier = getQualityTier(avgScore);

      drivers.push({
        driverName,
        warehouse,
        deliveryCount: stats.deliveryCount,
        avgQualityScore: avgScore,
        avgPhotoCount: Math.round((stats.totalPhotos / stats.deliveryCount) * 10) / 10,
        signatureRate: Math.round((stats.signaturesCount / stats.deliveryCount) * 100),
        tempComplianceRate: Math.round((stats.tempCompliantCount / stats.deliveryCount) * 100),
        photoComplianceRate: Math.round((stats.photoCompliantCount / stats.deliveryCount) * 100),
        tier: tier.tier,
        tierColor: tier.color,
      });
    });

    return drivers.sort((a, b) => b.avgQualityScore - a.avgQualityScore);
  }, [consignments]);

  // Group by warehouse
  const warehouseGroups = useMemo(() => {
    const groups = new Map<string, DriverStats[]>();
    
    driverStats.forEach((driver) => {
      if (!groups.has(driver.warehouse)) {
        groups.set(driver.warehouse, []);
      }
      groups.get(driver.warehouse)!.push(driver);
    });

    // Sort each warehouse group by score
    groups.forEach((drivers) => {
      drivers.sort((a, b) => b.avgQualityScore - a.avgQualityScore);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b));
  }, [driverStats]);

  // National leaderboard - top 20
  const nationalLeaderboard = useMemo(() => {
    return [...driverStats]
      .sort((a, b) => b.avgQualityScore - a.avgQualityScore)
      .slice(0, 20);
  }, [driverStats]);

  const getTierIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Award className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <Star className="h-4 w-4 text-gray-400" />;
  };

  return (
    <div className="space-y-6">
      {/* National Leaderboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            <CardTitle>National Leaderboard</CardTitle>
          </div>
          <CardDescription>Top 20 drivers across all warehouses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {nationalLeaderboard.map((driver, index) => (
              <div
                key={`${driver.driverName}-${driver.warehouse}`}
                className={`flex items-center gap-4 p-3 rounded-lg border ${
                  index < 3 ? "bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200" : "bg-white border-gray-200"
                }`}
                data-testid={`leaderboard-driver-${index + 1}`}
              >
                <div className="flex items-center justify-center w-8">
                  {getTierIcon(index + 1)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{driver.driverName}</span>
                    <Badge variant="outline" className="text-xs">
                      {driver.warehouse}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {driver.deliveryCount} deliveries
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${driver.tierColor}`}>
                      {driver.avgQualityScore}
                    </div>
                    <div className="text-xs text-gray-500">Score</div>
                  </div>

                  <div className="hidden md:flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Camera className="h-4 w-4 text-gray-400" />
                      <span>{driver.photoComplianceRate}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FileSignature className="h-4 w-4 text-gray-400" />
                      <span>{driver.signatureRate}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Thermometer className="h-4 w-4 text-gray-400" />
                      <span>{driver.tempComplianceRate}%</span>
                    </div>
                  </div>

                  <Badge className={driver.tierColor}>
                    {driver.tier}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Warehouse Rankings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-500" />
            <CardTitle>Rankings by Warehouse</CardTitle>
          </div>
          <CardDescription>Driver performance grouped by warehouse/depot</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {warehouseGroups.map(([warehouse, drivers]) => {
              const avgWarehouseScore = Math.round(
                drivers.reduce((sum, d) => sum + d.avgQualityScore, 0) / drivers.length
              );
              
              return (
                <AccordionItem key={warehouse} value={warehouse}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-900">{warehouse}</span>
                        <Badge variant="outline">{drivers.length} drivers</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Avg Score:</span>
                        <span className="font-bold text-lg text-blue-600">{avgWarehouseScore}</span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 pt-2">
                      {drivers.map((driver, index) => (
                        <div
                          key={driver.driverName}
                          className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 border border-gray-200"
                          data-testid={`warehouse-driver-${warehouse}-${index + 1}`}
                        >
                          <div className="flex items-center justify-center w-8 font-bold text-gray-400">
                            #{index + 1}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900">{driver.driverName}</div>
                            <div className="text-xs text-gray-500">{driver.deliveryCount} deliveries</div>
                          </div>

                          <div className="flex items-center gap-6">
                            <div className="text-center">
                              <div className={`text-xl font-bold ${driver.tierColor}`}>
                                {driver.avgQualityScore}
                              </div>
                              <div className="text-xs text-gray-500">Score</div>
                            </div>

                            <div className="hidden lg:flex flex-col gap-1 text-xs">
                              <div className="flex items-center gap-2">
                                <Camera className="h-3 w-3 text-gray-400" />
                                <span>Photos: {driver.photoComplianceRate}%</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <FileSignature className="h-3 w-3 text-gray-400" />
                                <span>Signatures: {driver.signatureRate}%</span>
                              </div>
                            </div>

                            <Badge className={driver.tierColor}>
                              {driver.tier}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
