// Driver Performance Statistics with Fair Cohort Comparisons
import { Consignment } from '@shared/schema';

// POD analysis function (simplified version for driver stats)
const calculatePODScore = (consignment: Consignment): number => {
  let score = 0;
  let maxScore = 100;
  
  // Signature check (30 points)
  if (consignment.deliverySignatureName) {
    score += 30;
  }
  
  // Photo presence check (40 points) - simplified
  // Assume 2+ photos for good score, 1 photo for partial, 0 for none
  const hasDeliveryLink = !!consignment.deliveryLiveTrackLink;
  const hasPickupLink = !!consignment.pickupLiveTrackLink;
  if (hasDeliveryLink || hasPickupLink) {
    score += 40; // Assume good photos if tracking link exists
  }
  
  // Receiver name check (15 points)
  if (consignment.deliverySignatureName && consignment.deliverySignatureName.length > 1) {
    score += 15;
  }
  
  // Temperature compliance check (15 points) - simplified
  const hasExpectedTemp = !!consignment.expectedTemperature;
  const hasActualTemp = !!(consignment as any).paymentMethod;
  if (hasExpectedTemp && hasActualTemp) {
    score += 15;
  } else if (!hasExpectedTemp) {
    score += 15; // No temp requirements = compliant
  }
  
  return Math.min(score, maxScore);
};

export interface DriverStats {
  driverId: string;
  driverName: string;
  totalDeliveries: number;
  activeDays: number;
  
  // Rate metrics (0-1)
  validPodRate: number;
  signatureRate: number;
  temperatureComplianceRate: number;
  
  // Wilson lower bound confidence intervals (95%) for fair ranking
  validPodLowerBound: number;
  signatureLowerBound: number;
  temperatureLowerBound: number;
  
  // Composite score for ranking
  compositeScore: number;
  
  // Average POD score (0-100)
  avgPodScore: number;
  
  // Cohort classification
  cohort: 'regular' | 'high-volume' | 'new-casual';
  
  // Raw counts for transparency
  validPods: number;
  signaturesReceived: number;
  temperatureCompliant: number;
}

export interface DriverCohortConfig {
  timeWindowWeeks: number;
  regularDriverMinDeliveries: number;
  regularDriverMinActiveDays: number;
  highVolumeThresholdPercentile: number; // 0.75 = top 25%
}

// Default configuration - can be made configurable later
export const DEFAULT_COHORT_CONFIG: DriverCohortConfig = {
  timeWindowWeeks: 4,
  regularDriverMinDeliveries: 20,
  regularDriverMinActiveDays: 4,
  highVolumeThresholdPercentile: 0.75
};

// Wilson score confidence interval (95% confidence)
// Prevents small sample sizes from inflating scores unfairly
function wilsonLowerBound(successes: number, total: number, confidence = 0.95): number {
  if (total === 0) return 0;
  
  const z = confidence === 0.95 ? 1.96 : 1.645; // 95% or 90% confidence
  const p = successes / total;
  const n = total;
  
  const denominator = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  
  return Math.max(0, (center - margin) / denominator);
}

// Calculate driver statistics from consignments
export function calculateDriverStats(
  consignments: Consignment[], 
  config = DEFAULT_COHORT_CONFIG
): DriverStats[] {
  // Filter consignments to time window
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - (config.timeWindowWeeks * 7));
  
  const recentConsignments = consignments.filter(c => 
    c.delivery_OutcomeDateTime && new Date(c.delivery_OutcomeDateTime) >= cutoffDate
  );

  // Group by driver
  const driverGroups = new Map<string, Consignment[]>();
  
  recentConsignments.forEach(consignment => {
    const driverId = consignment.driverCode?.toString() || 'unknown';
    const driverName = consignment.driverName || 'Unknown Driver';
    const key = `${driverId}-${driverName}`;
    
    if (!driverGroups.has(key)) {
      driverGroups.set(key, []);
    }
    driverGroups.get(key)!.push(consignment);
  });

  // Calculate stats for each driver
  const driverStats: DriverStats[] = [];
  
  for (const [key, deliveries] of Array.from(driverGroups.entries())) {
    const [driverId, driverName] = key.split('-', 2);
    
    // Basic counts
    const totalDeliveries = deliveries.length;
    
    // Calculate actual POD scores for each delivery
    const podScores = deliveries.map(d => calculatePODScore(d));
    const totalPodScore = podScores.reduce((sum, score) => sum + score, 0);
    const avgPodScore = totalDeliveries > 0 ? totalPodScore / totalDeliveries : 0;
    
    // Secondary metrics
    const signaturesReceived = deliveries.filter((d: Consignment) => d.deliverySignatureName).length;
    const validPods = podScores.filter(score => score >= 60).length; // Bronze level or better
    const temperatureCompliant = deliveries.filter(d => {
      const hasExpectedTemp = !!d.expectedTemperature;
      const hasActualTemp = !!(d as any).paymentMethod;
      return hasExpectedTemp ? hasActualTemp : true;
    }).length;
    
    // Calculate unique active days
    const activeDays = new Set(
      deliveries
        .filter((d: Consignment) => d.delivery_OutcomeDateTime)
        .map((d: Consignment) => new Date(d.delivery_OutcomeDateTime!).toDateString())
    ).size;
    
    // Rate calculations
    const validPodRate = totalDeliveries > 0 ? validPods / totalDeliveries : 0;
    const signatureRate = totalDeliveries > 0 ? signaturesReceived / totalDeliveries : 0;
    const temperatureComplianceRate = totalDeliveries > 0 ? temperatureCompliant / totalDeliveries : 0;
    
    // Wilson lower bounds for fair ranking
    const validPodLowerBound = wilsonLowerBound(validPods, totalDeliveries);
    const signatureLowerBound = wilsonLowerBound(signaturesReceived, totalDeliveries);
    const temperatureLowerBound = wilsonLowerBound(temperatureCompliant, totalDeliveries);
    
    // Composite score based on average POD score (normalized to 0-1)
    const compositeScore = avgPodScore / 100; // Convert 0-100 scale to 0-1 scale
    
    driverStats.push({
      driverId,
      driverName,
      totalDeliveries,
      activeDays,
      validPodRate,
      signatureRate,
      temperatureComplianceRate,
      validPodLowerBound,
      signatureLowerBound,
      temperatureLowerBound,
      compositeScore,
      avgPodScore, // Add average POD score
      cohort: 'new-casual', // Will be set below
      validPods,
      signaturesReceived,
      temperatureCompliant
    });
  }
  
  // Determine cohorts
  const sortedByDeliveries = [...driverStats].sort((a, b) => b.totalDeliveries - a.totalDeliveries);
  const highVolumeThreshold = sortedByDeliveries[Math.floor(sortedByDeliveries.length * config.highVolumeThresholdPercentile)]?.totalDeliveries || Infinity;
  
  driverStats.forEach(driver => {
    if (driver.totalDeliveries >= config.regularDriverMinDeliveries && 
        driver.activeDays >= config.regularDriverMinActiveDays) {
      
      if (driver.totalDeliveries >= highVolumeThreshold) {
        driver.cohort = 'high-volume';
      } else {
        driver.cohort = 'regular';
      }
    } else {
      driver.cohort = 'new-casual';
    }
  });
  
  // Sort by composite score (descending)
  return driverStats.sort((a, b) => b.compositeScore - a.compositeScore);
}

// Get drivers by cohort
export function getDriversByCohort(drivers: DriverStats[], cohort: 'regular' | 'high-volume' | 'new-casual'): DriverStats[] {
  return drivers.filter(d => d.cohort === cohort);
}

// Get summary statistics for a cohort
export interface CohortSummary {
  totalDrivers: number;
  averageDeliveries: number;
  averageValidPodRate: number;
  averageSignatureRate: number;
  averageTemperatureCompliance: number;
  averagePodScore: number;
  topPerformerName: string;
  bottomPerformerName: string;
}

export function getCohortSummary(drivers: DriverStats[]): CohortSummary {
  if (drivers.length === 0) {
    return {
      totalDrivers: 0,
      averageDeliveries: 0,
      averageValidPodRate: 0,
      averageSignatureRate: 0,
      averageTemperatureCompliance: 0,
      averagePodScore: 0,
      topPerformerName: 'N/A',
      bottomPerformerName: 'N/A'
    };
  }
  
  const totalDrivers = drivers.length;
  const averageDeliveries = drivers.reduce((sum, d) => sum + d.totalDeliveries, 0) / totalDrivers;
  const averageValidPodRate = drivers.reduce((sum, d) => sum + d.validPodRate, 0) / totalDrivers;
  const averageSignatureRate = drivers.reduce((sum, d) => sum + d.signatureRate, 0) / totalDrivers;
  const averageTemperatureCompliance = drivers.reduce((sum, d) => sum + d.temperatureComplianceRate, 0) / totalDrivers;
  const averagePodScore = drivers.reduce((sum, d) => sum + d.avgPodScore, 0) / totalDrivers;
  
  const sortedByScore = [...drivers].sort((a, b) => b.compositeScore - a.compositeScore);
  
  return {
    totalDrivers,
    averageDeliveries: Math.round(averageDeliveries),
    averageValidPodRate,
    averageSignatureRate,
    averageTemperatureCompliance,
    averagePodScore,
    topPerformerName: sortedByScore[0]?.driverName || 'N/A',
    bottomPerformerName: sortedByScore[sortedByScore.length - 1]?.driverName || 'N/A'
  };
}