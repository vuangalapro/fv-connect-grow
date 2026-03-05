/**
 * Visual Anti-Fraud Service - Final Calibration
 * Detects like and subscribe buttons (PT/EN, Light/Dark theme)
 * Metadata only alerts, never reduces score
 */

// Status type
export type FraudStatus = 'CONFIRMADO' | 'PROVAVEL' | 'INCONCLUSIVO' | 'SUSPEITO';

export interface VisualAnalysisResult {
  status: FraudStatus;
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
    score_breakdown?: {
      like_score: number;
      subscribe_score: number;
      total_score: number;
    };
    metadata_alert?: boolean;
  };
}

// RGB tolerance for compression artifacts (±15)
const RGB_TOLERANCE = 15;
const GRAY_THRESHOLD = 80;

// Safe button regions (percentage of canvas - relative coordinates)
// Like button: left area (5% from left, 68% from top)
const LIKE_REGION = { x: 0.05, y: 0.68, w: 0.14, h: 0.10 };
// Subscribe button: right area (78% from left, 68% from top)
const SUBSCRIBE_REGION = { x: 0.78, y: 0.68, w: 0.17, h: 0.10 };

// Safe region getter with fallback
function getLikeRegion(): { x: number; y: number; w: number; h: number } {
  return LIKE_REGION || { x: 0.05, y: 0.68, w: 0.14, h: 0.10 };
}

function getSubscribeRegion(): { x: number; y: number; w: number; h: number } {
  return SUBSCRIBE_REGION || { x: 0.78, y: 0.68, w: 0.17, h: 0.10 };
}

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

// Detect theme from background - improved
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

// Get average color in region with safe bounds
function getAverageColor(
  pixels: Uint8ClampedArray, 
  width: number, 
  height: number, 
  region: { x: number; y: number; w: number; h: number }
): { r: number; g: number; b: number } | null {
  
  // Safe bounds calculation
  const canvasWidth = width;
  const canvasHeight = height;
  
  // Calculate actual coordinates with safe fallback
  const x = Math.floor((region?.x || 0.05) * canvasWidth);
  const y = Math.floor((region?.y || 0.68) * canvasHeight);
  const w = Math.floor((region?.w || 0.14) * canvasWidth);
  const h = Math.floor((region?.h || 0.10) * canvasHeight);

  console.log("Região de análise:", { x, y, width: w, height: h, canvasWidth, canvasHeight });

  let r = 0, g = 0, b = 0, count = 0;

  for (let py = y; py < y + h && py < height; py++) {
    for (let px = x; px < x + w && px < width; px++) {
      const idx = (py * width + px) * 4;
      if (idx + 2 < pixels.length) {
        r += pixels[idx];
        g += pixels[idx + 1];
        b += pixels[idx + 2];
        count++;
      }
    }
  }

  if (count === 0) return null;

  const avgR = Math.round(r / count);
  const avgG = Math.round(g / count);
  const avgB = Math.round(b / count);

  console.log("Cor média:", { r: avgR, g: avgG, b: avgB });

  return { r: avgR, g: avgG, b: avgB };
}

// Check if color is within tolerance of target
function isColorMatch(color: { r: number; g: number; b: number }, target: { r: number; g: number; b: number }): boolean {
  return (
    Math.abs(color.r - target.r) <= RGB_TOLERANCE &&
    Math.abs(color.g - target.g) <= RGB_TOLERANCE &&
    Math.abs(color.b - target.b) <= RGB_TOLERANCE
  );
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

// Analyze like button - Simplified detection
function analyzeLikeButton(
  pixels: Uint8ClampedArray, 
  width: number, 
  height: number, 
  theme: 'light' | 'dark'
): { detected: boolean; confidence: number; rgb?: { r: number; g: number; b: number } } {
  
  const region = getLikeRegion();
  const color = getAverageColor(pixels, width, height, region);

  if (!color) return { detected: false, confidence: 0 };

  console.log("Like button análise - Tema:", theme, "Cor:", color);

  // Check if button is gray (inactive)
  if (isGray(color)) {
    console.log("Like: Inativo (cinza)");
    return { detected: false, confidence: 0.95, rgb: color };
  }

  let isActive = false;
  let confidence = 0;

  if (theme === 'light') {
    // Light theme: Active = black/dark (low RGB values)
    const likeAtivoClaro = color.r <= 65 + RGB_TOLERANCE && color.g <= 65 + RGB_TOLERANCE && color.b <= 65 + RGB_TOLERANCE;
    
    isActive = likeAtivoClaro;
    confidence = isActive ? 0.95 : 0.15;
    
    console.log("Like - Tema Claro:", { likeAtivoClaro, isActive });
  } else {
    // Dark theme: Active = white/bright (high RGB values)
    const likeAtivoEscuro = color.r >= 195 - RGB_TOLERANCE && color.g >= 195 - RGB_TOLERANCE && color.b >= 195 - RGB_TOLERANCE;
    
    isActive = likeAtivoEscuro;
    confidence = isActive ? 0.95 : 0.15;
    
    console.log("Like - Tema Escuro:", { likeAtivoEscuro, isActive });
  }

  return { detected: isActive, confidence, rgb: color };
}

// Analyze subscribe button - Simplified detection
function analyzeSubscribeButton(
  pixels: Uint8ClampedArray, 
  width: number, 
  height: number, 
  theme: 'light' | 'dark'
): { detected: boolean; confidence: number; rgb?: { r: number; g: number; b: number } } {
  
  const region = getSubscribeRegion();
  const color = getAverageColor(pixels, width, height, region);

  if (!color) return { detected: false, confidence: 0 };

  console.log("Subscribe button análise - Tema:", theme, "Cor:", color);

  // Check if red (not subscribed)
  if (isRed(color)) {
    console.log("Subscribe: Não inscrito (vermelho)");
    return { detected: false, confidence: 0.95, rgb: color };
  }

  let isSubscribed = false;
  let confidence = 0;

  if (theme === 'light') {
    // Light theme: Subscribed = white/bright
    const subscritoClaro = color.r >= 195 - RGB_TOLERANCE && color.g >= 195 - RGB_TOLERANCE && color.b >= 195 - RGB_TOLERANCE;
    
    isSubscribed = subscritoClaro;
    confidence = isSubscribed ? 0.95 : 0.15;
    
    console.log("Subscribe - Tema Claro:", { subscritoClaro, isSubscribed });
  } else {
    // Dark theme: Subscribed = black/dark
    const subscritoEscuro = color.r <= 65 + RGB_TOLERANCE && color.g <= 65 + RGB_TOLERANCE && color.b <= 65 + RGB_TOLERANCE;
    
    isSubscribed = subscritoEscuro;
    confidence = isSubscribed ? 0.95 : 0.15;
    
    console.log("Subscribe - Tema Escuro:", { subscritoEscuro, isSubscribed });
  }

  return { detected: isSubscribed, confidence, rgb: color };
}

// Check for subscription text - Simple OCR
function checkSubscriptionText(
  ctx: CanvasRenderingContext2D, 
  width: number, 
  height: number
): { detected: boolean; text: string } {
  
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
    // White/bright text (subscribed)
    if (r > 200 && g > 200 && b > 200) whitePixels++;
    // Black/dark text (subscribed in dark mode)
    if (r < 60 && g < 60 && b < 60) blackPixels++;
  }

  // If there's significant contrast, likely has text
  const whiteRatio = whitePixels / totalPixels;
  const blackRatio = blackPixels / totalPixels;

  // Detect language based on text presence
  if (whiteRatio > 0.1 || blackRatio > 0.1) {
    // For light theme: white text = subscribed
    // For dark theme: black text = subscribed
    const detectedText = whiteRatio > blackRatio ? 'subscribed' : 'subscrito';
    console.log("OCR detectou:", detectedText, "→ Subscrição OK?", true);
    return { detected: true, text: detectedText };
  }

  console.log("OCR: Sem texto detectado");
  return { detected: false, text: '' };
}

// Decision Engine - FINAL VERSION
// Metadata only alerts, never reduces score
function calculateDecision(
  likeDetected: boolean,
  subscribeDetected: boolean,
  likeConfidence: number,
  subscribeConfidence: number,
  textDetected: boolean,
  metadataSuspect: boolean = false
): { 
  status: VisualAnalysisResult['status']; 
  confidence: number; 
  score_breakdown: { 
    like_score: number; 
    subscribe_score: number; 
    total_score: number 
  };
  metadata_alert: boolean;
} {

  // Visual score: Like 50% + Subscribe 50%
  let visualScore = 0;
  const debug: string[] = [];

  // Like contributes 50%
  let likeScore = 0;
  if (likeDetected) {
    likeScore = 50;
    visualScore += likeScore;
    debug.push(`Like: ✓ (+50)`);
  } else {
    debug.push(`Like: ✗ (0)`);
  }

  // Subscribe contributes 50%
  let subscribeScore = 0;
  if (subscribeDetected) {
    subscribeScore = 50;
    visualScore += subscribeScore;
    debug.push(`Subscribe: ✓ (+50)`);
  } else {
    debug.push(`Subscribe: ✗ (0)`);
  }

  // OCR bonus (only adds confidence, never reduces)
  if (textDetected && (likeDetected || subscribeDetected)) {
    debug.push(`OCR: ✓ (+bonus)`);
  }

  // Metadata only alerts - does NOT reduce score
  const metadata_alert = metadataSuspect;

  // Calculate final confidence
  const confidence = visualScore / 100;

  // Determine status
  // 100% = CONFIRMADO, ≥70% = PROVÁVEL, <70% = SUSPEITO
  let status: VisualAnalysisResult['status'];
  if (visualScore === 100) {
    status = 'CONFIRMADO';
  } else if (visualScore >= 70) {
    status = 'PROVAVEL';
  } else {
    status = 'SUSPEITO';
  }

  console.log('Antifraud Decision:', {
    visualScore,
    status,
    confidence,
    debug,
    metadata_alert,
    score_breakdown: { like_score: likeScore, subscribe_score: subscribeScore, total_score: visualScore }
  });

  return {
    status,
    confidence,
    score_breakdown: { like_score: likeScore, subscribe_score: subscribeScore, total_score: visualScore },
    metadata_alert
  };
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
    isSuspicious?: boolean;
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
      throw new Error('Canvas context not available');
    }

    ctx.drawImage(img, 0, 0);

    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    // Step 1: Detect theme
    const themeResult = detectTheme(pixels, canvas.width, canvas.height);
    debugInfo.push(`Theme: ${themeResult.theme} (confidence: ${themeResult.confidence.toFixed(2)})`);

    // Step 2: Analyze like button
    const likeResult = analyzeLikeButton(pixels, canvas.width, canvas.height, themeResult.theme);
    debugInfo.push(`Like: ${likeResult.detected ? 'Active' : 'Inactive'} (confidence: ${likeResult.confidence.toFixed(2)})`);

    // Step 3: Analyze subscribe button
    const subscribeResult = analyzeSubscribeButton(pixels, canvas.width, canvas.height, themeResult.theme);
    debugInfo.push(`Subscribe: ${subscribeResult.detected ? 'Yes' : 'No'} (confidence: ${subscribeResult.confidence.toFixed(2)})`);

    // Step 4: Check for text
    const textResult = checkSubscriptionText(ctx, canvas.width, canvas.height);
    debugInfo.push(`Text: ${textResult.detected ? textResult.text : 'None'}`);

    // Step 5: Calculate final decision (metadata only alerts, never reduces score)
    const decision = calculateDecision(
      likeResult.detected,
      subscribeResult.detected,
      likeResult.confidence,
      subscribeResult.confidence,
      textResult.detected,
      metadata?.isSuspicious || false
    );

    // Detect language from text
    const languageDetected = textResult.text.toLowerCase().includes('subscrito') ? 'pt' : 'en';

    return {
      status: decision.status,
      like_detected: likeResult.detected,
      subscribe_detected: subscribeResult.detected,
      theme_detected: themeResult.theme,
      language_detected: languageDetected,
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
        score_breakdown: decision.score_breakdown,
        metadata_alert: decision.metadata_alert
      }
    };

  } catch (error) {
    console.error('Visual Analysis Error:', error);
    return {
      status: 'INCONCLUSIVO',
      like_detected: false,
      subscribe_detected: false,
      theme_detected: 'light',
      language_detected: 'en',
      confidence: 0,
      details: {
        like_confidence: 0,
        subscribe_confidence: 0,
        theme_confidence: 0,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        debug_info: debugInfo
      }
    };
  }
}
