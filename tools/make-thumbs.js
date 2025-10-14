#!/usr/bin/env node
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const THUMB_SIZE = 360;
const THUMB_QUALITY = 70;

async function generateThumbnails() {
  console.log('📸 Generating WebP thumbnails...\n');

  const publicDir = path.join(__dirname, '..', 'public');
  const photosDir = path.join(publicDir, 'photos');
  const thumbsDir = path.join(publicDir, 'thumbs');

  // Check if photos directory exists
  if (!fs.existsSync(photosDir)) {
    console.log('⚠️  Photos directory not found at:', photosDir);
    console.log('💡 Thumbnails will be generated from base64 data in manifest instead');
    return;
  }

  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Process all photos in subdirectories (year/code/prog structure)
  async function processDirectory(dir, relativePath = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        await processDirectory(fullPath, relPath);
      } else if (entry.isFile()) {
        // Only process image files
        const ext = path.extname(entry.name).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext)) {
          continue;
        }

        // Construct output path
        const thumbOutputDir = path.join(thumbsDir, path.dirname(relPath));
        const thumbOutputPath = path.join(
          thumbOutputDir,
          path.basename(entry.name, ext) + '.webp'
        );

        // Skip if thumbnail already exists
        if (fs.existsSync(thumbOutputPath)) {
          skippedCount++;
          continue;
        }

        // Create output directory if it doesn't exist
        if (!fs.existsSync(thumbOutputDir)) {
          fs.mkdirSync(thumbOutputDir, { recursive: true });
        }

        try {
          // Generate WebP thumbnail with Sharp
          await sharp(fullPath)
            .rotate() // Auto-rotate based on EXIF
            .resize(THUMB_SIZE, THUMB_SIZE, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .webp({ quality: THUMB_QUALITY })
            .toFile(thumbOutputPath);

          processedCount++;
          if (processedCount % 10 === 0) {
            process.stdout.write(`\r✅ Processed: ${processedCount}`);
          }
        } catch (error) {
          console.error(`\n❌ Error processing ${relPath}:`, error.message);
          errorCount++;
        }
      }
    }
  }

  await processDirectory(photosDir);

  console.log(`\n\n✅ Thumbnail generation complete!`);
  console.log(`📊 Statistics:`);
  console.log(`   - Thumbnails created: ${processedCount}`);
  console.log(`   - Skipped (already exist): ${skippedCount}`);
  console.log(`   - Errors: ${errorCount}`);
  console.log(`   - Output directory: ${thumbsDir}`);
  
  if (processedCount === 0 && skippedCount === 0) {
    console.log('\n💡 No photos found to process.');
    console.log('   Thumbnails will be served from base64 data in manifest.json');
  }
}

generateThumbnails().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
