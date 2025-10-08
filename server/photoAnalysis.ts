import OpenAI from "openai";
import axios from "axios";

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is not set. Please configure it to use photo analysis features.');
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

export interface PhotoAnalysisResult {
  clarity: {
    score: number; // 0-10 scale
    isBlurry: boolean;
    hasGoodLighting: boolean;
    isLegible: boolean;
  };
  ocr: {
    hasTemperatureDisplay: boolean;
    temperatureReadings: string[];
    hasShippingLabel: boolean;
    labelText: string[];
    hasBarcode: boolean;
  };
  overall: {
    qualityScore: number; // 0-15 points for POD scoring
    issues: string[];
    recommendations: string[];
  };
}

export class PhotoAnalysisService {
  private async downloadImageAsBase64(imageUrl: string): Promise<string> {
    try {
      // Security: Only allow images from trusted axylogdata.blob.core.windows.net domain
      const allowedDomain = 'axylogdata.blob.core.windows.net';
      const url = new URL(imageUrl);
      
      if (url.hostname !== allowedDomain) {
        throw new Error(`Image URL not from allowed domain: ${url.hostname}`);
      }
      
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 10000
      });
      
      const base64 = Buffer.from(response.data, 'binary').toString('base64');
      return base64;
    } catch (error) {
      throw new Error(`Failed to download image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzePhoto(imageUrl: string): Promise<PhotoAnalysisResult> {
    try {
      const base64Image = await this.downloadImageAsBase64(imageUrl);
      const client = getOpenAIClient();
      
      const response = await client.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
        messages: [
          {
            role: "system",
            content: `You are an expert photo quality analyst for delivery proof-of-delivery images. Analyze the image for:

1. CLARITY ASSESSMENT:
   - Overall sharpness/blur level (0-10 scale)
   - Lighting quality (good/poor)
   - Text legibility

2. OCR ANALYSIS:
   - Temperature displays/thermometers (extract any temperature readings)
   - Shipping labels/delivery notes (extract visible text)
   - Barcodes/QR codes presence

3. QUALITY SCORING:
   - Rate photo quality for delivery documentation (0-15 points)
   - Identify specific issues
   - Provide improvement recommendations

Return results in JSON format matching this structure:
{
  "clarity": {
    "score": number,
    "isBlurry": boolean,
    "hasGoodLighting": boolean,
    "isLegible": boolean
  },
  "ocr": {
    "hasTemperatureDisplay": boolean,
    "temperatureReadings": string[],
    "hasShippingLabel": boolean,
    "labelText": string[],
    "hasBarcode": boolean
  },
  "overall": {
    "qualityScore": number,
    "issues": string[],
    "recommendations": string[]
  }
}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this delivery photo for quality and extract any visible text or temperature readings."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 1000,
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      // Validate and sanitize the response
      return {
        clarity: {
          score: Math.max(0, Math.min(10, result.clarity?.score || 0)),
          isBlurry: Boolean(result.clarity?.isBlurry),
          hasGoodLighting: Boolean(result.clarity?.hasGoodLighting),
          isLegible: Boolean(result.clarity?.isLegible)
        },
        ocr: {
          hasTemperatureDisplay: Boolean(result.ocr?.hasTemperatureDisplay),
          temperatureReadings: Array.isArray(result.ocr?.temperatureReadings) ? result.ocr.temperatureReadings : [],
          hasShippingLabel: Boolean(result.ocr?.hasShippingLabel),
          labelText: Array.isArray(result.ocr?.labelText) ? result.ocr.labelText : [],
          hasBarcode: Boolean(result.ocr?.hasBarcode)
        },
        overall: {
          qualityScore: Math.max(0, Math.min(15, result.overall?.qualityScore || 0)),
          issues: Array.isArray(result.overall?.issues) ? result.overall.issues : [],
          recommendations: Array.isArray(result.overall?.recommendations) ? result.overall.recommendations : []
        }
      };
      
    } catch (error) {
      console.error('Photo analysis failed:', error);
      
      // Return default/fallback result
      return {
        clarity: {
          score: 0,
          isBlurry: true,
          hasGoodLighting: false,
          isLegible: false
        },
        ocr: {
          hasTemperatureDisplay: false,
          temperatureReadings: [],
          hasShippingLabel: false,
          labelText: [],
          hasBarcode: false
        },
        overall: {
          qualityScore: 0,
          issues: [`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
          recommendations: ['Retake photo with better lighting and focus']
        }
      };
    }
  }

  async analyzeMultiplePhotos(imageUrls: string[]): Promise<PhotoAnalysisResult[]> {
    const results = await Promise.allSettled(
      imageUrls.map(url => this.analyzePhoto(url))
    );
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`Failed to analyze photo ${index}:`, result.reason);
        return {
          clarity: { score: 0, isBlurry: true, hasGoodLighting: false, isLegible: false },
          ocr: { hasTemperatureDisplay: false, temperatureReadings: [], hasShippingLabel: false, labelText: [], hasBarcode: false },
          overall: { qualityScore: 0, issues: ['Analysis failed'], recommendations: ['Retake photo'] }
        };
      }
    });
  }
}

export const photoAnalysisService = new PhotoAnalysisService();