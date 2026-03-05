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

// Template matching threshold (65% - more tolerant)
const TEMPLATE_THRESHOLD = 0.65;

// Button regions - adjusted coordinates for YouTube UI
const LIKE_REGION = { x: 0.80, y: 0.05, w: 0.05, h: 0.02 };
const SUBSCRIBE_REGION = { x: 0.80, y: 0.08, w: 0.08, h: 0.025 };

// Cached templates
let loadedTemplates: {
  like: { light: HTMLImageElement | null; dark: HTMLImageElement | null };
  subscribe: { light: HTMLImageElement | null; dark: HTMLImageElement | null };
} | null = null;

// Safe region getters
function getLikeRegion(): { x: number; y: number; w: number; h: number } {
  return LIKE_REGION || { x: 0.80, y: 0.05, w: 0.05, h: 0.02 };
}

function getSubscribeRegion(): { x: number; y: number; w: number; h: number } {
  return SUBSCRIBE_REGION || { x: 0.80, y: 0.08, w: 0.08, h: 0.025 };
}

// Load template images
async function loadTemplate(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn(`Failed to load template: ${url}`);
      resolve(null);
    };
    img.src = url;
  });
}

// Load all templates
async function loadTemplates(): Promise<void> {
  if (loadedTemplates) return;
  
  const baseUrl = window.location.origin;
  
  const [likeLight, likeDark, subsLight, subsDark] = await Promise.all([
    loadTemplate(`${baseUrl}/templates/like_template_light.png`),
    loadTemplate(`${baseUrl}/templates/like_template_dark.png`),
    loadTemplate(`${baseUrl}/templates/subscrito_template_light.png`),
    loadTemplate(`${baseUrl}/templates/subscrito_template_dark.png`)
  ]);
  
  loadedTemplates = {
    like: { light: likeLight, dark: likeDark },
    subscribe: { light: subsLight, dark: subsDark }
  };
  
  console.log("Templates loaded:", {
    likeLight: !!likeLight,
    likeDark: !!likeDark,
    subsLight: !!subsLight,
    subsDark: !!subsDark
  });
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

// Simple template matching - compare pixels
function compareImages(
  img1Data: ImageData,
  img2: HTMLImageElement,
  threshold: number = 0.85
): number {
  // Create canvas for template
  const canvas = document.createElement('canvas');
  canvas.width = img2.width;
  canvas.height = img2.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  
  ctx.drawImage(img2, 0, 0);
  const img2Data = ctx.getImageData(0, 0, img2.width, img2.height);
  
  // Calculate similarity
  const width = Math.min(img1Data.width, img2.width);
  const height = Math.min(img1Data.height, img2.height);
  
  let matchingPixels = 0;
  let totalPixels = 0;
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx1 = (y * img1Data.width + x) * 4;
      const idx2 = (y * img2.width + x) * 4;
      
      const r1 = img1Data.data[idx1];
      const g1 = img1Data.data[idx1 + 1];
      const b1 = img1Data.data[idx1 + 2];
      
      const r2 = img2Data.data[idx2];
      const g2 = img2Data.data[idx2 + 1];
      const b2 = img2Data.data[idx2 + 2];
      
      // Calculate color distance
      const distance = Math.sqrt(
        Math.pow(r1 - r2, 2) +
        Math.pow(g1 - g2, 2) +
        Math.pow(b1 - b2, 2)
      );
      
      // If colors are similar (within tolerance)
      if (distance < 50) {
        matchingPixels++;
      }
      totalPixels++;
    }
  }
  
  return totalPixels > 0 ? matchingPixels / totalPixels : 0;
}

// Detect if image contains YouTube player context
function detectYouTubeContext(pixels: Uint8ClampedArray, width: number, height: number): boolean {
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

// Template matching for like button
function analyzeLikeButton(
  pixels: Uint8ClampedArray, 
  width: number, 
  height: number, 
  theme: 'light' | 'dark',
  ctx: CanvasRenderingContext2D
): { detected: boolean; confidence: number; rgb?: { r: number; g: number; b: number } } {
  
  const region = getLikeRegion();
  const x = Math.floor(region.x * width);
  const y = Math.floor(region.y * height);
  const w = Math.floor(region.w * width);
  const h = Math.floor(region.h * height);
  
  // Get image data from region
  const regionData = ctx.getImageData(x, y, w, h);
  const color = getAverageColor(pixels, width, height, region);

  if (!color) return { detected: false, confidence: 0 };

  console.log("Like button análise - Tema:", theme, "Cor:", color);

  // Check if gray (inactive)
  if (isGray(color)) {
    console.log("Like: Inativo (cinza)");
    return { detected: false, confidence: 0.95, rgb: color };
  }

  // Try template matching if templates are loaded
  if (loadedTemplates) {
    const template = theme === 'light' ? loadedTemplates.like.light : loadedTemplates.like.dark;
    if (template) {
      const matchScore = compareImages(regionData, template, TEMPLATE_THRESHOLD);
      console.log("Like template match:", matchScore);
      
      if (matchScore >= TEMPLATE_THRESHOLD) {
        return { detected: true, confidence: 0.95, rgb: color };
      }
    }
  }

  // Fallback: color-based detection
  let isActive = false;
  let confidence = 0;

  if (theme === 'light') {
    const likeAtivoClaro = color.r <= 65 + RGB_TOLERANCE && color.g <= 65 + RGB_TOLERANCE && color.b <= 65 + RGB_TOLERANCE;
    isActive = likeAtivoClaro;
    confidence = isActive ? 0.8 : 0.15;
    console.log("Like - Tema Claro (fallback):", { likeAtivoClaro, isActive });
  } else {
    const likeAtivoEscuro = color.r >= 195 - RGB_TOLERANCE && color.g >= 195 - RGB_TOLERANCE && color.b >= 195 - RGB_TOLERANCE;
    isActive = likeAtivoEscuro;
    confidence = isActive ? 0.8 : 0.15;
    console.log("Like - Tema Escuro (fallback):", { likeAtivoEscuro, isActive });
  }

  return { detected: isActive, confidence, rgb: color };
}

// Template matching for subscribe button
function analyzeSubscribeButton(
  pixels: Uint8ClampedArray, 
  width: number, 
  height: number, 
  theme: 'light' | 'dark',
  ctx: CanvasRenderingContext2D
): { detected: boolean; confidence: number; rgb?: { r: number; g: number; b: number } } {
  
  const region = getSubscribeRegion();
  const x = Math.floor(region.x * width);
  const y = Math.floor(region.y * height);
  const w = Math.floor(region.w * width);
  const h = Math.floor(region.h * height);
  
  const regionData = ctx.getImageData(x, y, w, h);
  const color = getAverageColor(pixels, width, height, region);

  if (!color) return { detected: false, confidence: 0 };

  console.log("Subscribe button análise - Tema:", theme, "Cor:", color);

  // Check if red (not subscribed)
  if (isRed(color)) {
    console.log("Subscribe: Não inscrito (vermelho)");
    return { detected: false, confidence: 0.95, rgb: color };
  }

  // Try template matching if templates are loaded
  if (loadedTemplates) {
    const template = theme === 'light' ? loadedTemplates.subscribe.light : loadedTemplates.subscribe.dark;
    if (template) {
      const matchScore = compareImages(regionData, template, TEMPLATE_THRESHOLD);
      console.log("Subscribe template match:", matchScore);
      
      if (matchScore >= TEMPLATE_THRESHOLD) {
        return { detected: true, confidence: 0.95, rgb: color };
      }
    }
  }

  // Fallback: color-based detection
  let isSubscribed = false;
  let confidence = 0;

  if (theme === 'light') {
    const subscritoClaro = color.r >= 195 - RGB_TOLERANCE && color.g >= 195 - RGB_TOLERANCE && color.b >= 195 - RGB_TOLERANCE;
    isSubscribed = subscritoClaro;
    confidence = isSubscribed ? 0.8 : 0.15;
    console.log("Subscribe - Tema Claro (fallback):", { subscritoClaro, isSubscribed });
  } else {
    const subscritoEscuro = color.r <= 65 + RGB_TOLERANCE && color.g <= 65 + RGB_TOLERANCE && color.b <= 65 + RGB_TOLERANCE;
    isSubscribed = subscritoEscuro;
    confidence = isSubscribed ? 0.8 : 0.15;
    console.log("Subscribe - Tema Escuro (fallback):", { subscritoEscuro, isSubscribed });
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

// Decision Engine - Optimized version
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

  // If context invalid (not YouTube screenshot), immediately SUSPEITO
  if (!contextValid) {
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

  // Like contributes 50% - binary (detected or not)
  if (likeDetected) {
    likeScore = 50;
    visualScore += likeScore;
  }

  // Subscribe: Template OR OCR is sufficient (not AND)
  // OCR never penalizes - if template detected OR OCR detected, give full 50%
  if (subscribeDetected || textDetected) {
    subscribeScore = 50;
    visualScore += subscribeScore;
  }

  // Metadata only alerts - never reduces score
  const metadata_alert = metadataSuspect;

  // Calculate confidence
  const confidence = visualScore / 100;

  // Determine status - final optimized version
  let status: VisualAnalysisResult['status'];
  if (visualScore >= 90) {
    status = 'CONFIRMADO';
  } else if (visualScore >= 50) {
    status = 'PROVAVEL';
  } else {
    status = 'SUSPEITO';
  }

  // Protection rule: if any legitimate signal exists but status is SUSPEITO, upgrade to PROVAVEL
  if ((likeDetected || subscribeDetected) && status === 'SUSPEITO') {
    status = 'PROVAVEL';
  }

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
    // Load templates first
    await loadTemplates();
    
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
    const likeResult = analyzeLikeButton(pixels, canvas.width, canvas.height, themeResult.theme, ctx);
    debugInfo.push(`Like: ${likeResult.detected ? 'Active' : 'Inactive'}`);

    // Step 4: Analyze subscribe button (template matching)
    const subscribeResult = analyzeSubscribeButton(pixels, canvas.width, canvas.height, themeResult.theme, ctx);
    debugInfo.push(`Subscribe: ${subscribeResult.detected ? 'Yes' : 'No'}`);

    // Step 5: OCR only runs if template detected
    const textResult = checkSubscriptionText(ctx, canvas.width, canvas.height, subscribeResult.detected);
    debugInfo.push(`OCR: ${textResult.detected ? textResult.text : 'None'}`);

    // Debug logging
    console.log({
      likeDetected: likeResult.detected,
      subscribeDetected: subscribeResult.detected,
      likeScore: likeResult.detected ? 50 : 0,
      subscribeScore: (subscribeResult.detected && textResult.detected) ? 50 : (subscribeResult.detected ? 25 : 0),
      ocrText: textResult.text,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height
    });

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
