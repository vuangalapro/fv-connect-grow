/**
 * Visual Anti-Fraud Service - Calibrated for Accuracy
 * Detects like and subscribe buttons with fuzzy matching
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
    debug_info?: string[];
  };
}

// Increased tolerance for compression artifacts
const RGB_TOLERANCE = 30; // Increased from 10
const GRAY_THRESHOLD = 100;

// Button regions (percentage of image)
const LIKE_REGION = { x: 0.05, y: 0.68, w: 0.14, h: 0.10 };
const SUBSCRIBE_REGION = { x: 0.78, y: 0.68, w: 0.17, h: 0.10 };

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

// Detect theme from background
function detectTheme(pixels: Uint8ClampedArray, width: number, height: number): { theme: 'light' | 'dark'; confidence: number } {
  const sampleSize = Math.min(width * height * 0.1, 5000);
  let darkPixels = 0;
  
  for (let i = 0; i < sampleSize * 4; i += 4) {
    const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
    if (brightness < 80) darkPixels++;
  }
  
  const darkRatio = darkPixels / (sampleSize / 4);
  return darkRatio > 0.4 
    ? { theme: 'dark', confidence: darkRatio }
    : { theme: 'light', confidence: 1 - darkRatio };
}

// Get average color in region
function getAverageColor(pixels: Uint8ClampedArray, width: number, height: number, region: { x: number; y: number; w: number; h: number }): { r: number; g: number; b: number } | null {
  const startX = Math.floor(region.x * width);
  const startY = Math.floor(region.y * height);
  const w = Math.floor(region.w * width);
  const h = Math.floor(region.h * height);
  
  let r = 0, g = 0, b = 0, count = 0;
  
  for (let y = startY; y < startY + h && y < pixels.length / (width * 4); y++) {
    for (let x = startX; x < startX + w && x < width; x++) {
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

// Check if color is gray (inactive like button)
function isGray(color: { r: number; g: number; b: number }): boolean {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  return (max - min) < GRAY_THRESHOLD && max < 180;
}

// Check if color is red (not subscribed)
function isRed(color: { r: number; g: number; b: number }): boolean {
  return color.r > 180 && color.g < 80 && color.b < 80;
}

// Analyze like button with fuzzy matching
function analyzeLikeButton(pixels: Uint8ClampedArray, width: number, height: number, theme: 'light' | 'dark'): { detected: boolean; confidence: number; rgb?: { r: number; g: number; b: number } } {
  const region = LIKE_REGION;
  const color = getAverageColor(pixels, width, height, region);
  
  if (!color) return { detected: false, confidence: 0 };
  
  // Check if button is gray (inactive)
  if (isGray(color)) {
    return { detected: false, confidence: 0.95, rgb: color };
  }
  
  // For light theme: active = black/dark, inactive = gray
  // For dark theme: active = white/bright, inactive = gray
  let isActive = false;
  let confidence = 0;
  
  if (theme === 'light') {
    // Active = dark (low RGB values)
    const brightness = (color.r + color.g + color.b) / 3;
    isActive = brightness < 100;
    confidence = isActive ? 0.95 : 0.1;
  } else {
    // Active = bright (high RGB values)
    const brightness = (color.r + color.g + color.b) / 3;
    isActive = brightness > 150;
    confidence = isActive ? 0.95 : 0.1;
  }
  
  return { detected: isActive, confidence, rgb: color };
}

// Analyze subscribe button with fuzzy matching
function analyzeSubscribeButton(pixels: Uint8ClampedArray, width: number, height: number, theme: 'light' | 'dark'): { detected: boolean; confidence: number; rgb?: { r: number; g: number; b: number } } {
  const region = SUBSCRIBE_REGION;
  const color = getAverageColor(pixels, width, region);
  
  if (!color) return { detected: false, confidence: 0 };
  
  // Check if red (not subscribed)
  if (isRed(color)) {
    return { detected: false, confidence: 0.95, rgb: color };
  }
  
  // For light theme: subscribed = white/bright
  // For dark theme: subscribed = black/dark
  let isSubscribed = false;
  let confidence = 0;
  
  if (theme === 'light') {
    const brightness = (color.r + color.g + color.b) / 3;
    isSubscribed = brightness > 180;
    confidence = isSubscribed ? 0.95 : 0.1;
  } else {
    const brightness = (color.r + color.g + color.b) / 3;
    isSubscribed = brightness < 80;
    confidence = isSubscribed ? 0.95 : 0.1;
  }
  
  return { detected: isSubscribed, confidence, rgb: color };
}

// Check for subscription text (simple pattern matching)
function checkSubscriptionText(ctx: CanvasRenderingContext2D, width: number, height: number): { detected: boolean; text: string } {
  // Check subscribe button region for text
  const region = {
    x: Math.floor(width * 0.75),
    y: Math.floor(height * 0.70),
    w: Math.floor(width * 0.20),
    h: Math.floor(height * 0.08),
  };
  
  // Get pixel data for text detection
  const imageData = ctx.getImageData(region.x, region.y, region.w, region.h);
  const pixels = imageData.data;
  
  // Check for white/black text pixels (high contrast in button region)
  let whitePixels = 0;
  let blackPixels = 0;
  let totalPixels = 0;
  
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    
    totalPixels++;
    // White/bright text
    if (r > 200 && g > 200 && b > 200) whitePixels++;
    // Black/dark text
    if (r < 60 && g < 60 && b < 60) blackPixels++;
  }
  
  // If there's significant contrast, likely has text
  const whiteRatio = whitePixels / totalPixels;
  const blackRatio = blackPixels / totalPixels;
  
  if (whiteRatio > 0.1 || blackRatio > 0.1) {
    return { detected: true, text: whiteRatio > blackRatio ? 'subscribed' : 'subscrito' };
  }
  
  return { detected: false, text: '' };
}

// Decision Engine - Simplified scoring
function calculateDecision(
  likeDetected: boolean,
  subscribeDetected: boolean,
  likeConfidence: number,
  subscribeConfidence: number,
  textDetected: boolean
): { status: VisualAnalysisResult['status']; confidence: number } {
  
  // Start with visual score
  let score = 0;
  const debug: string[] = [];
  
  // Like contributes 40%
  if (likeDetected) {
    score += 40 * likeConfidence;
    debug.push(`Like: ✓ (+${Math.round(40 * likeConfidence)})`);
  } else {
    debug.push(`Like: ✗ (0)`);
  }
  
  // Subscribe contributes 40%
  if (subscribeDetected) {
    score += 40 * subscribeConfidence;
    debug.push(`Subscrito: ✓ (+${Math.round(40 * subscribeConfidence)})`);
  } else {
    debug.push(`Subscrito: ✗ (0)`);
  }
  
  // OCR/text detection adds 20% bonus if visual is positive
  if (textDetected && (likeDetected || subscribeDetected)) {
    score += 20;
    debug.push(`OCR: ✓ (+20)`);
  } else {
    debug.push(`OCR: ✗ (0)`);
  }
  
  // Calculate final confidence
  const confidence = score / 100;
  
  // Determine status
  let status: VisualAnalysisResult['status'];
  if (score >= 70) {
    status = 'CONFIRMADO';
  } else if (score >= 40) {
    status = 'PROVAVEL';
  } else if (score >= 20) {
    // Only SUSPEITO if score is very low
    status = 'SUSPEITO';
  } else {
    status = 'INCONCLUSIVO';
  }
  
  console.log('Antifraud Decision:', { score, status, confidence, debug });
  
  return { status, confidence };
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
  const debugInfo: string[] = [];
  
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
    
    // Test canvas accessibility
    try {
      ctx.getImageData(0, 0, 1, 1);
    } catch (e) {
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
          error_message: 'Canvas não acessível',
          debug_info: debugInfo,
        },
      };
    }
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    // 1. Detect theme
    const themeResult = detectTheme(pixels, canvas.width, canvas.height);
    const theme = themeResult.theme;
    debugInfo.push(`Tema: ${theme}`);
    
    // 2. Analyze like button
    const likeResult = analyzeLikeButton(pixels, canvas.width, canvas.height, theme);
    debugInfo.push(`Like: ${likeResult.detected ? 'Ativo' : 'Inativo'} (RGB: ${likeResult.rgb?.r},${likeResult.rgb?.g},${likeResult.rgb?.b})`);
    
    // 3. Analyze subscribe button
    const subscribeResult = analyzeSubscribeButton(pixels, canvas.width, canvas.height, theme);
    debugInfo.push(`Subscrito: ${subscribeResult.detected ? 'Sim' : 'Não'} (RGB: ${subscribeResult.rgb?.r},${subscribeResult.rgb?.g},${subscribeResult.rgb?.b})`);
    
    // 4. Check for text (OCR alternative)
    const textResult = checkSubscriptionText(ctx, canvas.width, canvas.height);
    debugInfo.push(`Texto detectado: ${textResult.detected ? textResult.text : 'Não'}`);
    
    // 5. Decision Engine
    const decision = calculateDecision(
      likeResult.detected,
      subscribeResult.detected,
      likeResult.confidence,
      subscribeResult.confidence,
      textResult.detected
    );
    
    return {
      status: decision.status,
      like_detected: likeResult.detected,
      subscribe_detected: subscribeResult.detected || textResult.detected,
      theme_detected: theme,
      language_detected: textResult.text.includes('subscribed') ? 'en' : 'pt',
      confidence: decision.confidence,
      details: {
        like_confidence: likeResult.confidence,
        subscribe_confidence: subscribeResult.confidence,
        theme_confidence: themeResult.confidence,
        ocr_text: textResult.text,
        ocr_subscrito_detected: textResult.detected,
        like_rgb: likeResult.rgb,
        subscribe_rgb: subscribeResult.rgb,
        debug_info: debugInfo,
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
        debug_info: debugInfo,
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
      return '⚠️ PROVÁVEL - Possível válido';
    case 'INCONCLUSIVO':
      return '❓ INCONCLUSIVO - Falha técnica';
    case 'SUSPEITO':
      return '🚨 SUSPEITO - Possível fraude';
    default:
      return 'Desconhecido';
  }
}
