import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Trophy, Award, Medal, Camera, FileSignature, Thermometer, User, Package, TrendingUp, AlertCircle } from "lucide-react";
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
  avgTempPoints: number;
  avgPhotoPoints: number;
  avgReceiverPoints: number;
  avgSignaturePoints: number;
  tier: string;
  tierColor: string;
}

export function DriverRankings({ consignments }: DriverRankingsProps) {
  // Calculate driver statistics with component breakdown
  const driverStats = useMemo(() => {
    const statsMap = new Map<string, {
      warehouse: string;
      deliveryCount: number;
      totalScore: number;
      totalTempPoints: number;
      totalPhotoPoints: number;
      totalReceiverPoints: number;
      totalSignaturePoints: number;
    }>();

    consignments.forEach((c) => {
      const driverName = c.driverName;
      const warehouse = c.warehouseCompanyName || c.shipFromCompanyName || "Unknown";
      if (!driverName) return;

      const metrics = calculatePODScore(c, c.actualPhotoCount);
      const key = `${driverName}|${warehouse}`;

      if (!statsMap.has(key)) {
        statsMap.set(key, {
          warehouse,
          deliveryCount: 0,
          totalScore: 0,
          totalTempPoints: 0,
          totalPhotoPoints: 0,
          totalReceiverPoints: 0,
          totalSignaturePoints: 0,
        });
      }

      const stats = statsMap.get(key)!;
      stats.deliveryCount++;
      stats.totalScore += metrics.qualityScore;
      stats.totalTempPoints += metrics.scoreBreakdown.temperature.points;
      stats.totalPhotoPoints += metrics.scoreBreakdown.photos.points;
      stats.totalReceiverPoints += metrics.scoreBreakdown.receiverName.points;
      stats.totalSignaturePoints += metrics.scoreBreakdown.signature.points;
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
        avgTempPoints: Math.round(stats.totalTempPoints / stats.deliveryCount),
        avgPhotoPoints: Math.round(stats.totalPhotoPoints / stats.deliveryCount),
        avgReceiverPoints: Math.round(stats.totalReceiverPoints / stats.deliveryCount),
        avgSignaturePoints: Math.round(stats.totalSignaturePoints / stats.deliveryCount),
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

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-500" />;
    if (rank === 2) return <Award className="h-6 w-6 text-gray-400" />;
    if (rank === 3) return <Medal className="h-6 w-6 text-amber-600" />;
    return <div className="w-6 h-6 flex items-center justify-center text-sm font-semibold text-gray-500">#{rank}</div>;
  };

  const getComponentStatus = (points: number, maxPoints: number) => {
    const percentage = (points / maxPoints) * 100;
    if (percentage >= 90) return { color: "text-green-600 bg-green-50", icon: "✓" };
    if (percentage >= 70) return { color: "text-blue-600 bg-blue-50", icon: "~" };
    if (percentage >= 50) return { color: "text-yellow-600 bg-yellow-50", icon: "!" };
    return { color: "text-red-600 bg-red-50", icon: "✗" };
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
          <CardDescription>Top performing drivers across all warehouses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {nationalLeaderboard.map((driver, index) => {
              const tempStatus = getComponentStatus(driver.avgTempPoints, 40);
              const photoStatus = getComponentStatus(driver.avgPhotoPoints, 25);
              const receiverStatus = getComponentStatus(driver.avgReceiverPoints, 20);
              const signatureStatus = getComponentStatus(driver.avgSignaturePoints, 15);

              return (
                <div
                  key={`${driver.driverName}-${driver.warehouse}`}
                  className={`p-4 rounded-lg border transition-all ${
                    index < 3 
                      ? "bg-gradient-to-r from-yellow-50 via-orange-50 to-yellow-50 border-yellow-300 shadow-sm" 
                      : "bg-white border-gray-200 hover:border-gray-300"
                  }`}
                  data-testid={`leaderboard-driver-${index + 1}`}
                >
                  {/* Header Row */}
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex-shrink-0">
                      {getRankBadge(index + 1)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-lg">{driver.driverName}</span>
                        <Badge variant="outline" className="text-xs">
                          {driver.warehouse}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {driver.deliveryCount} {driver.deliveryCount === 1 ? 'delivery' : 'deliveries'}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${driver.tierColor}`}>
                          {driver.avgQualityScore}
                        </div>
                        <div className="text-xs text-gray-500 font-medium">out of 100</div>
                      </div>
                      <Badge 
                        className={`${driver.tierColor} px-3 py-1 text-sm font-semibold`}
                        data-testid={`driver-tier-${index + 1}`}
                      >
                        {driver.tier}
                      </Badge>
                    </div>
                  </div>

                  {/* Component Breakdown */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Temperature */}
                    <div 
                      className={`rounded-md p-2.5 border ${tempStatus.color.includes('green') ? 'border-green-200' : tempStatus.color.includes('red') ? 'border-red-200' : 'border-gray-200'}`}
                      data-testid={`leaderboard-temp-${index + 1}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Thermometer className="h-4 w-4 text-gray-600" />
                        <span className="text-xs font-medium text-gray-700">Temperature</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span 
                          className={`text-lg font-bold ${tempStatus.color.replace('bg-', 'text-').replace('-50', '-700')}`}
                          data-testid={`leaderboard-temp-points-${index + 1}`}
                        >
                          {driver.avgTempPoints}
                        </span>
                        <span className="text-xs text-gray-500">/ 40</span>
                      </div>
                      <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${tempStatus.color.replace('text-', 'bg-').replace('-50', '-500')}`}
                          style={{ width: `${(driver.avgTempPoints / 40) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Photos */}
                    <div 
                      className={`rounded-md p-2.5 border ${photoStatus.color.includes('green') ? 'border-green-200' : photoStatus.color.includes('red') ? 'border-red-200' : 'border-gray-200'}`}
                      data-testid={`leaderboard-photo-${index + 1}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Camera className="h-4 w-4 text-gray-600" />
                        <span className="text-xs font-medium text-gray-700">Photos</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span 
                          className={`text-lg font-bold ${photoStatus.color.replace('bg-', 'text-').replace('-50', '-700')}`}
                          data-testid={`leaderboard-photo-points-${index + 1}`}
                        >
                          {driver.avgPhotoPoints}
                        </span>
                        <span className="text-xs text-gray-500">/ 25</span>
                      </div>
                      <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${photoStatus.color.replace('text-', 'bg-').replace('-50', '-500')}`}
                          style={{ width: `${(driver.avgPhotoPoints / 25) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Receiver Name */}
                    <div 
                      className={`rounded-md p-2.5 border ${receiverStatus.color.includes('green') ? 'border-green-200' : receiverStatus.color.includes('red') ? 'border-red-200' : 'border-gray-200'}`}
                      data-testid={`leaderboard-receiver-${index + 1}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <User className="h-4 w-4 text-gray-600" />
                        <span className="text-xs font-medium text-gray-700">Receiver</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span 
                          className={`text-lg font-bold ${receiverStatus.color.replace('bg-', 'text-').replace('-50', '-700')}`}
                          data-testid={`leaderboard-receiver-points-${index + 1}`}
                        >
                          {driver.avgReceiverPoints}
                        </span>
                        <span className="text-xs text-gray-500">/ 20</span>
                      </div>
                      <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${receiverStatus.color.replace('text-', 'bg-').replace('-50', '-500')}`}
                          style={{ width: `${(driver.avgReceiverPoints / 20) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Signature */}
                    <div 
                      className={`rounded-md p-2.5 border ${signatureStatus.color.includes('green') ? 'border-green-200' : signatureStatus.color.includes('red') ? 'border-red-200' : 'border-gray-200'}`}
                      data-testid={`leaderboard-signature-${index + 1}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <FileSignature className="h-4 w-4 text-gray-600" />
                        <span className="text-xs font-medium text-gray-700">Signature</span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span 
                          className={`text-lg font-bold ${signatureStatus.color.replace('bg-', 'text-').replace('-50', '-700')}`}
                          data-testid={`leaderboard-signature-points-${index + 1}`}
                        >
                          {driver.avgSignaturePoints}
                        </span>
                        <span className="text-xs text-gray-500">/ 15</span>
                      </div>
                      <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${signatureStatus.color.replace('text-', 'bg-').replace('-50', '-500')}`}
                          style={{ width: `${(driver.avgSignaturePoints / 15) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Warehouse Rankings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-blue-600" />
            <CardTitle>Rankings by Warehouse</CardTitle>
          </div>
          <CardDescription>Performance grouped by depot and warehouse location</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {warehouseGroups.map(([warehouse, drivers]) => {
              const avgWarehouseScore = Math.round(
                drivers.reduce((sum, d) => sum + d.avgQualityScore, 0) / drivers.length
              );
              const warehouseTier = getQualityTier(avgWarehouseScore);
              
              return (
                <AccordionItem key={warehouse} value={warehouse}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-blue-600" />
                        <span className="font-bold text-gray-900">{warehouse}</span>
                        <Badge variant="outline" className="text-xs">
                          {drivers.length} {drivers.length === 1 ? 'driver' : 'drivers'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs text-gray-500 font-medium">Depot Average</div>
                          <div className={`text-2xl font-bold ${warehouseTier.color}`}>
                            {avgWarehouseScore}
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-3">
                      {drivers.map((driver, index) => {
                        const tempStatus = getComponentStatus(driver.avgTempPoints, 40);
                        const photoStatus = getComponentStatus(driver.avgPhotoPoints, 25);
                        const receiverStatus = getComponentStatus(driver.avgReceiverPoints, 20);
                        const signatureStatus = getComponentStatus(driver.avgSignaturePoints, 15);

                        return (
                          <div
                            key={driver.driverName}
                            className="p-4 rounded-lg bg-gray-50 border border-gray-200 hover:border-gray-300 transition-all"
                            data-testid={`warehouse-driver-${warehouse}-${index + 1}`}
                          >
                            {/* Header */}
                            <div className="flex items-center gap-4 mb-3">
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center font-bold text-gray-600">
                                #{index + 1}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-gray-900 text-base">{driver.driverName}</div>
                                <div className="text-xs text-gray-500">{driver.deliveryCount} deliveries</div>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="text-right">
                                  <div className={`text-2xl font-bold ${driver.tierColor}`}>
                                    {driver.avgQualityScore}
                                  </div>
                                  <div className="text-xs text-gray-500">/ 100</div>
                                </div>
                                <Badge className={`${driver.tierColor} font-semibold`}>
                                  {driver.tier}
                                </Badge>
                              </div>
                            </div>

                            {/* Component Breakdown */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {/* Temperature */}
                              <div 
                                className={`rounded p-2 border ${tempStatus.color.includes('green') ? 'border-green-200' : tempStatus.color.includes('red') ? 'border-red-200' : 'border-gray-200'}`}
                                data-testid={`warehouse-temp-${warehouse}-${index + 1}`}
                              >
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Thermometer className="h-3.5 w-3.5 text-gray-600" />
                                  <span className="text-xs text-gray-700">Temp</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                  <span 
                                    className={`text-base font-bold ${tempStatus.color.replace('bg-', 'text-').replace('-50', '-700')}`}
                                    data-testid={`warehouse-temp-points-${warehouse}-${index + 1}`}
                                  >
                                    {driver.avgTempPoints}
                                  </span>
                                  <span className="text-xs text-gray-500">/ 40</span>
                                </div>
                                <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${tempStatus.color.replace('text-', 'bg-').replace('-50', '-500')}`}
                                    style={{ width: `${(driver.avgTempPoints / 40) * 100}%` }}
                                  />
                                </div>
                              </div>

                              {/* Photos */}
                              <div 
                                className={`rounded p-2 border ${photoStatus.color.includes('green') ? 'border-green-200' : photoStatus.color.includes('red') ? 'border-red-200' : 'border-gray-200'}`}
                                data-testid={`warehouse-photo-${warehouse}-${index + 1}`}
                              >
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Camera className="h-3.5 w-3.5 text-gray-600" />
                                  <span className="text-xs text-gray-700">Photos</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                  <span 
                                    className={`text-base font-bold ${photoStatus.color.replace('bg-', 'text-').replace('-50', '-700')}`}
                                    data-testid={`warehouse-photo-points-${warehouse}-${index + 1}`}
                                  >
                                    {driver.avgPhotoPoints}
                                  </span>
                                  <span className="text-xs text-gray-500">/ 25</span>
                                </div>
                                <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${photoStatus.color.replace('text-', 'bg-').replace('-50', '-500')}`}
                                    style={{ width: `${(driver.avgPhotoPoints / 25) * 100}%` }}
                                  />
                                </div>
                              </div>

                              {/* Receiver */}
                              <div 
                                className={`rounded p-2 border ${receiverStatus.color.includes('green') ? 'border-green-200' : receiverStatus.color.includes('red') ? 'border-red-200' : 'border-gray-200'}`}
                                data-testid={`warehouse-receiver-${warehouse}-${index + 1}`}
                              >
                                <div className="flex items-center gap-1.5 mb-1">
                                  <User className="h-3.5 w-3.5 text-gray-600" />
                                  <span className="text-xs text-gray-700">Receiver</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                  <span 
                                    className={`text-base font-bold ${receiverStatus.color.replace('bg-', 'text-').replace('-50', '-700')}`}
                                    data-testid={`warehouse-receiver-points-${warehouse}-${index + 1}`}
                                  >
                                    {driver.avgReceiverPoints}
                                  </span>
                                  <span className="text-xs text-gray-500">/ 20</span>
                                </div>
                                <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${receiverStatus.color.replace('text-', 'bg-').replace('-50', '-500')}`}
                                    style={{ width: `${(driver.avgReceiverPoints / 20) * 100}%` }}
                                  />
                                </div>
                              </div>

                              {/* Signature */}
                              <div 
                                className={`rounded p-2 border ${signatureStatus.color.includes('green') ? 'border-green-200' : signatureStatus.color.includes('red') ? 'border-red-200' : 'border-gray-200'}`}
                                data-testid={`warehouse-signature-${warehouse}-${index + 1}`}
                              >
                                <div className="flex items-center gap-1.5 mb-1">
                                  <FileSignature className="h-3.5 w-3.5 text-gray-600" />
                                  <span className="text-xs text-gray-700">Signature</span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                  <span 
                                    className={`text-base font-bold ${signatureStatus.color.replace('bg-', 'text-').replace('-50', '-700')}`}
                                    data-testid={`warehouse-signature-points-${warehouse}-${index + 1}`}
                                  >
                                    {driver.avgSignaturePoints}
                                  </span>
                                  <span className="text-xs text-gray-500">/ 15</span>
                                </div>
                                <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${signatureStatus.color.replace('text-', 'bg-').replace('-50', '-500')}`}
                                    style={{ width: `${(driver.avgSignaturePoints / 15) * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
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
