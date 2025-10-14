#!/usr/bin/env node
import { axylogClient } from '../server/lib/axylog-client.ts';
import { db } from '../server/db.ts';
import { consignments } from '../shared/schema.ts';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildManifest() {
  console.log('🚀 Building photo manifest from Axylog /files API...\n');

  try {
    // Authenticate with Axylog
    const authenticated = await axylogClient.authenticate();
    if (!authenticated) {
      console.error('❌ Failed to authenticate with Axylog');
      process.exit(1);
    }

    // Get recent deliveries from database (last 7 days)
    const recentDeliveries = await db
      .select({
        year: consignments.year,
        code: consignments.code,
        prog: consignments.prog,
        consignmentNo: consignments.consignmentNo,
      })
      .from(consignments)
      .where(eq(consignments.deleted, false))
      .limit(100);

    console.log(`📦 Found ${recentDeliveries.length} recent deliveries\n`);

    const manifest = {};
    let totalPhotos = 0;
    let deliveriesWithPhotos = 0;

    for (const delivery of recentDeliveries) {
      if (!delivery.year || !delivery.code || !delivery.prog) {
        console.log(`⏭️  Skipping delivery with missing year/code/prog`);
        continue;
      }

      const { year, code, prog, consignmentNo } = delivery;
      const key = `${year}-${code}-${prog}`;

      process.stdout.write(`📥 Fetching files for ${key}... `);

      // Get files from Axylog API
      const files = await axylogClient.getFiles(year, code, prog);
      
      // Filter to photos only
      const photos = axylogClient.filterPhotos(files);

      if (photos.length === 0) {
        console.log('No photos');
        continue;
      }

      console.log(`✅ ${photos.length} photos`);

      // Build manifest entry
      const items = photos.map((file, index) => {
        // Normalize file fields to handle different API response formats
        const normalized = axylogClient.normalizeFile(file);
        
        // Construct thumbnail and full image paths
        // Use thumbnailBase64 if available, otherwise construct path
        const thumbPath = normalized.thumbnailBase64
          ? `data:image/jpeg;base64,${normalized.thumbnailBase64}`
          : `/thumbs/${year}/${code}/${prog}/${normalized.filename}.webp`;

        // Construct full image URL
        // If blob URL is available in file.url, use it
        // Otherwise, construct a placeholder that the backend can resolve
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
        consignmentNo: consignmentNo || key,
        items,
      };

      totalPhotos += photos.length;
      deliveriesWithPhotos++;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
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
    console.log(`   - Total deliveries processed: ${recentDeliveries.length}`);
    console.log(`   - Deliveries with photos: ${deliveriesWithPhotos}`);
    console.log(`   - Total photos: ${totalPhotos}`);
    console.log(`   - Manifest saved to: ${manifestPath}`);
    console.log('\n💡 Next steps:');
    console.log('   1. Run "npm run thumbs" to generate WebP thumbnails');
    console.log('   2. Use the Gallery component to display photos');

  } catch (error) {
    console.error('\n❌ Error building manifest:', error);
    process.exit(1);
  }
}

buildManifest();
