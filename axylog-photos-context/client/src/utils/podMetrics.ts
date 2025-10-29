import { Consignment, ScoreBreakdown } from "@shared/schema";

// Format driver name from "Last First" to "First Last"
export function formatDriverName(driverName: string | null | undefined): string {
  if (!driverName) return "";
  
  const trimmed = driverName.trim();
  if (!trimmed) return "";
  
  // Split by whitespace and filter out empty strings
  const parts = trimmed.split(/\s+/).filter(p => p.length > 0);
  
  // If we have exactly 2 parts, assume it's "Last First" and swap them
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`; // "First Last"
  }
  
  // Otherwise return as-is
  return trimmed;
}

export interface PODMetrics {
  photoCount: number;
  hasSignature: boolean;
  hasReceiverName: boolean;
  temperatureCompliant: boolean;
  hasTrackingLink: boolean;
  deliveryTime: string | null;
  qualityScore: number;
  scoreBreakdown: ScoreBreakdown;
}

// Get driver-recorded temperatures from consignment
export function getDriverTemperatures(consignment: Consignment): number[] {
  const temps: number[] = [];
  
  // Driver temp 1: payment_method field
  if (consignment.paymentMethod && consignment.paymentMethod !== "null") {
    const temp = parseFloat(consignment.paymentMethod);
    if (!isNaN(temp)) {
      temps.push(temp);
    }
  }
  
  // Driver temp 2: amount_collected field
  if (consignment.amountCollected && consignment.amountCollected !== "null") {
    const temp = parseFloat(consignment.amountCollected);
    if (!isNaN(temp)) {
      temps.push(temp);
    }
  }
  
  return temps;
}

// Parse required temperature range from document_note field
export function parseRequiredTemperature(documentNote: string | null): { min: number; max: number } | null {
  if (!documentNote) return null;
  
  const noteUpper = documentNote.toUpperCase();
  
  // Check for standard temperature zones with fixed ranges
  if (noteUpper.includes('FROZEN')) {
    // Frozen: -15°C to -25°C (anywhere in this range is compliant)
    return { min: -25, max: -15 };
  }
  
  if (noteUpper.includes('CHILL')) {
    // Chiller: 0°C to 5°C
    return { min: 0, max: 5 };
  }
  
  if (noteUpper.includes('AMBIENT')) {
    // Ambient: 0°C to 40°C
    return { min: 0, max: 40 };
  }
  
  // For other temperature types, parse the actual values from the note
  // Match patterns like: "-18C to -20C" or "0C to +4C" or "-18°C to -20°C"
  const rangePattern = /(-?\d+\.?\d*)\s*°?C?\s+to\s+([+-]?\d+\.?\d*)\s*°?C?/i;
  const match = documentNote.match(rangePattern);
  
  if (match) {
    const temp1 = parseFloat(match[1]);
    const temp2 = parseFloat(match[2]);
    
    if (!isNaN(temp1) && !isNaN(temp2)) {
      return {
        min: Math.min(temp1, temp2),
        max: Math.max(temp1, temp2)
      };
    }
  }
  
  // Single temperature pattern: "-18C" or "+4C"
  const singlePattern = /(-?\+?\d+\.?\d*)\s*°?C/i;
  const singleMatch = documentNote.match(singlePattern);
  
  if (singleMatch) {
    const temp = parseFloat(singleMatch[1]);
    if (!isNaN(temp)) {
      // Use ±2°C tolerance for single temp values
      return { min: temp - 2, max: temp + 2 };
    }
  }
  
  return null;
}

// Check if temperature reading is compliant with expected temperature zone
export function checkTemperatureCompliance(consignment: Consignment): boolean {
  // Get driver-recorded temperatures
  const driverTemps = getDriverTemperatures(consignment);
  
  // Special handling for GREENCROSS: require BOTH chilled AND frozen temps
  const shipperUpper = (consignment.shipperCompanyName || '').toUpperCase();
  if (shipperUpper.includes('GREENCROSS')) {
    // Need at least 2 temperature readings
    if (driverTemps.length < 2) {
      return false;
    }
    
    // Define ranges
    const chilledRange = { min: 0, max: 5 };
    const frozenRange = { min: -25, max: -15 };
    
    // Check if we have at least one temp in chilled range AND one in frozen range
    const hasChilled = driverTemps.some(temp => temp >= chilledRange.min && temp <= chilledRange.max);
    const hasFrozen = driverTemps.some(temp => temp >= frozenRange.min && temp <= frozenRange.max);
    
    return hasChilled && hasFrozen;
  }
  
  // Standard validation for all other shippers
  // Parse required temperature from document_note
  const requiredTemp = parseRequiredTemperature(consignment.documentNote);
  
  // No temperature requirement = always compliant
  if (!requiredTemp) {
    return true;
  }
  
  // No temperature readings = not compliant if temperature is required
  if (driverTemps.length === 0) {
    return false;
  }
  
  // PASS if at least ONE driver temp falls within the required range
  const isCompliant = driverTemps.some(temp => 
    temp >= requiredTemp.min && temp <= requiredTemp.max
  );
  
  return isCompliant;
}

// Get actual temperature reading for display (backward compatibility)
export function getActualTemperature(consignment: Consignment): string | null {
  const temps = getDriverTemperatures(consignment);
  if (temps.length > 0) {
    // Return both temps if available
    return temps.join(', ');
  }
  return null;
}

// Get photo count from file count fields
export function getPhotoCount(consignment: Consignment): number {
  // Axylog file counts include 1 extra photo that shouldn't be counted
  const deliveryFileCount = consignment.deliveryReceivedFileCount || 0;
  const pickupFileCount = consignment.pickupReceivedFileCount || 0;
  
  const totalCount = deliveryFileCount + pickupFileCount;
  
  // Subtract 1 to correct for Axylog's extra count, but never go below 0
  return Math.max(0, totalCount - 1);
}

// Calculate POD quality score
export function calculatePODScore(consignment: Consignment, actualPhotoCount?: number): PODMetrics {
  const scoreBreakdown: ScoreBreakdown = {
    photos: { points: 0, reason: "", status: "fail" },
    signature: { points: 0, reason: "", status: "fail" },
    receiverName: { points: 0, reason: "", status: "fail" },
    temperature: { points: 0, reason: "", status: "fail" },
    clearPhotos: { points: 0, reason: "", status: "pending" },
    total: 0
  };
  
  // Photo count (25 points for 3+ photos, no bonus)
  const photoCount = actualPhotoCount !== undefined ? actualPhotoCount : getPhotoCount(consignment);
  if (photoCount >= 3) {
    scoreBreakdown.photos = { 
      points: 25, 
      reason: `${photoCount} photos`, 
      status: "pass" 
    };
  } else if (photoCount >= 2) {
    scoreBreakdown.photos = { 
      points: 15, 
      reason: `${photoCount} photos (3 required for full points)`, 
      status: "partial" 
    };
  } else if (photoCount >= 1) {
    scoreBreakdown.photos = { 
      points: 8, 
      reason: `Only ${photoCount} photo (3 required for full points)`, 
      status: "partial" 
    };
  } else {
    scoreBreakdown.photos = { 
      points: 0, 
      reason: "No photos captured", 
      status: "fail" 
    };
  }
  
  // Signature (15 points)
  const hasSignature = !!(consignment.deliverySignatureName || consignment.pickupSignatureName);
  if (hasSignature) {
    scoreBreakdown.signature = { 
      points: 15, 
      reason: "Signature captured", 
      status: "pass" 
    };
  } else {
    scoreBreakdown.signature = { 
      points: 0, 
      reason: "No signature", 
      status: "fail" 
    };
  }
  
  // Receiver name (20 points)
  const hasReceiverName = !!(consignment.deliverySignatureName || consignment.pickupSignatureName);
  if (hasReceiverName) {
    scoreBreakdown.receiverName = { 
      points: 20, 
      reason: "Receiver name recorded", 
      status: "pass" 
    };
  } else {
    scoreBreakdown.receiverName = { 
      points: 0, 
      reason: "No receiver name", 
      status: "fail" 
    };
  }
  
  // Temperature compliance (40 points)
  const tempCompliant = checkTemperatureCompliance(consignment);
  const actualTemp = getActualTemperature(consignment);
  
  if (tempCompliant) {
    if (consignment.expectedTemperature === "Dry") {
      scoreBreakdown.temperature = { 
        points: 40, 
        reason: "No temperature requirement", 
        status: "pass" 
      };
    } else {
      scoreBreakdown.temperature = { 
        points: 40, 
        reason: `Temperature compliant (${actualTemp}°C)`, 
        status: "pass" 
      };
    }
  } else {
    const expectedTemp = consignment.expectedTemperature;
    scoreBreakdown.temperature = { 
      points: 0, 
      reason: `Temperature out of range (${actualTemp || "Not recorded"}, expected ${expectedTemp})`, 
      status: "fail" 
    };
  }
  
  // Clear photos removed - not used
  scoreBreakdown.clearPhotos = {
    points: 0,
    reason: "",
    status: "pending"
  };
  
  // Calculate total score (all criteria included)
  scoreBreakdown.total = 
    scoreBreakdown.photos.points +
    scoreBreakdown.signature.points +
    scoreBreakdown.receiverName.points +
    scoreBreakdown.temperature.points;
  
  return {
    photoCount,
    hasSignature,
    hasReceiverName,
    temperatureCompliant: tempCompliant,
    hasTrackingLink: !!(consignment.deliveryLiveTrackLink || consignment.pickupLiveTrackLink),
    deliveryTime: consignment.delivery_OutcomeDateTime,
    qualityScore: scoreBreakdown.total,
    scoreBreakdown
  };
}

// Get quality tier based on score
export function getQualityTier(score: number): {
  tier: string;
  color: string;
  label: string;
} {
  if (score === 100) {
    return { tier: "Excellent", color: "text-green-700", label: "Excellent" };
  } else if (score >= 90) {
    return { tier: "Excellent", color: "text-green-700", label: "Excellent" };
  } else if (score >= 75) {
    return { tier: "Good", color: "text-blue-700", label: "Good" };
  } else if (score >= 60) {
    return { tier: "Fair", color: "text-yellow-700", label: "Fair" };
  } else {
    return { tier: "Poor", color: "text-red-700", label: "Poor" };
  }
}