/**
 * YouTube Visual Analysis Service
 * Detects if an affiliate has liked and subscribed to YouTube videos
 * Uses template matching, OCR, and color detection
 */

import Tesseract from 'tesseract.js';

export interface VisualAnalysisResult {
  like_detected: boolean;
  subscribe_detected: boolean;
  theme_detected: 'light' | 'dark';
  language_detected: 'pt' | 'en';
  confidence: number;
  roi: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  timestamp: string;
  details: {
    like_confidence: number;
    subscribe_confidence: number;
    theme_confidence: number;
    language_confidence: number;
    average_button_color: string;
    roi_text_found: string;
  };
}

export interface AuditLog {
  id?: string;
  task_id?: string;
  user_id?: string;
  analysis_result: VisualAnalysisResult;
  created_at: string;
}

// Supported languages for detection
const LANGUAGE_PATTERNS = {
  pt: {
    subscribed: ['subscrever', 'subscrito', 'inscrever', 'inscrito', 'subscreva'],
    like: ['curtir', 'curtido', 'gosto', 'like'],
  },
  en: {
    subscribed: ['subscribe', 'subscribed', 'subscribing'],
    like: ['like', 'liked'],
  },
};

// YouTube button colors by theme
const BUTTON_COLORS = {
  light: {
    like_active: { r: 0, g: 0, b: 0 },      // Black when liked
    like_inactive: { r: 136, g: 136, b: 136 }, // Gray when not liked
    subscribe_active: { r: 255, g: 255, b: 255 }, // White when subscribed
    subscribe_inactive: { r: 255, g: 0, b: 0 },   // Red when not subscribed
  },
  dark: {
    like_active: { r: 255, g: 255, b: 255 },   // White when liked
    like_inactive: { r: 136, g: 136, b: 136 }, // Gray when not liked
    subscribe_active: { r: 0, g: 0, b: 0 },    // Black when subscribed
    subscribe_inactive: { r: 255, g: 0, b: 0 }, // Red when not subscribed
  },
};

/**
 * Analyze YouTube screenshot for like and subscribe status
 * @param imageData - Base64 image data
 * @param options - Analysis options
 * @returns Visual analysis result
 */
export async function analyzeYouTubeScreenshot(
  imageData: string,
  options?: {
    taskId?: string;
    userId?: string;
  }
): Promise<VisualAnalysisResult> {
  const startTime = Date.now();
  
  try {
    // Step 1: Preprocess image and detect theme
    const imageAnalysis = await preprocessImage(imageData);
    
    // Step 2: Define ROI (Region of Interest) for buttons
    // YouTube buttons are typically below the video player
    const roi = {
      x: Math.floor(imageAnalysis.width * 0.1),
      y: Math.floor(imageAnalysis.height * 0.35),
      width: Math.floor(imageAnalysis.width * 0.8),
      height: Math.floor(imageAnalysis.height * 0.15),
    };
    
    // Step 3: Detect theme
    const themeResult = detectTheme(imageAnalysis.pixels, imageAnalysis.width, imageAnalysis.height);
    
    // Step 4: Detect colors in button regions
    const buttonAnalysis = analyzeButtonColors(
      imageAnalysis.pixels,
      imageAnalysis.width,
      imageAnalysis.height,
      themeResult.theme
    );
    
    // Step 5: Perform OCR on ROI
    const ocrResult = await performButtonOCR(imageData, roi);
    
    // Step 6: Detect language from OCR text
    const languageResult = detectLanguage(ocrResult.text);
    
    // Step 7: Calculate confidence scores
    const likeConfidence = calculateLikeConfidence(buttonAnalysis, ocrResult.text, languageResult.language);
    const subscribeConfidence = calculateSubscribeConfidence(buttonAnalysis, ocrResult.text, languageResult.language);
    
    // Step 8: Calculate overall confidence
    const overallConfidence = (likeConfidence + subscribeConfidence + themeResult.confidence + languageResult.confidence) / 4;
    
    const result: VisualAnalysisResult = {
      like_detected: likeConfidence > 0.5,
      subscribe_detected: subscribeConfidence > 0.5,
      theme_detected: themeResult.theme,
      language_detected: languageResult.language,
      confidence: overallConfidence,
      roi,
      timestamp: new Date().toISOString(),
      details: {
        like_confidence: likeConfidence,
        subscribe_confidence: subscribeConfidence,
        theme_confidence: themeResult.confidence,
        language_confidence: languageResult.confidence,
        average_button_color: buttonAnalysis.averageColor,
        roi_text_found: ocrResult.text.substring(0, 200),
      },
    };
    
    console.log('Visual Analysis Result:', result);
    
    return result;
  } catch (error) {
    console.error('Visual Analysis Error:', error);
    
    // Return default result on error
    return {
      like_detected: false,
      subscribe_detected: false,
      theme_detected: 'dark',
      language_detected: 'en',
      confidence: 0,
      roi: { x: 0, y: 0, width: 0, height: 0 },
      timestamp: new Date().toISOString(),
      details: {
        like_confidence: 0,
        subscribe_confidence: 0,
        theme_confidence: 0,
        language_confidence: 0,
        average_button_color: '#000000',
        roi_text_found: '',
      },
    };
  }
}

/**
 * Preprocess image and extract pixel data
 */
async function preprocessImage(imageData: string): Promise<{
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      // Resize for faster processing (max 1280px width)
      const maxWidth = 1280;
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      resolve({
        pixels: imageDataObj.data,
        width: canvas.width,
        height: canvas.height,
      });
    };
    img.onerror = reject;
    img.src = imageData;
  });
}

/**
 * Detect YouTube theme (light or dark)
 */
function detectTheme(pixels: Uint8ClampedArray, width: number, height: number): {
  theme: 'light' | 'dark';
  confidence: number;
} {
  // Sample from top portion of image (header area)
  const sampleSize = 1000;
  let totalBrightness = 0;
  let sampleCount = 0;
  
  for (let i = 0; i < Math.min(sampleSize, width * height); i++) {
    const idx = i * 4;
    const brightness = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;
    totalBrightness += brightness;
    sampleCount++;
  }
  
  const averageBrightness = totalBrightness / sampleCount;
  
  // Dark theme typically has average brightness < 128
  const isDark = averageBrightness < 128;
  const confidence = Math.abs((averageBrightness / 255) - 0.5) * 2;
  
  return {
    theme: isDark ? 'dark' : 'light',
    confidence: Math.max(0.5, confidence),
  };
}

/**
 * Analyze button colors in the ROI
 */
function analyzeButtonColors(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  theme: 'light' | 'dark'
): {
  averageColor: string;
  likeActive: boolean;
  subscribeActive: boolean;
  likeConfidence: number;
  subscribeConfidence: number;
} {
  // Sample from button area (right side of video)
  const buttonAreaX = Math.floor(width * 0.7);
  const buttonAreaY = Math.floor(height * 0.35);
  const buttonAreaWidth = Math.floor(width * 0.25);
  const buttonAreaHeight = Math.floor(height * 0.12);
  
  let totalR = 0, totalG = 0, totalB = 0, pixelCount = 0;
  
  for (let y = buttonAreaY; y < buttonAreaY + buttonAreaHeight && y < height; y++) {
    for (let x = buttonAreaX; x < buttonAreaX + buttonAreaWidth && x < width; x++) {
      const idx = (y * width + x) * 4;
      totalR += pixels[idx];
      totalG += pixels[idx + 1];
      totalB += pixels[idx + 2];
      pixelCount++;
    }
  }
  
  const avgR = Math.floor(totalR / pixelCount);
  const avgG = Math.floor(totalG / pixelCount);
  const avgB = Math.floor(totalB / pixelCount);
  
  const averageColor = `rgb(${avgR}, ${avgG}, ${avgB})`;
  
  // Check if colors match active button colors
  const themeColors = BUTTON_COLORS[theme];
  
  // Simple color distance check
  const likeDistance = Math.sqrt(
    Math.pow(avgR - (theme === 'dark' ? 255 : 0), 2) +
    Math.pow(avgG - (theme === 'dark' ? 255 : 0), 2) +
    Math.pow(avgB - (theme === 'dark' ? 255 : 0), 2)
  );
  
  const subscribeDistance = Math.sqrt(
    Math.pow(avgR - (theme === 'dark' ? 0 : 255), 2) +
    Math.pow(avgG - (theme === 'dark' ? 0 : 255), 2) +
    Math.pow(avgB - (theme === 'dark' ? 0 : 255), 2)
  );
  
  const maxDistance = Math.sqrt(3 * Math.pow(255, 2));
  
  const likeConfidence = 1 - (likeDistance / maxDistance);
  const subscribeConfidence = 1 - (subscribeDistance / maxDistance);
  
  return {
    averageColor,
    likeActive: likeConfidence > 0.6,
    subscribeActive: subscribeConfidence > 0.6,
    likeConfidence,
    subscribeConfidence,
  };
}

/**
 * Perform OCR on button region
 */
async function performButtonOCR(
  imageData: string,
  roi: { x: number; y: number; width: number; height: number }
): Promise<{ text: string; confidence: number }> {
  try {
    // First, crop the image to ROI
    const croppedData = await cropImageToROI(imageData, roi);
    
    // Then perform OCR
    const result = await Tesseract.recognize(croppedData, 'eng+por', {
      logger: () => {},
    });
    
    return {
      text: result.data.text.toLowerCase(),
      confidence: result.data.confidence / 100,
    };
  } catch (error) {
    console.error('OCR Error:', error);
    return { text: '', confidence: 0 };
  }
}

/**
 * Crop image to ROI
 */
async function cropImageToROI(
  imageData: string,
  roi: { x: number; y: number; width: number; height: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      canvas.width = roi.width;
      canvas.height = roi.height;
      
      ctx.drawImage(img, roi.x, roi.y, roi.width, roi.height, 0, 0, roi.width, roi.height);
      
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = imageData;
  });
}

/**
 * Detect language from OCR text
 */
function detectLanguage(text: string): {
  language: 'pt' | 'en';
  confidence: number;
} {
  const lowerText = text.toLowerCase();
  
  let ptScore = 0;
  let enScore = 0;
  
  // Check Portuguese patterns
  for (const pattern of LANGUAGE_PATTERNS.pt.subscribed) {
    if (lowerText.includes(pattern)) ptScore += 1;
  }
  for (const pattern of LANGUAGE_PATTERNS.pt.like) {
    if (lowerText.includes(pattern)) ptScore += 1;
  }
  
  // Check English patterns
  for (const pattern of LANGUAGE_PATTERNS.en.subscribed) {
    if (lowerText.includes(pattern)) enScore += 1;
  }
  for (const pattern of LANGUAGE_PATTERNS.en.like) {
    if (lowerText.includes(pattern)) enScore += 1;
  }
  
  const totalScore = ptScore + enScore;
  
  if (totalScore === 0) {
    return { language: 'en', confidence: 0.5 };
  }
  
  return {
    language: ptScore >= enScore ? 'pt' : 'en',
    confidence: Math.max(0.5, (ptScore >= enScore ? ptScore : enScore) / totalScore),
  };
}

/**
 * Calculate like confidence based on color and OCR
 */
function calculateLikeConfidence(
  buttonAnalysis: ReturnType<typeof analyzeButtonColors>,
  ocrText: string,
  language: 'pt' | 'en'
): number {
  let confidence = buttonAnalysis.likeConfidence;
  
  // Boost confidence if "liked" text is found
  const likePatterns = language === 'pt' 
    ? ['curtido', 'gosto', 'liked']
    : ['liked', 'like'];
  
  for (const pattern of likePatterns) {
    if (ocrText.includes(pattern)) {
      confidence += 0.3;
      break;
    }
  }
  
  return Math.min(1, confidence);
}

/**
 * Calculate subscribe confidence based on color and OCR
 */
function calculateSubscribeConfidence(
  buttonAnalysis: ReturnType<typeof analyzeButtonColors>,
  ocrText: string,
  language: 'pt' | 'en'
): number {
  let confidence = buttonAnalysis.subscribeConfidence;
  
  // Boost confidence if "subscribed" text is found
  const subscribePatterns = language === 'pt'
    ? ['subscrito', 'inscrito', 'subscreva', 'subscrever']
    : ['subscribed', 'subscribe', 'subscribing'];
  
  for (const pattern of subscribePatterns) {
    if (ocrText.includes(pattern)) {
      confidence += 0.3;
      break;
    }
  }
  
  return Math.min(1, confidence);
}

/**
 * Save analysis result to database for audit
 */
export async function saveAnalysisToAudit(
  result: VisualAnalysisResult,
  options?: {
    taskId?: string;
    userId?: string;
  }
): Promise<void> {
  try {
    const { supabase } = await import('@/lib/supabase');
    
    await supabase.from('visual_analysis_audit').insert({
      task_id: options?.taskId || null,
      user_id: options?.userId || null,
      like_detected: result.like_detected,
      subscribe_detected: result.subscribe_detected,
      theme_detected: result.theme_detected,
      language_detected: result.language_detected,
      confidence: result.confidence,
      roi: JSON.stringify(result.roi),
      details: JSON.stringify(result.details),
      created_at: result.timestamp,
    });
    
    console.log('Analysis saved to audit log');
  } catch (error) {
    console.error('Failed to save analysis to audit:', error);
  }
}
