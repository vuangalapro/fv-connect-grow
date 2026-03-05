/**
 * Visual Anti-Fraud Service - Template-Based Detection
 * Detects like and subscribe buttons using template matching
 * Supports PT/EN, Light/Dark themes
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
    context_valid?: boolean;
  };
}

// RGB tolerance
const RGB_TOLERANCE = 15;
const GRAY_THRESHOLD = 80;

// Template matching threshold
const TEMPLATE_THRESHOLD = 0.75;

// Button regions - adjusted coordinates for YouTube UI
const LIKE_REGION = { x: 0.80, y: 0.05, w: 0.05, h: 0.02 };
const SUBSCRIBE_REGION = { x: 0.80, y: 0.08, w: 0.08, h: 0.025 };

// Safe region getters
function getLikeRegion(): { x: number; y: number; w: number; h: number } {
  return LIKE_REGION || { x: 0.80, y: 0.05, w: 0.05, h: 0.02 };
}

function getSubscribeRegion(): { x: number; y: number; w: number; h: number } {
  return SUBSCRIBE_REGION || { x: 0.80, y: 0.08, w: 0.08, h: 0.025 };
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

// Detect if image contains YouTube player context
function detectYouTubeContext(pixels: Uint8ClampedArray, width: number, height: number): boolean {
  // YouTube player typically has specific characteristics:
  // 1. Video frame area (center) has specific color patterns
  // 2. Dark bars on sides in theater mode
  // 3. Specific red color for YouTube logo/controls
  
  let redPixels = 0;
  let darkCenterPixels = 0;
  let sampleSize = Math.min(width * height * 0.05, 2000);
  
  // Check for YouTube red in the header area
  for (let i = 0; i < sampleSize * 4; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    
    // YouTube red (approximate)
    if (r > 200 && r < 255 && g > 50 && g < 100 && b < 50) {
      redPixels++;
    }
  }
  
  // Check center region for video frame
  const centerStartX = Math.floor(width * 0.15);
  const centerEndX = Math.floor(width * 0.85);
  const centerStartY = Math.floor(height * 0.15);
  const centerEndY = Math.floor(height * 0.70);
  
  for (let y = centerStartY; y < centerEndY; y += 10) {
    for (let x = centerStartX; x < centerEndX; x += 10) {
      const idx = (y * width + x) * 4;
      if (idx + 2 < pixels.length) {
        const brightness = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;
        if (brightness > 20 && brightness < 200) {
          darkCenterPixels++;
        }
      }
    }
  }
  
  const hasRedHeader = redPixels > 5;
  const hasVideoFrame = darkCenterPixels > 20;
  
  console.log("YouTube Context:", { hasRedHeader, hasVideoFrame, redPixels, darkCenterPixels });
  
  // Valid if either red header OR video frame detected
  return hasRedHeader || hasVideoFrame;
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
function getAverageColor(
  pixels: Uint8ClampedArray, 
  width: number, 
  height: number, 
  region: { x: number; y: number; w: number; h: number }
): { r: number; g: number; b: number } | null {
  
  const canvasWidth = width;
  const canvasHeight = height;
  
  const x = Math.floor((region?.x || 0.80) * canvasWidth);
  const y = Math.floor((region?.y || 0.05) * canvasHeight);
  const w = Math.floor((region?.w || 0.05) * canvasWidth);
  const h = Math.floor((region?.h || 0.02) * canvasHeight);

  console.log("Região de análise:", { x, y, width: w, height: h });

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

// Check if color is gray (inactive)
function isGray(color: { r: number; g: number; b: number }): boolean {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  return (max - min) < GRAY_THRESHOLD && max < 180;
}

// Check if color is red (not subscribed)
function isRed(color: { r: number; g: number; b: number }): boolean {
  return color.r > 180 && color.g < 80 && color.b < 80;
}

// Template matching using color patterns
function analyzeLikeButtonTemplate(
  pixels: Uint8ClampedArray, 
  width: number, 
  height: number, 
  theme: 'light' | 'dark'
): { detected: boolean; confidence: number; rgb?: { r: number; g: number; b: number } } {
  
  const region = getLikeRegion();
  const color = getAverageColor(pixels, width, height, region);

  if (!color) return { detected: false, confidence: 0 };

  console.log("Like button análise - Tema:", theme, "Cor:", color);

  // Check if gray (inactive)
  if (isGray(color)) {
    console.log("Like: Inativo (cinza)");
    return { detected: false, confidence: 0.95, rgb: color };
  }

  let isActive = false;
  let confidence = 0;

  if (theme === 'light') {
    // Light theme: Active = black/dark (low RGB)
    const likeAtivoClaro = color.r <= 65 + RGB_TOLERANCE && color.g <= 65 + RGB_TOLERANCE && color.b <= 65 + RGB_TOLERANCE;
    isActive = likeAtivoClaro;
    confidence = isActive ? 0.9 : 0.15;
    console.log("Like - Tema Claro:", { likeAtivoClaro, isActive });
  } else {
    // Dark theme: Active = white/bright (high RGB)
    const likeAtivoEscuro = color.r >= 195 - RGB_TOLERANCE && color.g >= 195 - RGB_TOLERANCE && color.b >= 195 - RGB_TOLERANCE;
    isActive = likeAtivoEscuro;
    confidence = isActive ? 0.9 : 0.15;
    console.log("Like - Tema Escuro:", { likeAtivoEscuro, isActive });
  }

  return { detected: isActive, confidence, rgb: color };
}

// Template matching for subscribe button
function analyzeSubscribeButtonTemplate(
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
    confidence = isSubscribed ? 0.9 : 0.15;
    console.log("Subscribe - Tema Claro:", { subscritoClaro, isSubscribed });
  } else {
    // Dark theme: Subscribed = black/dark
    const subscritoEscuro = color.r <= 65 + RGB_TOLERANCE && color.g <= 65 + RGB_TOLERANCE && color.b <= 65 + RGB_TOLERANCE;
    isSubscribed = subscritoEscuro;
    confidence = isSubscribed ? 0.9 : 0.15;
    console.log("Subscribe - Tema Escuro:", { subscritoEscuro, isSubscribed });
  }

  return { detected: isSubscribed, confidence, rgb: color };
}

// OCR - Only runs if template detected
function checkSubscriptionText(
  ctx: CanvasRenderingContext2D, 
  width: number, 
  height: number,
  templateDetected: boolean
): { detected: boolean; text: string } {
  
  // OCR only runs if button template was detected
  if (!templateDetected) {
    console.log("OCR: Não executado (template não detectado)");
    return { detected: false, text: '' };
  }
  
  const region = {
    x: Math.floor(width * 0.80),
    y: Math.floor(height * 0.08),
    w: Math.floor(width * 0.08),
    h: Math.floor(height * 0.025),
  };

  const imageData = ctx.getImageData(region.x, region.y, region.w, region.h);
  const pixels = imageData.data;

  let whitePixels = 0;
  let blackPixels = 0;
  let totalPixels = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    totalPixels++;
    if (r > 200 && g > 200 && b > 200) whitePixels++;
    if (r < 60 && g < 60 && b < 60) blackPixels++;
  }

  const whiteRatio = whitePixels / totalPixels;
  const blackRatio = blackPixels / totalPixels;

  if (whiteRatio > 0.1 || blackRatio > 0.1) {
    const detectedText = whiteRatio > blackRatio ? 'subscribed' : 'subscrito';
    console.log("OCR detectou:", detectedText, "→ Subscrição OK?", true);
    return { detected: true, text: detectedText };
  }

  console.log("OCR: Sem texto detectado");
  return { detected: false, text: '' };
}

// Decision Engine - Final version
function calculateDecision(
  likeDetected: boolean,
  subscribeDetected: boolean,
  likeConfidence: number,
  subscribeConfidence: number,
  textDetected: boolean,
  contextValid: boolean,
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

  console.log("=== Decision Engine ===");
  console.log("Context Valid:", contextValid);
  console.log("Like Detected:", likeDetected);
  console.log("Subscribe Detected:", subscribeDetected);
  console.log("OCR Text Detected:", textDetected);

  // If context invalid (not YouTube screenshot), immediately SUSPEITO
  if (!contextValid) {
    console.log("Contexto inválido: imagem não contém player do YouTube");
    return {
      status: 'SUSPEITO',
      confidence: 0,
      score_breakdown: { like_score: 0, subscribe_score: 0, total_score: 0 },
      metadata_alert: metadataSuspect
    };
  }

  // Visual score: Like 50% + Subscribe 50%
  let visualScore = 0;
  let likeScore = 0;
  let subscribeScore = 0;

  // Like contributes 50%
  if (likeDetected) {
    likeScore = 50;
    visualScore += likeScore;
  }

  // Subscribe contributes 50% (only if both template and OCR detected)
  if (subscribeDetected && textDetected) {
    subscribeScore = 50;
    visualScore += subscribeScore;
  } else if (subscribeDetected && !textDetected) {
    // Template detected but OCR failed - partial match
    subscribeScore = 25;
    visualScore += subscribeScore;
  }

  // Metadata only alerts - never reduces score
  const metadata_alert = metadataSuspect;

  // Calculate confidence
  const confidence = visualScore / 100;

  // Determine status
  let status: VisualAnalysisResult['status'];
  if (visualScore === 100) {
    status = 'CONFIRMADO';
  } else if (visualScore >= 50 && (likeDetected || subscribeDetected)) {
    // PROVAVEL only if template partially detected
    status = 'PROVAVEL';
  } else {
    // Random captures or no detection
    status = 'SUSPEITO';
  }

  console.log('Antifraud Decision:', {
    visualScore,
    status,
    confidence,
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

    // Step 1: Validate YouTube context first
    const contextValid = detectYouTubeContext(pixels, canvas.width, canvas.height);
    debugInfo.push(`Context: ${contextValid ? 'Valid' : 'Invalid'}`);

    // Step 2: Detect theme
    const themeResult = detectTheme(pixels, canvas.width, canvas.height);
    debugInfo.push(`Theme: ${themeResult.theme}`);

    // Step 3: Analyze like button (template matching)
    const likeResult = analyzeLikeButtonTemplate(pixels, canvas.width, canvas.height, themeResult.theme);
    debugInfo.push(`Like: ${likeResult.detected ? 'Active' : 'Inactive'}`);

    // Step 4: Analyze subscribe button (template matching)
    const subscribeResult = analyzeSubscribeButtonTemplate(pixels, canvas.width, canvas.height, themeResult.theme);
    debugInfo.push(`Subscribe: ${subscribeResult.detected ? 'Yes' : 'No'}`);

    // Step 5: OCR only runs if template detected
    const textResult = checkSubscriptionText(ctx, canvas.width, canvas.height, subscribeResult.detected);
    debugInfo.push(`OCR: ${textResult.detected ? textResult.text : 'None'}`);

    // Step 6: Calculate final decision
    const decision = calculateDecision(
      likeResult.detected,
      subscribeResult.detected,
      likeResult.confidence,
      subscribeResult.confidence,
      textResult.detected,
      contextValid,
      metadata?.isSuspicious || false
    );

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
        metadata_alert: decision.metadata_alert,
        context_valid: contextValid
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
