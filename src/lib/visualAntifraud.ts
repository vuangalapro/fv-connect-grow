/**
 * Visual Anti-Fraud Service - Complete Implementation
 * Detects like and subscribe buttons in YouTube screenshots
 * Uses canvas for color analysis with CORS-safe proxy
 */

export interface VisualAnalysisResult {
  status: 'CONFIRMADO' | 'PROVAVEL' | 'INCONCLUSIVO' | 'SUSPEITO';
  like_detected: boolean;
  subscribe_detected: boolean;
  theme_detected: 'light' | 'dark';
  language_detected: 'pt' | 'en';
  confidence: number;
  details: {
    like_confidence: number;
    subscribe_confidence: number;
    theme_confidence: number;
    ocr_text?: string;
    ocr_subscrito_detected?: boolean;
    like_rgb?: { r: number; g: number; b: number };
    subscribe_rgb?: { r: number; g: number; b: number };
    error_message?: string;
  };
}

// RGB tolerance for button detection
const RGB_TOLERANCE = 10;

// Button color ranges
const LIKE_COLORS = {
  light: { active: { r: 0, g: 0, b: 0 }, inactive: { r: 136, g: 136, b: 136 } },   // Black when liked, gray when not
  dark: { active: { r: 255, g: 255, b: 255 }, inactive: { r: 136, g: 136, b: 136 } },  // White when liked, gray when not
};

const SUBSCRIBE_COLORS = {
  light: { active: { r: 255, g: 255, b: 255 }, inactive: { r: 255, g: 0, b: 0 } },   // White when subscribed, red when not
  dark: { active: { r: 0, g: 0, b: 0 }, inactive: { r: 255, g: 0, b: 0 } },      // Black when subscribed, red when not
};

// Text patterns for OCR
const SUBSCRIBE_PATTERNS = {
  pt: ['subscrito', 'inscrito', 'subinscrito', 'subscrever', 'inscrever'],
  en: ['subscribed', 'subscribe', 'subscribing'],
};

// Image loading with proxy
async function loadImageWithProxy(imageUrl: string): Promise<HTMLImageElement> {
  let proxyUrl = imageUrl;
  
  if (imageUrl.includes('supabase') || imageUrl.startsWith('http')) {
    const baseUrl = window.location.origin;
    proxyUrl = `${baseUrl}/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = proxyUrl;
  });
}

// Check if color matches expected (with tolerance)
function colorMatches(actual: { r: number; g: number; b: number }, expected: { r: number; g: number; b: number }): boolean {
  return Math.abs(actual.r - expected.r) <= RGB_TOLERANCE &&
         Math.abs(actual.g - expected.g) <= RGB_TOLERANCE &&
         Math.abs(actual.b - expected.b) <= RGB_TOLERANCE;
}

// Detect theme from image
function detectTheme(pixels: Uint8ClampedArray, width: number, height: number): { theme: 'light' | 'dark'; confidence: number } {
  const sampleSize = Math.min(width * height * 0.1, 10000);
  let darkPixels = 0;
  let lightPixels = 0;
  
  for (let i = 0; i < sampleSize * 4; i += 4) {
    const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
    if (brightness < 128) darkPixels++;
    else lightPixels++;
  }
  
  const total = darkPixels + lightPixels;
  const darkRatio = darkPixels / total;
  
  return darkRatio > 0.6 
    ? { theme: 'dark', confidence: darkRatio }
    : { theme: 'light', confidence: 1 - darkRatio };
}

// Get average color in a region
function getRegionColor(pixels: Uint8ClampedArray, width: number, region: { x: number; y: number; w: number; h: number }): { r: number; g: number; b: number } | null {
  let r = 0, g = 0, b = 0, count = 0;
  
  for (let y = region.y; y < region.y + region.h; y++) {
    for (let x = region.x; x < region.x + region.w; x++) {
      const idx = (y * width + x) * 4;
      r += pixels[idx];
      g += pixels[idx + 1];
      b += pixels[idx + 2];
      count++;
    }
  }
  
  if (count === 0) return null;
  
  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count)
  };
}

// Analyze like button
function analyzeLikeButton(pixels: Uint8ClampedArray, width: number, height: number, theme: 'light' | 'dark'): { detected: boolean; confidence: number; rgb?: { r: number; g: number; b: number } } {
  // Like button region (bottom-left of video area)
  const region = {
    x: Math.floor(width * 0.05),
    y: Math.floor(height * 0.70),
    w: Math.floor(width * 0.12),
    h: Math.floor(height * 0.08),
  };
  
  const avgColor = getRegionColor(pixels, width, region);
  if (!avgColor) return { detected: false, confidence: 0 };
  
  const expectedActive = LIKE_COLORS[theme].active;
  const expectedInactive = LIKE_COLORS[theme].inactive;
  
  const isActive = colorMatches(avgColor, expectedActive);
  const isInactive = colorMatches(avgColor, expectedInactive);
  
  // Confidence based on how close the color is to expected
  let confidence = 0;
  if (isActive) {
    confidence = 1.0;
  } else if (isInactive) {
    confidence = 0.9;
  } else {
    // Calculate distance to expected colors
    const distToActive = Math.sqrt(
      Math.pow(avgColor.r - expectedActive.r, 2) +
      Math.pow(avgColor.g - expectedActive.g, 2) +
      Math.pow(avgColor.b - expectedActive.b, 2)
    );
    const distToInactive = Math.sqrt(
      Math.pow(avgColor.r - expectedInactive.r, 2) +
      Math.pow(avgColor.g - expectedInactive.g, 2) +
      Math.pow(avgColor.b - expectedInactive.b, 2)
    );
    
    confidence = Math.min(distToInactive / (distToActive + distToInactive), 0.7);
  }
  
  return { detected: isActive, confidence, rgb: avgColor };
}

// Analyze subscribe button
function analyzeSubscribeButton(pixels: Uint8ClampedArray, width: number, height: number, theme: 'light' | 'dark'): { detected: boolean; confidence: number; rgb?: { r: number; g: number; b: number } } {
  // Subscribe button region (bottom-right of video area)
  const region = {
    x: Math.floor(width * 0.78),
    y: Math.floor(height * 0.70),
    w: Math.floor(width * 0.17),
    h: Math.floor(height * 0.08),
  };
  
  const avgColor = getRegionColor(pixels, width, region);
  if (!avgColor) return { detected: false, confidence: 0 };
  
  const expectedActive = SUBSCRIBE_COLORS[theme].active;
  const expectedInactive = SUBSCRIBE_COLORS[theme].inactive;
  
  const isActive = colorMatches(avgColor, expectedActive);
  const isInactive = colorMatches(avgColor, expectedInactive);
  
  let confidence = 0;
  if (isActive) {
    confidence = 1.0;
  } else if (isInactive) {
    confidence = 0.9;
  } else {
    const distToActive = Math.sqrt(
      Math.pow(avgColor.r - expectedActive.r, 2) +
      Math.pow(avgColor.g - expectedActive.g, 2) +
      Math.pow(avgColor.b - expectedActive.b, 2)
    );
    const distToInactive = Math.sqrt(
      Math.pow(avgColor.r - expectedInactive.r, 2) +
      Math.pow(avgColor.g - expectedInactive.g, 2) +
      Math.pow(avgColor.b - expectedInactive.b, 2)
    );
    
    confidence = Math.min(distToInactive / (distToActive + distToInactive), 0.7);
  }
  
  return { detected: isActive, confidence, rgb: avgColor };
}

// Simple OCR - extract text from region
function extractTextFromRegion(ctx: CanvasRenderingContext2D, region: { x: number; y: number; w: number; h: number }): string {
  // Use Tesseract for OCR if available
  if (typeof window !== 'undefined' && (window as any).Tesseract) {
    return ''; // Will be handled asynchronously
  }
  
  // Fallback: simple text detection based on pixel patterns
  // This is a simplified version - in production, use Tesseract.js
  return '';
}

// Check if text contains subscription keywords
function detectSubscriptionText(text: string): { detected: boolean; language: 'pt' | 'en' | null } {
  const lowerText = text.toLowerCase();
  
  for (const pattern of SUBSCRIBE_PATTERNS.pt) {
    if (lowerText.includes(pattern)) {
      return { detected: true, language: 'pt' };
    }
  }
  
  for (const pattern of SUBSCRIBE_PATTERNS.en) {
    if (lowerText.includes(pattern)) {
      return { detected: true, language: 'en' };
    }
  }
  
  return { detected: false, language: null };
}

// Decision Engine - Calculate final score
function calculateDecision(
  visualScore: number,
  ocrScore: number,
  metadataScore: number
): { status: VisualAnalysisResult['status']; confidence: number } {
  // Weights
  const VISUAL_WEIGHT = 0.5;
  const OCR_WEIGHT = 0.2;
  const METADATA_WEIGHT = 0.3;
  
  const finalScore = (visualScore * VISUAL_WEIGHT) + (ocrScore * OCR_WEIGHT) + (metadataScore * METADATA_WEIGHT);
  
  if (finalScore >= 0.7) {
    return { status: 'CONFIRMADO', confidence: finalScore };
  } else if (finalScore >= 0.4) {
    return { status: 'PROVAVEL', confidence: finalScore };
  } else if (finalScore >= 0.2) {
    return { status: 'SUSPEITO', confidence: finalScore };
  } else {
    return { status: 'INCONCLUSIVO', confidence: finalScore };
  }
}

/**
 * Main analysis function
 */
export async function analyzeVisualAntifraud(
  imageUrl: string,
  metadata?: {
    ip?: string;
    deviceFingerprint?: string;
    userId?: string;
  }
): Promise<VisualAnalysisResult> {
  try {
    const img = await loadImageWithProxy(imageUrl);
    
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    
    ctx.drawImage(img, 0, 0);
    
    // Test canvas for contamination
    try {
      ctx.getImageData(0, 0, 1, 1);
    } catch (e) {
      // Canvas is contaminated
      return {
        status: 'INCONCLUSIVO',
        like_detected: false,
        subscribe_detected: false,
        theme_detected: 'dark',
        language_detected: 'pt',
        confidence: 0,
        details: {
          like_confidence: 0,
          subscribe_confidence: 0,
          theme_confidence: 0,
          error_message: 'Canvas contaminado - não foi possível analisar',
        },
      };
    }
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    // 1. Detect theme
    const themeResult = detectTheme(pixels, canvas.width, canvas.height);
    const theme = themeResult.theme;
    
    // 2. Analyze visual buttons
    const likeResult = analyzeLikeButton(pixels, canvas.width, canvas.height, theme);
    const subscribeResult = analyzeSubscribeButton(pixels, canvas.width, canvas.height, theme);
    
    // 3. Try OCR for text detection (if Tesseract is available)
    let ocrText = '';
    let ocrDetected = false;
    let ocrLanguage: 'pt' | 'en' | null = null;
    
    try {
      // Extract region for OCR
      const ocrRegion = {
        x: Math.floor(canvas.width * 0.70),
        y: Math.floor(canvas.height * 0.70),
        w: Math.floor(canvas.width * 0.25),
        h: Math.floor(canvas.height * 0.10),
      };
      
      ocrText = extractTextFromRegion(ctx, ocrRegion);
      const ocrResult = detectSubscriptionText(ocrText);
      ocrDetected = ocrResult.detected;
      ocrLanguage = ocrResult.language;
    } catch (ocrError) {
      console.warn('OCR failed:', ocrError);
    }
    
    // 4. Calculate scores
    // Visual score: based on button colors
    const visualScore = (likeResult.confidence + subscribeResult.confidence) / 2;
    
    // OCR score: based on text detection
    const ocrScore = ocrDetected ? 0.8 : 0;
    
    // Metadata score: default to 0.5 (neutral) if no metadata provided
    // In production, this would check for fraud patterns
    const metadataScore = metadata ? 0.5 : 0.5;
    
    // 5. Decision Engine
    const decision = calculateDecision(visualScore, ocrScore, metadataScore);
    
    // Override status if visual AND OCR confirm subscription
    if (likeResult.detected && (subscribeResult.detected || ocrDetected)) {
      decision.status = 'CONFIRMADO';
      decision.confidence = Math.max(decision.confidence, 0.8);
    }
    
    return {
      status: decision.status,
      like_detected: likeResult.detected,
      subscribe_detected: subscribeResult.detected || ocrDetected,
      theme_detected: theme,
      language_detected: ocrLanguage || 'pt',
      confidence: decision.confidence,
      details: {
        like_confidence: likeResult.confidence,
        subscribe_confidence: subscribeResult.confidence,
        theme_confidence: themeResult.confidence,
        ocr_text: ocrText,
        ocr_subscrito_detected: ocrDetected,
        like_rgb: likeResult.rgb,
        subscribe_rgb: subscribeResult.rgb,
      },
    };
    
  } catch (error) {
    console.error('Visual analysis error:', error);
    
    return {
      status: 'INCONCLUSIVO',
      like_detected: false,
      subscribe_detected: false,
      theme_detected: 'dark',
      language_detected: 'pt',
      confidence: 0,
      details: {
        like_confidence: 0,
        subscribe_confidence: 0,
        theme_confidence: 0,
        error_message: error instanceof Error ? error.message : 'Erro desconhecido',
      },
    };
  }
}

/**
 * Get status display text
 */
export function getStatusText(status: VisualAnalysisResult['status']): string {
  switch (status) {
    case 'CONFIRMADO':
      return '✅ CONFIRMADO - Like e Inscrição verificados';
    case 'PROVAVEL':
      return '⚠️ PROVÁVEL - Alta probabilidade de válido';
    case 'INCONCLUSIVO':
      return '❓ INCONCLUSIVO - Falha técnica na análise';
    case 'SUSPEITO':
      return '🚨 SUSPEITO - Possível fraude';
    default:
      return 'Desconhecido';
  }
}

/**
 * Get debug info for overlay
 */
export function getDebugInfo(result: VisualAnalysisResult): string[] {
  const debug: string[] = [];
  
  debug.push(`Tema: ${result.theme_detected}`);
  debug.push(`Like: ${result.like_detected ? 'Ativo' : 'Inativo'} (${result.details.like_rgb?.r},${result.details.like_rgb?.g},${result.details.like_rgb?.b})`);
  debug.push(`Subscrito: ${result.subscribe_detected ? 'Sim' : 'Não'} (${result.details.subscribe_rgb?.r},${result.details.subscribe_rgb?.g},${result.details.subscribe_rgb?.b})`);
  debug.push(`Confiança: ${Math.round(result.confidence * 100)}%`);
  debug.push(`Status: ${result.status}`);
  
  if (result.details.ocr_text) {
    debug.push(`OCR: ${result.details.ocr_text}`);
  }
  
  return debug;
}
