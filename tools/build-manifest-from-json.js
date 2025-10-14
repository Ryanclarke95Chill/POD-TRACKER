#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function normalizeFile(file) {
  // Normalize field names from different API formats
  const filename = file.filename || file.fileName || '';
  const extension = file.extension || file.fileExtension || '';
  const url = file.url || file.downloadUrl;
  const thumbnailBase64 = file.thumbnailBase64;
  const tag = file.tag || file.type;

  return {
    filename,
    extension,
    url,
    thumbnailBase64,
    tag,
  };
}

function isPhoto(file) {
  const normalized = normalizeFile(file);
  
  // Check by tag/type
  if (normalized.tag === 'photo' || normalized.tag === 'Delivery outcome image' || normalized.tag === 'Pickup outcome image') {
    return true;
  }
  
  // Check by extension
  const ext = normalized.extension.toLowerCase();
  const photoExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];
  
  if (photoExtensions.includes(ext)) {
    return true;
  }

  // Check filename extension
  const filename = normalized.filename.toLowerCase();
  return photoExtensions.some(e => filename.endsWith(`.${e}`));
}

async function buildManifest() {
  console.log('🚀 Building photo manifest from axylog_files_yesterday.json...\n');

  try {
    // Read the existing files data
    const dataPath = path.join(__dirname, '..', 'axylog_files_yesterday.json');
    const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

    const manifest = {};
    let totalPhotos = 0;
    let deliveriesWithPhotos = 0;

    for (const item of rawData) {
      if (!item.delivery || !item.files) continue;

      const { year, code, prog } = item.delivery;
      const key = `${year}-${code}-${prog}`;

      // Filter to photos only
      const photos = item.files.filter(isPhoto);

      if (photos.length === 0) continue;

      console.log(`📸 ${key}: ${photos.length} photos`);

      // Build manifest entry
      const items = photos.map((file, index) => {
        // Normalize file fields to handle different API response formats
        const normalized = normalizeFile(file);
        
        // Use thumbnailBase64 if available
        const thumbPath = normalized.thumbnailBase64
          ? `data:image/jpeg;base64,${normalized.thumbnailBase64}`
          : `/thumbs/${year}/${code}/${prog}/${normalized.filename}.webp`;

        // Construct full image URL (placeholder - backend would resolve)
        const fullUrl = normalized.url || `/api/photo/${year}/${code}/${prog}/${normalized.filename}.${normalized.extension}`;

        return {
          thumb: thumbPath,
          full: fullUrl,
          filename: normalized.filename,
          extension: normalized.extension,
          tag: normalized.tag,
        };
      });

      manifest[key] = {
        photoCount: photos.length,
        consignmentNo: `${year}-${code}-${prog}`,
        items,
      };

      totalPhotos += photos.length;
      deliveriesWithPhotos++;
    }

    // Ensure public directory exists
    const publicDir = path.join(__dirname, '..', 'public');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Write manifest to public/manifest.json
    const manifestPath = path.join(publicDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    console.log('\n✅ Manifest built successfully!');
    console.log(`📊 Statistics:`);
    console.log(`   - Total deliveries processed: ${rawData.length}`);
    console.log(`   - Deliveries with photos: ${deliveriesWithPhotos}`);
    console.log(`   - Total photos: ${totalPhotos}`);
    console.log(`   - Manifest saved to: ${manifestPath}`);
    console.log('\n💡 Example delivery keys:');
    Object.keys(manifest).slice(0, 3).forEach(key => {
      console.log(`   - ${key} (${manifest[key].photoCount} photos)`);
    });

  } catch (error) {
    console.error('\n❌ Error building manifest:', error);
    process.exit(1);
  }
}

buildManifest();
