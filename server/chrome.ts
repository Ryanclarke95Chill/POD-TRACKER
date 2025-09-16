import { existsSync } from 'fs';

let chromePath: string | null = null;
let chromeCheckPerformed = false;

export function getChromePath(): string {
  if (chromeCheckPerformed && chromePath) {
    return chromePath;
  }

  // Check environment variable first
  if (process.env.PUPPETEER_EXECUTABLE_PATH && existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    chromePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    chromeCheckPerformed = true;
    return chromePath;
  }

  // Probe common Chrome/Chromium locations
  const possiblePaths = [
    '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium', // Nix store path
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser', 
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/opt/google/chrome/chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      chromePath = path;
      chromeCheckPerformed = true;
      console.log(`✅ [CHROME] Found Chrome at: ${chromePath}`);
      return chromePath;
    }
  }

  chromeCheckPerformed = true;
  throw new Error(`❌ [CHROME] No Chrome/Chromium executable found. Tried: ${possiblePaths.join(', ')}. Please install Chrome or set PUPPETEER_EXECUTABLE_PATH environment variable.`);
}

export function isChromeAvailable(): boolean {
  try {
    getChromePath();
    return true;
  } catch {
    return false;
  }
}