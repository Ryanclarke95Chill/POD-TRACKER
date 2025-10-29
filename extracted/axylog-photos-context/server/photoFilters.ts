/**
 * Shared photo filtering logic for POD quality system
 * Used by both the background worker and API routes to ensure consistent filtering
 */

export interface PhotoCandidate {
  src: string;
  width: number;
  height: number;
  alt?: string;
  className?: string;
}

export interface FilteredPhoto {
  url: string;
  kind: 'photo' | 'signature';
  width: number;
  height: number;
  isThumbnail?: boolean; // true if this is a thumbnail-sized image
}

/**
 * Extract thumbnail-sized images for fast initial loading
 * Prioritizes smaller images (200-500px) for quick page display
 */
export function extractThumbnails(images: PhotoCandidate[]): FilteredPhoto[] {
  const filtered: FilteredPhoto[] = [];
  
  for (const img of images) {
    // Basic validation
    if (!img.src || img.width < 50 || img.height < 50) continue;
    
    // Skip obvious UI elements
    if (img.src.includes('ghost.svg') || img.src.includes('loading')) continue;
    if (img.alt?.toLowerCase().includes('logo') || img.className?.includes('logo')) continue;
    
    // Skip Chill logo/branding images - MORE COMPREHENSIVE
    const srcLower = img.src.toLowerCase();
    const altLower = (img.alt || '').toLowerCase();
    const classLower = (img.className || '').toLowerCase();
    
    // Filter out ANY Chill-related image (not just logos)
    if (srcLower.includes('chill') || altLower.includes('chill') || classLower.includes('chill')) continue;
    
    // Skip small square placeholder images (often 150x150 or similar)
    const isSmallSquare = img.width === img.height && img.width <= 200;
    if (isSmallSquare) continue;
    
    const shortSide = Math.min(img.width, img.height);
    const longSide = Math.max(img.width, img.height);
    const pixelArea = img.width * img.height;
    const aspectRatio = img.width / Math.max(img.height, 1);
    
    // Check for signatures - only if explicitly marked or very small height
    const text = ((img.alt || '') + ' ' + (img.className || '')).toLowerCase();
    const isDimensionSignature = 
      img.height <= 200 && 
      aspectRatio >= 3.0 && 
      img.width >= 300 && 
      img.width <= 1200 &&
      pixelArea <= 120000;
    const isTextSignature = text.includes('signature') || text.includes('firma') || text.includes('sign');
    // Only classify as signature if it has signature text OR is extremely thin (height <= 150)
    const isSignature = (isDimensionSignature && isTextSignature) || (isDimensionSignature && img.height <= 150);
    
    if (isSignature) {
      if (shortSide >= 120 && pixelArea <= 120000 && isValidPhotoUrl(img.src)) {
        filtered.push({
          url: img.src,
          kind: 'signature',
          width: img.width,
          height: img.height,
          isThumbnail: true
        });
      }
      continue;
    }
    
    // THUMBNAIL CRITERIA: Accept a wide range of photo sizes
    // - Short side: >= 150px (minimum for quality)
    // - Pixel area: >= 40k (minimum for usable photos)
    // - Aspect ratio: 0.4-2.5 (normal photo ratios)
    // - Long side: >= 200px
    
    // Debug: Check what's being rejected
    const meetsImageCriteria = shortSide >= 150 &&
        pixelArea >= 40000 &&
        aspectRatio >= 0.4 && aspectRatio <= 2.5 &&
        longSide >= 200;
        
    if (meetsImageCriteria) {
      const isValidUrl = isValidPhotoUrl(img.src);
      if (!isValidUrl) {
        // Log URLs that pass image criteria but fail URL validation
        console.log(`[PhotoFilter] Rejected URL (meets size criteria): ${img.src}`);
      } else {
        filtered.push({
          url: img.src,
          kind: 'photo',
          width: img.width,
          height: img.height,
          isThumbnail: true
        });
      }
    }
  }
  
  return filtered;
}

/**
 * Extract full-resolution images for detailed viewing
 * Targets larger images (600px+) for modal display
 */
export function extractFullResolution(images: PhotoCandidate[]): FilteredPhoto[] {
  const filtered: FilteredPhoto[] = [];
  
  for (const img of images) {
    if (!img.src || img.width < 50 || img.height < 50) continue;
    if (img.src.includes('ghost.svg') || img.src.includes('loading')) continue;
    if (img.alt?.toLowerCase().includes('logo') || img.className?.includes('logo')) continue;
    
    const shortSide = Math.min(img.width, img.height);
    const longSide = Math.max(img.width, img.height);
    const pixelArea = img.width * img.height;
    const aspectRatio = img.width / Math.max(img.height, 1);
    
    // Check for signatures
    const text = ((img.alt || '') + ' ' + (img.className || '')).toLowerCase();
    const isDimensionSignature = 
      img.height <= 220 && aspectRatio >= 3.0 && 
      img.width >= 300 && img.width <= 1200 && pixelArea <= 120000;
    const isTextSignature = text.includes('signature') || text.includes('firma') || text.includes('sign');
    const isSignature = (isDimensionSignature && isTextSignature) || (isDimensionSignature && img.height <= 180);
    
    if (isSignature) {
      if (shortSide >= 120 && pixelArea <= 120000 && isValidPhotoUrl(img.src)) {
        filtered.push({
          url: img.src,
          kind: 'signature',
          width: img.width,
          height: img.height,
          isThumbnail: false
        });
      }
      continue;
    }
    
    // FULL-RES CRITERIA: Larger images for quality viewing
    // - Short side >= 350px
    // - Pixel area >= 200k
    // - Long side >= 600px
    // - Normal aspect ratio
    
    if (shortSide >= 350 && pixelArea >= 200000 &&
        aspectRatio >= 0.45 && aspectRatio <= 1.9 &&
        longSide >= 600 &&
        isValidPhotoUrl(img.src)) {
      filtered.push({
        url: img.src,
        kind: 'photo',
        width: img.width,
        height: img.height,
        isThumbnail: false
      });
    }
  }
  
  return filtered;
}

/**
 * Smart photo filtering to exclude UI elements and only keep actual delivery photos
 * 
 * Filters out:
 * - Social media icons (< 350px short side)
 * - Banners and headers (bad aspect ratio outside 0.45-1.9)
 * - Small UI elements (< 200k pixel area)
 * - Invalid or inaccessible URLs
 * 
 * Keeps:
 * - Actual driver photos (typically 768x1024 Azure Blob Storage URLs)
 * - Photos with reasonable dimensions and aspect ratios
 */
export function filterAndClassifyPhotos(images: PhotoCandidate[]): FilteredPhoto[] {
  const filtered: FilteredPhoto[] = [];
  
  for (const img of images) {
    // Basic validation
    if (!img.src || img.width < 50 || img.height < 50) continue;
    
    // Skip obvious UI elements
    if (img.src.includes('ghost.svg') || img.src.includes('loading')) continue;
    if (img.alt?.toLowerCase().includes('logo') || img.className?.includes('logo')) continue;
    
    // Skip Chill logo/branding images - MORE COMPREHENSIVE
    const srcLower = img.src.toLowerCase();
    const altLower = (img.alt || '').toLowerCase();
    const classLower = (img.className || '').toLowerCase();
    
    // Filter out ANY Chill-related image (not just logos)
    if (srcLower.includes('chill') || altLower.includes('chill') || classLower.includes('chill')) continue;
    
    // Skip small square placeholder images (often 150x150 or similar)
    const isSmallSquare = img.width === img.height && img.width <= 200;
    if (isSmallSquare) continue;
    
    // Calculate dimensions for filtering
    const shortSide = Math.min(img.width, img.height);
    const longSide = Math.max(img.width, img.height);
    const pixelArea = img.width * img.height;
    const aspectRatio = img.width / Math.max(img.height, 1);
    
    // Check if it's a signature first (before dimension filtering)
    const text = ((img.alt || '') + ' ' + (img.className || '')).toLowerCase();
    
    // STRICT signature detection to exclude banners/headers:
    // - Height must be ≤220px (actual signatures are thin)
    // - Aspect ratio must be ≥3.0 (very wide and short)
    // - Width must be between 300-1200px (not ultra-wide banners)
    // - Pixel area must be ≤120k (no large marketing images)
    const isDimensionSignature = 
      img.height <= 220 && 
      aspectRatio >= 3.0 && 
      img.width >= 300 && 
      img.width <= 1200 &&
      pixelArea <= 120000;
    
    const isTextSignature = 
      text.includes('signature') || 
      text.includes('firma') || 
      text.includes('sign');
    
    // Only accept as signature if BOTH dimension AND text match, or dimension criteria is very strict
    const isSignature = (isDimensionSignature && isTextSignature) || 
                        (isDimensionSignature && img.height <= 180);
    
    // For signatures, apply strict filtering
    if (isSignature) {
      if (shortSide >= 120 && pixelArea <= 120000 && isValidPhotoUrl(img.src)) {
        filtered.push({
          url: img.src,
          kind: 'signature',
          width: img.width,
          height: img.height
        });
      }
      continue;
    }
    
    // Smart filtering for regular photos
    
    // 1. Exclude small images (social icons, UI elements) - short side must be >= 350px
    if (shortSide < 350) {
      continue;
    }
    
    // 2. Exclude images with insufficient pixel area (< 200k pixels) - drops icons and small UI elements
    if (pixelArea < 200000) {
      continue;
    }
    
    // 3. Aspect ratio must be within reasonable photo range (0.45 to 1.9)
    // This excludes ultra-wide banners (AR > 2.0) and ultra-tall elements (AR < 0.45)
    if (aspectRatio < 0.45 || aspectRatio > 1.9) {
      continue;
    }
    
    // 4. At least one dimension must be >= 600px (ensures actual photos like 768x1024 pass)
    if (longSide < 600) {
      continue;
    }
    
    // 5. Validate URL is accessible
    if (!isValidPhotoUrl(img.src)) {
      continue;
    }
    
    // Passed all filters - this is a valid delivery photo
    filtered.push({
      url: img.src,
      kind: 'photo',
      width: img.width,
      height: img.height
    });
  }
  
  return filtered;
}

/**
 * Check if URL is a valid, accessible photo URL
 */
function isValidPhotoUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  
  // REJECT data URIs for photos - these should only be HTTP/HTTPS URLs
  // Data URIs are often logos or UI elements that shouldn't be stored as photos
  if (url.startsWith('data:image/')) return false;
  
  // Must be valid HTTP/HTTPS URL
  try {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol;
    
    if (protocol !== 'http:' && protocol !== 'https:') {
      return false;
    }
    
    const hostname = urlObj.hostname;
    const pathLower = urlObj.pathname.toLowerCase();
    
    // REJECT known non-photo sources FIRST
    // 1. OpenStreetMap/Map tiles
    if (hostname.includes('openstreetmap.org') || hostname.includes('tile.osm.org') ||
        hostname.includes('tiles.') || pathLower.includes('/tiles/')) {
      return false;
    }
    
    // 2. Map services
    if (hostname.includes('maps.googleapis.com') || hostname.includes('mapbox.com')) {
      return false;
    }
    
    // 3. Analytics, tracking pixels, beacons
    if (hostname.includes('google-analytics.com') || hostname.includes('googletagmanager.com') ||
        hostname.includes('doubleclick.net') || hostname.includes('facebook.com') ||
        pathLower.includes('/pixel') || pathLower.includes('/beacon') || pathLower.includes('/track')) {
      return false;
    }
    
    // 4. JavaScript, CSS, API endpoints
    if (pathLower.includes('.js') || pathLower.includes('.css') || 
        pathLower.includes('/api/') || pathLower.includes('/v1/') || pathLower.includes('/v2/')) {
      return false;
    }
    
    // 5. Icons and small images (favicon, logo files)
    if (pathLower.includes('favicon') || pathLower.includes('/icon') || pathLower.includes('/logo')) {
      return false;
    }
    
    // ACCEPT legitimate photo sources:
    
    // 1. Azure Blob Storage URLs (real driver photos - HIGHEST PRIORITY)
    if (hostname.includes('blob.core.windows.net')) {
      return true;
    }
    
    // 2. Axylog domain URLs - ACCEPT ALL POTENTIAL IMAGES from Axylog
    // These are the POD photos we want! Be very permissive for Axylog
    if (hostname === 'live.axylog.com' || hostname.endsWith('.axylog.com')) {
      // Reject only known non-image paths
      if (pathLower.includes('.js') || pathLower.includes('.css') || 
          pathLower.includes('/api/') || pathLower.includes('/auth/')) {
        return false;
      }
      
      // Accept any path that could possibly be an image:
      // - Has image-related keywords
      if (pathLower.includes('image') || pathLower.includes('photo') || pathLower.includes('file') ||
          pathLower.includes('attachment') || pathLower.includes('upload') || pathLower.includes('media') ||
          pathLower.includes('download') || pathLower.includes('asset')) {
        return true;
      }
      // - Has an image extension
      if (/\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(urlObj.pathname)) {
        return true;
      }
      // - Has a GUID/hash pattern (common for file storage)
      if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(pathLower) || 
          /[0-9a-f]{32,}/i.test(pathLower)) {
        return true;
      }
      // - Has numeric file ID pattern
      if (/\/\d+/.test(pathLower)) {
        return true;
      }
      // - Any other path that doesn't look like a page/route
      // (Accept paths that don't have common page extensions)
      if (!pathLower.includes('.html') && !pathLower.includes('.htm') && 
          !pathLower.includes('.php') && !pathLower.includes('.aspx')) {
        // If it's from Axylog and doesn't look like a page, assume it could be an image
        return true;
      }
    }
    
    // 3. AWS S3 URLs (common for photo storage)
    if (hostname.includes('s3.amazonaws.com') || hostname.includes('s3-') || 
        hostname.includes('.amazonaws.com')) {
      return true;
    }
    
    // 4. Common image CDNs
    if (hostname.includes('cloudinary.com') || hostname.includes('res.cloudinary.com') ||
        hostname.includes('imgix.net') || hostname.includes('imagekit.io') ||
        hostname.includes('fastly.net') || hostname.includes('cdn.')) {
      // But exclude if it looks like a map or tracking pixel
      if (!pathLower.includes('/tiles/') && !pathLower.includes('/pixel')) {
        return true;
      }
    }
    
    // 5. Google Cloud Storage (but not maps)
    if ((hostname.includes('storage.googleapis.com') || hostname.includes('googleusercontent.com')) &&
        !pathLower.includes('/maps/')) {
      return true;
    }
    
    // 6. Any HTTPS URL with clear image extension (fallback for unknown CDNs)
    // But be more permissive here to catch real photos
    if (protocol === 'https:') {
      const hasImageExtension = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(urlObj.pathname);
      if (hasImageExtension) {
        // Additional check: reject if too small (likely icon/logo)
        // This will be handled by dimension filtering later
        return true;
      }
    }
    
    // Default: Reject unknown URLs
    return false;
    
  } catch {
    return false;
  }
}

/**
 * Additional filtering for already-stored URLs (used by API endpoints)
 * Removes duplicates and ensures only HTTP/HTTPS URLs
 */
export function filterFetchablePhotos(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  
  for (const u of urls) {
    if (!u || typeof u !== 'string') {
      continue;
    }
    
    // REJECT data URIs for photos - these are often logos or UI elements
    // Data URIs should only be used for signatures (handled separately)
    if (u.startsWith('data:image/')) {
      continue; // Skip data URIs entirely
    }
    
    // Check if it's a valid HTTP URL
    try {
      const { protocol, hostname } = new URL(u);
      if (protocol !== 'http:' && protocol !== 'https:') {
        continue;
      }
      
      // Deduplicate
      if (!seen.has(u)) {
        seen.add(u);
        out.push(u);
      }
    } catch (e) {
      continue;
    }
  }
  
  return out;
}
