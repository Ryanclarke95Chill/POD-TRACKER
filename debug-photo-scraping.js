#!/usr/bin/env node
// Debug script to test photo scraping functionality
import puppeteer from 'puppeteer';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Use the same browser args as the main app
function getSecureBrowserArgs() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isNixOS = process.env.NIX_PATH || process.env.nixPkgs || process.env.REPLIT_ENVIRONMENT;
  
  const baseArgs = [
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-default-apps',
    '--disable-features=VizDisplayCompositor',
    '--disable-plugins',
    '--disable-sync',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--max_old_space_size=1024',
    '--disable-background-networking'
  ];
  
  if (isNixOS) {
    console.log('🔧 [ENVIRONMENT] NixOS detected - using --no-sandbox due to SUID sandbox configuration restrictions');
    baseArgs.push('--no-sandbox', '--disable-setuid-sandbox');
  } else if (isDevelopment && process.env.PUPPETEER_SKIP_SANDBOX === 'true') {
    console.warn('⚠️ [SECURITY WARNING] Running Chromium without sandbox in development mode');
    baseArgs.push('--no-sandbox', '--disable-setuid-sandbox');
  } else {
    console.log('✅ [SECURITY] Running Chromium with sandbox enabled');
    baseArgs.push('--disable-web-security');
  }
  
  return baseArgs;
}

// Test tracking URLs - using valid tokens from production tests
const TEST_TOKENS = [
  '5UxuxKWlsEGalB7Gm0',  // Valid token from performance test
  'i4lTOEkio3WfaS0kbg',  // Valid token from production
  'dwmbFZPnw3E44Ncure', // Valid token from production
  'SiKxrrUjRUD4SCnLAX'   // Valid token from production
];

// Function to test HTML parsing approach
async function testHTMLParsing(token) {
  console.log(`\n🌐 [HTML DEBUG] Testing HTML parsing for token: ${token}`);
  const trackingUrl = `https://live.axylog.com/${token}`;
  
  try {
    console.log(`📡 Making HTTP request to: ${trackingUrl}`);
    const startTime = Date.now();
    
    const response = await axios.get(trackingUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    const fetchTime = Date.now() - startTime;
    console.log(`✅ HTTP request completed in ${fetchTime}ms`);
    console.log(`📊 Response status: ${response.status}`);
    console.log(`📄 Content length: ${response.data?.length || 0} characters`);
    console.log(`📋 Content type: ${response.headers['content-type']}`);
    
    // Log first 500 chars of HTML to see what we got
    const htmlPreview = response.data.substring(0, 500);
    console.log(`🔍 HTML Preview:\n${htmlPreview}...`);
    
    // Check if it's an Angular SPA
    const isAngular = htmlPreview.includes('ng-') || htmlPreview.includes('angular') || htmlPreview.includes('app-root');
    console.log(`🎯 Is Angular SPA: ${isAngular}`);
    
    // Parse with cheerio
    const $ = cheerio.load(response.data);
    console.log(`📝 DOM loaded with cheerio`);
    
    // Count various elements
    const totalImages = $('img').length;
    const totalDivs = $('div').length;
    const totalScripts = $('script').length;
    console.log(`📊 Elements found - Images: ${totalImages}, Divs: ${totalDivs}, Scripts: ${totalScripts}`);
    
    // Look for specific patterns
    const axylogImages = $('img[src*="axylogdata.blob.core.windows.net"]').length;
    const base64Images = $('img[src^="data:image"]').length;
    console.log(`🎯 Specific images - Axylog blob: ${axylogImages}, Base64: ${base64Images}`);
    
    // Extract all img src attributes
    const allImageSrcs = [];
    $('img').each((index, element) => {
      const src = $(element).attr('src');
      if (src) {
        allImageSrcs.push(src);
      }
    });
    
    console.log(`📋 All image sources found (${allImageSrcs.length}):`);
    allImageSrcs.forEach((src, index) => {
      console.log(`  ${index + 1}. ${src}`);
    });
    
    return {
      success: true,
      isAngular,
      totalImages,
      axylogImages,
      base64Images,
      allImageSrcs
    };
    
  } catch (error) {
    console.error(`❌ HTML parsing failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// Function to test Puppeteer approach with detailed logging
async function testPuppeteerParsing(token) {
  console.log(`\n🤖 [PUPPETEER DEBUG] Testing Puppeteer for token: ${token}`);
  const trackingUrl = `https://live.axylog.com/${token}`;
  
  let browser = null;
  let page = null;
  
  try {
    console.log(`🚀 Launching browser...`);
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      protocolTimeout: 30000,
      args: getSecureBrowserArgs()
    });
    
    page = await browser.newPage();
    console.log(`📄 Created new page`);
    
    // Set up request interception for debugging - Allow Angular JS to load
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      const url = req.url();
      
      console.log(`📡 Request: ${resourceType} - ${url.substring(0, 80)}...`);
      
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        
        const isAxylogDomain = hostname === 'live.axylog.com' || hostname.endsWith('.axylog.com');
        const isDocumentRequest = resourceType === 'document';
        const isAngularScript = resourceType === 'script' && isAxylogDomain && (
          url.includes('main.') || 
          url.includes('polyfills.') || 
          url.includes('runtime.')
        );
        const isRequiredExternal = resourceType === 'script' && (
          url.includes('moment') ||
          url.includes('axios') ||
          url.includes('jquery') ||
          url.includes('signalr')
        );
        
        // Allow API calls to axylog domains for photo data
        const isAxylogAPI = (resourceType === 'xhr' || resourceType === 'fetch') && isAxylogDomain;
        
        // Allow images from any axylog domain or blob storage
        const isPhotoResource = resourceType === 'image' && (
          isAxylogDomain || 
          hostname.includes('axylogdata.blob.core.windows.net') ||
          hostname.includes('blob.core.windows.net')
        );
        
        // Allow CSS for proper rendering
        const isRequiredCSS = resourceType === 'stylesheet' && isAxylogDomain;
        
        if (isDocumentRequest && isAxylogDomain) {
          console.log(`✅ Allowing document request to: ${hostname}`);
          req.continue();
        } else if (isAngularScript) {
          console.log(`✅ Allowing Angular script: ${url.substring(0, 50)}...`);
          req.continue();
        } else if (isRequiredExternal) {
          console.log(`✅ Allowing required external script: ${url.substring(0, 50)}...`);
          req.continue();
        } else if (isAxylogAPI) {
          console.log(`✅ Allowing API request: ${url.substring(0, 50)}...`);
          req.continue();
        } else if (isPhotoResource) {
          console.log(`✅ Allowing photo resource: ${url.substring(0, 50)}...`);
          req.continue();
        } else if (isRequiredCSS) {
          console.log(`✅ Allowing CSS: ${url.substring(0, 50)}...`);
          req.continue();
        } else {
          console.log(`🚫 Blocking ${resourceType} to: ${hostname}`);
          req.abort();
        }
      } catch (error) {
        console.log(`🚫 Aborting invalid URL: ${url}`);
        req.abort();
      }
    });
    
    // Set up console logging
    page.on('console', msg => {
      console.log(`🌍 [PAGE CONSOLE] ${msg.type()}: ${msg.text()}`);
    });
    
    // Set up error logging
    page.on('error', err => {
      console.error(`❌ [PAGE ERROR] ${err.message}`);
    });
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.setViewport({ width: 1280, height: 720 });
    
    console.log(`🌍 Navigating to: ${trackingUrl}`);
    const navigationStart = Date.now();
    
    await page.goto(trackingUrl, { 
      waitUntil: 'networkidle0',
      timeout: 15000
    });
    
    const navigationTime = Date.now() - navigationStart;
    console.log(`✅ Navigation completed in ${navigationTime}ms`);
    
    // Wait for body to appear
    console.log(`⏳ Waiting for body element...`);
    await page.waitForSelector('body', { timeout: 5000 });
    console.log(`✅ Body element found`);
    
    // Check page title and URL
    const title = await page.title();
    const currentUrl = page.url();
    console.log(`📋 Page title: "${title}"`);
    console.log(`🔗 Current URL: ${currentUrl}`);
    
    // Wait longer for Angular to load and make API calls
    console.log(`⏳ Waiting 5 seconds for Angular to load and fetch data...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Try to detect if Angular loaded
    const hasAngularElements = await page.evaluate(() => {
      const appRoot = document.querySelector('app-root');
      const ngElements = document.querySelectorAll('[class*="ng-"], [data-ng*=""], .ng-scope');
      const angularScripts = document.querySelectorAll('script[src*="angular"], script[src*="main.js"], script[src*="polyfills.js"]');
      return {
        ngElements: ngElements.length,
        angularScripts: angularScripts.length,
        hasAppRoot: !!appRoot
      };
    });
    console.log(`🎯 Angular detection:`, hasAngularElements);
    
    // Wait for images specifically
    console.log(`⏳ Waiting for images to load...`);
    try {
      await page.waitForFunction(() => {
        const images = Array.from(document.querySelectorAll('img'));
        console.log('Found ' + images.length + ' img elements');
        
        // Log first few image sources
        images.slice(0, 5).forEach((img, index) => {
          console.log('Image ' + (index + 1) + ': ' + img.src);
        });
        
        const axylogImages = images.some(img => 
          img.src.includes('axylogdata.blob.core.windows.net') || 
          img.src.startsWith('data:image')
        );
        
        console.log('Has axylog/base64 images: ' + axylogImages);
        return axylogImages;
      }, { timeout: 10000 });
      console.log(`✅ Images loaded successfully`);
    } catch (e) {
      console.log(`⚠️ No specific images found within timeout, but proceeding...`);
    }
    
    // Extract all images with detailed info
    console.log(`🔍 Extracting all images...`);
    const imageData = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img'));
      console.log('Found ' + images.length + ' total img elements');
      
      return images.map((img, index) => {
        const rect = img.getBoundingClientRect();
        const imgData = {
          index: index + 1,
          src: img.src,
          alt: img.alt || '',
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          className: img.className,
          isVisible: rect.width > 0 && rect.height > 0,
          parentText: img.parentElement?.textContent?.substring(0, 100) || '',
          rectWidth: rect.width,
          rectHeight: rect.height
        };
        
        console.log('Image ' + (index + 1) + ': ' + imgData.src + ' (' + imgData.width + 'x' + imgData.height + ') visible:' + imgData.isVisible);
        return imgData;
      });
    });
    
    console.log(`📊 Found ${imageData.length} images total:`);
    imageData.forEach(img => {
      console.log(`  ${img.index}. ${img.src} (${img.width}x${img.height}) ${img.isVisible ? '✅' : '❌'}`);
    });
    
    // Filter images according to current logic
    const filteredImages = imageData.filter(img => {
      const isAxylogImage = img.src && img.src.includes('axylogdata.blob.core.windows.net');
      const isBase64Image = img.src && img.src.startsWith('data:image');
      
      if (isAxylogImage || isBase64Image) {
        return true;
      }
      
      const isValidPhoto = img.src && 
             img.src.startsWith('http') && 
             img.width > 100 &&
             img.height > 100;
             
      const isNotUIElement = !img.src.includes('logo') &&
             !img.src.includes('icon') &&
             !img.src.includes('avatar') &&
             !img.className.includes('logo') &&
             !img.className.includes('icon');
             
      const isNotMap = !img.src.toLowerCase().includes('map') &&
             !img.src.toLowerCase().includes('tile') &&
             !img.src.toLowerCase().includes('geographic');
             
      return isValidPhoto && isNotUIElement && isNotMap;
    });
    
    console.log(`🎯 After filtering: ${filteredImages.length} valid images`);
    
    // Take a screenshot for debugging
    console.log(`📸 Taking screenshot for debugging...`);
    await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
    console.log(`✅ Screenshot saved as debug-screenshot.png`);
    
    return {
      success: true,
      totalImages: imageData.length,
      filteredImages: filteredImages.length,
      images: filteredImages
    };
    
  } catch (error) {
    console.error(`❌ Puppeteer failed: ${error.message}`);
    
    // Take error screenshot if possible
    if (page && !page.isClosed()) {
      try {
        await page.screenshot({ path: 'debug-error-screenshot.png', fullPage: true });
        console.log(`📸 Error screenshot saved as debug-error-screenshot.png`);
      } catch (screenshotError) {
        console.log(`❌ Could not take error screenshot: ${screenshotError.message}`);
      }
    }
    
    return {
      success: false,
      error: error.message
    };
  } finally {
    if (page && !page.isClosed()) {
      await page.close();
    }
    if (browser) {
      await browser.close();
    }
  }
}

// Main test function
async function runTests() {
  console.log('🚀 [PHOTO DEBUG] Starting comprehensive photo scraping debug tests...');
  console.log('=' .repeat(80));
  
  for (const token of TEST_TOKENS) {
    console.log(`\n🔍 [TESTING TOKEN] ${token}`);
    console.log('=' .repeat(50));
    
    // Test HTML parsing first
    const htmlResult = await testHTMLParsing(token);
    
    // Test Puppeteer parsing  
    const puppeteerResult = await testPuppeteerParsing(token);
    
    // Summary
    console.log(`\n📊 [SUMMARY FOR ${token}]`);
    console.log(`HTML Parsing: ${htmlResult.success ? '✅' : '❌'}`);
    console.log(`Puppeteer: ${puppeteerResult.success ? '✅' : '❌'}`);
    
    if (htmlResult.success) {
      console.log(`HTML found ${htmlResult.totalImages} total images`);
    }
    
    if (puppeteerResult.success) {
      console.log(`Puppeteer found ${puppeteerResult.totalImages} total, ${puppeteerResult.filteredImages} filtered`);
    }
  }
  
  console.log('\n🏁 [DEBUG COMPLETE]');
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});