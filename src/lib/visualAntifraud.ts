/**
 * Visual Anti-Fraud Service - Template-Based Detection
 * Detects like and subscribe buttons using template matching
 * Supports PT/EN, Light/Dark themes
 * Includes: Template Matching, OCR, Duplicate Detection, Dimension Validation
 */

import { createClient } from '@supabase/supabase-js';

// Status type
export type FraudStatus = 'CONFIRMADO' | 'PROVAVEL' | 'INCONCLUSIVO' | 'SUSPEITO' | 'REJEITADO';

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
    duplicate_hash?: string;
    is_duplicate?: boolean;
    dimension_valid?: boolean;
    dimensions?: { width: number; height: number };
  };
}

// Helper function to get status text
export function getStatusText(status: FraudStatus): string {
  const statusTexts: Record<FraudStatus, string> = {
    'CONFIRMADO': '✅ CONFIRMADO',
    'PROVAVEL': '⚠️ PROVÁVEL',
    'INCONCLUSIVO': '❓ INCONCLUSIVO',
    'SUSPEITO': '❌ SUSPEITO',
    'REJEITADO': '❌ REJEITADO'
  };
  return statusTexts[status];
}

// Valid dimension ranges for mobile screenshots
const MIN_DIMENSION = 300;
const MAX_WIDTH = 2000;
const MAX_HEIGHT = 3000;

// Validate image dimensions
function validateDimensions(width: number, height: number): { valid: boolean; dimensions: { width: number; height: number } } {
  const valid = width >= MIN_DIMENSION && width <= MAX_WIDTH && height >= MIN_DIMENSION && height <= MAX_HEIGHT;
  console.log(`Dimension validation: ${width}x${height} → ${valid ? 'VALID' : 'INVALID'}`);
  return { valid, dimensions: { width, height } };
}

// Calculate SHA-256 hash of image data for duplicate detection
async function calculateImageHash(imageData: ImageData): Promise<string> {
  // Convert to base64 for hashing
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.putImageData(imageData, 0, 0);
  const dataUrl = canvas.toDataURL('image/png');

  // Simple hash using SubtleCrypto
  const encoder = new TextEncoder();
  const data = encoder.encode(dataUrl);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Check for duplicate screenshot in database
async function checkDuplicateHash(
  imageHash: string,
  userId?: string,
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<{ isDuplicate: boolean; existingSubmission?: any }> {
  if (!imageHash || !supabaseUrl || !supabaseKey) {
    console.log('Duplicate check skipped: missing params');
    return { isDuplicate: false };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Query for existing submissions with same hash
    const { data: existing, error } = await supabase
      .from('screenshot_hashes')
      .select('*')
      .eq('hash', imageHash)
      .limit(1);

    if (error) {
      console.log('Duplicate check error:', error.message);
      return { isDuplicate: false };
    }

    if (existing && existing.length > 0) {
      console.log('⚠️ DUPLICATE SCREENSHOT DETECTED:', imageHash.substring(0, 16) + '...');
      return { isDuplicate: true, existingSubmission: existing[0] };
    }

    return { isDuplicate: false };
  } catch (err) {
    console.log('Duplicate check failed:', err);
    return { isDuplicate: false };
  }
}

// Save hash to database
async function saveImageHash(
  imageHash: string,
  submissionId: string,
  userId: string,
  supabaseUrl?: string,
  supabaseKey?: string
): Promise<boolean> {
  if (!imageHash || !supabaseUrl || !supabaseKey) {
    return false;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error } = await supabase
      .from('screenshot_hashes')
      .insert({
        hash: imageHash,
        submission_id: submissionId,
        user_id: userId,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.log('Failed to save hash:', error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.log('Save hash failed:', err);
    return false;
  }
}

// RGB tolerance
const RGB_TOLERANCE = 15;
const GRAY_THRESHOLD = 80;

// Template matching threshold - VERY LENIENT for better detection
const TEMPLATE_THRESHOLD = 0.35;

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
    img.onload = () => {
      console.log(`✅ Template loaded: ${url.split('/').pop()}`);
      resolve(img);
    };
    img.onerror = () => {
      console.error(`❌ Failed to load template: ${url}`);
      resolve(null);
    };
    img.src = url;
  });
}

// Load all templates with retry
async function loadTemplates(): Promise<boolean> {
  if (loadedTemplates) return true;

  const baseUrl = window.location.origin;
  const templateUrls = [
    `${baseUrl}/templates/like_template_light.png`,
    `${baseUrl}/templates/like_template_dark.png`,
    `${baseUrl}/templates/subscrito_template_light.png`,
    `${baseUrl}/templates/subscrito_template_dark.png`
  ];

  console.log('Loading templates from:', templateUrls);

  try {
    const [likeLight, likeDark, subsLight, subsDark] = await Promise.all([
      loadTemplate(templateUrls[0]),
      loadTemplate(templateUrls[1]),
      loadTemplate(templateUrls[2]),
      loadTemplate(templateUrls[3])
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

    // Return true only if at least one template for each type loaded
    return !!(likeLight || likeDark) && !!(subsLight || subsDark);
  } catch (error) {
    console.error('Error loading templates:', error);
    return false;
  }
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

// Improved template matching - compare pixels with multiple methods
function compareImages(
  screenshotRegion: ImageData,
  template: HTMLImageElement,
  threshold: number = 0.65
): number {
  if (!template || !screenshotRegion) {
    console.log('compareImages: missing parameters');
    return 0;
  }

  // Create canvas for template
  const canvas = document.createElement('canvas');
  canvas.width = template.width;
  canvas.height = template.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;

  ctx.drawImage(template, 0, 0);
  const templateData = ctx.getImageData(0, 0, template.width, template.height);

  // Method 1: Basic pixel matching (resize screenshot region to match template)
  const matchScore = calculatePixelSimilarity(screenshotRegion, templateData);

  console.log(`Template match score: ${(matchScore * 100).toFixed(1)}% (threshold: ${(threshold * 100).toFixed(0)}%)`);

  return matchScore;
}

// Calculate pixel similarity between two images
function calculatePixelSimilarity(img1: ImageData, img2: ImageData): number {
  // Use the smaller dimensions
  const width = Math.min(img1.width, img2.width);
  const height = Math.min(img1.height, img2.height);

  // Calculate center region for comparison (ignore edges)
  const xOffset1 = Math.floor((img1.width - width) / 2);
  const yOffset1 = Math.floor((img1.height - height) / 2);
  const xOffset2 = Math.floor((img2.width - width) / 2);
  const yOffset2 = Math.floor((img2.height - height) / 2);

  let matchingPixels = 0;
  let totalPixels = 0;
  const colorTolerance = 60; // More tolerant for different screen sizes

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx1 = ((y + yOffset1) * img1.width + (x + xOffset1)) * 4;
      const idx2 = ((y + yOffset2) * img2.width + (x + xOffset2)) * 4;

      const r1 = img1.data[idx1];
      const g1 = img1.data[idx1 + 1];
      const b1 = img1.data[idx1 + 2];

      const r2 = img2.data[idx2];
      const g2 = img2.data[idx2 + 1];
      const b2 = img2.data[idx2 + 2];

      // Calculate color distance (Euclidean)
      const distance = Math.sqrt(
        Math.pow(r1 - r2, 2) +
        Math.pow(g1 - g2, 2) +
        Math.pow(b1 - b2, 2)
      );

      if (distance < colorTolerance) {
        matchingPixels++;
      }
      totalPixels++;
    }
  }

  return totalPixels > 0 ? matchingPixels / totalPixels : 0;
}

// Compare template with screenshot region using feature detection
function compareWithTemplateFeatureDetection(
  screenshotRegion: ImageData,
  template: HTMLImageElement
): number {
  if (!template || !screenshotRegion) return 0;

  // Create template data
  const canvas = document.createElement('canvas');
  canvas.width = template.width;
  canvas.height = template.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.drawImage(template, 0, 0);
  const templateData = ctx.getImageData(0, 0, template.width, template.height);

  // Calculate edge density (for text/button detection)
  const screenshotEdges = calculateEdgeDensity(screenshotRegion);
  const templateEdges = calculateEdgeDensity(templateData);

  // Calculate color histogram similarity
  const screenshotHist = calculateColorHistogram(screenshotRegion);
  const templateHist = calculateColorHistogram(templateData);
  const histSimilarity = compareHistograms(screenshotHist, templateHist);

  // Combine scores
  const edgeScore = 1 - Math.abs(screenshotEdges - templateEdges) / Math.max(screenshotEdges, templateEdges, 1);

  return (edgeScore * 0.4 + histSimilarity * 0.6);
}

// Calculate edge density in image
function calculateEdgeDensity(imageData: ImageData): number {
  let edges = 0;
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const idxRight = (y * width + (x + 1)) * 4;
      const idxDown = ((y + 1) * width + x) * 4;

      // Simple Sobel-like edge detection
      const gx = Math.abs(data[idx] - data[idxRight]);
      const gy = Math.abs(data[idx] - data[idxDown]);

      if (gx + gy > 30) edges++;
    }
  }

  return edges / (width * height);
}

// Calculate color histogram
function calculateColorHistogram(imageData: ImageData): number[] {
  const hist = new Array(6).fill(0); // 6 color buckets
  const totalPixels = imageData.width * imageData.height;

  for (let i = 0; i < imageData.data.length; i += 4) {
    const r = imageData.data[i];
    const g = imageData.data[i + 1];
    const b = imageData.data[i + 2];

    // Brightness
    const brightness = (r + g + b) / 3;
    const bucket = Math.min(5, Math.floor(brightness / 51));
    hist[bucket]++;
  }

  return hist.map(v => v / totalPixels);
}

// Compare two histograms
function compareHistograms(hist1: number[], hist2: number[]): number {
  let sum = 0;
  for (let i = 0; i < hist1.length; i++) {
    sum += Math.min(hist1[i], hist2[i]);
  }
  return sum;
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

  const hasRedHeader = redPixels > 3; // Reduced from 5 to 3 for more tolerance
  const hasVideoFrame = darkCenterPixels > 10; // Reduced from 20 to 10 for more tolerance

  console.log("YouTube Context:", { hasRedHeader, hasVideoFrame, redPixels, darkCenterPixels });

  // Make context detection more lenient - accept if ANY indicator is present
  // or if image is large enough (likely a screenshot)
  const isLargeImage = width >= 800 && height >= 400;

  return hasRedHeader || hasVideoFrame || isLargeImage;
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

// Check if color is gray (inactive like)
function isGray(color: { r: number; g: number; b: number }): boolean {
  const max = Math.max(color.r, color.g, color.b);
  const min = Math.min(color.r, color.g, color.b);
  // More lenient: check if it's mostly grayscale (low saturation) and dark
  const saturation = (max - min) / (max || 1);
  return saturation < 0.2 && max < 150;
}

// Check if color is red (not subscribed - YouTube red Subscribe button)
function isRed(color: { r: number; g: number; b: number }): boolean {
  // More lenient red detection: red dominant and high intensity
  return color.r > 150 && color.r > color.g * 1.5 && color.r > color.b * 1.5;
}

// Like button detection - SIMPLE AND LENIENT
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

  const color = getAverageColor(pixels, width, height, region);

  if (!color) {
    console.log("❌ No color detected in like region");
    return { detected: false, confidence: 0 };
  }

  console.log("=== LIKE CHECK ===");
  console.log("Region:", { x, y, w, h }, "| Color:", color);

  // Check if gray (inactive like button - YouTube shows gray outline for unliked)
  if (isGray(color)) {
    console.log("❌ GRAY button → NOT liked");
    return { detected: false, confidence: 0.95, rgb: color };
  }

  // If button is NOT gray, it means the like is active
  console.log("✅ NOT gray button → LIKED!");
  return { detected: true, confidence: 0.95, rgb: color };
}

// Template matching for subscribe button - SIMPLE AND LENIENT
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

  const color = getAverageColor(pixels, width, height, region);

  if (!color) {
    console.log("❌ No color detected in subscribe region");
    return { detected: false, confidence: 0 };
  }

  console.log("=== SUBSCRIBE CHECK ===");
  console.log("Region:", { x, y, w, h }, "| Color:", color);

  // Check if button is RED (not subscribed - YouTube shows red Subscribe button)
  if (isRed(color)) {
    console.log("❌ RED button → NOT subscribed");
    return { detected: false, confidence: 0.95, rgb: color };
  }

  // If button is NOT red, user IS subscribed
  // This is the most reliable check - YouTube shows red for "Subscribe" and white/gray for "Subscribed"
  console.log("✅ NOT red button → SUBSCRIBED!");
  return { detected: true, confidence: 0.95, rgb: color };
}

// OCR - Uses template comparison for subscribe text detection
function checkSubscriptionText(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  subscribeDetected: boolean
): { detected: boolean; text: string } {

  console.log("=== OCR ANALYSIS ===");

  // If subscribe button was already detected via template, OCR confirms it
  if (subscribeDetected) {
    console.log("✅ Subscribe button detected via template - OCR confirming");

    // Also try to detect "Subscribed" text in the region
    const textRegion = {
      x: Math.floor(width * 0.80),
      y: Math.floor(height * 0.08),
      w: Math.floor(width * 0.08),
      h: Math.floor(height * 0.025),
    };

    const textData = ctx.getImageData(textRegion.x, textRegion.y, textRegion.w, textRegion.h);

    // Try to match with subscribe templates (text detection)
    if (loadedTemplates) {
      const template = loadedTemplates.subscribe.light || loadedTemplates.subscribe.dark;
      if (template) {
        const textMatchScore = compareImages(textData, template, 0.5);
        console.log(`📝 Text template match: ${(textMatchScore * 100).toFixed(1)}%`);

        if (textMatchScore > 0.4) {
          return { detected: true, text: 'subscribed' };
        }
      }
    }

    // Simple white/black text detection
    let whitePixels = 0;
    let totalPixels = 0;
    for (let i = 0; i < textData.data.length; i += 4) {
      const r = textData.data[i];
      const g = textData.data[i + 1];
      const b = textData.data[i + 2];
      totalPixels++;
      if (r > 200 && g > 200 && b > 200) whitePixels++;
    }

    const whiteRatio = whitePixels / totalPixels;
    console.log(`📝 White pixel ratio: ${(whiteRatio * 100).toFixed(1)}%`);

    if (whiteRatio > 0.15) {
      console.log("✅ OCR: Text detected (white pixels)");
      return { detected: true, text: 'subscribed' };
    }

    // Even without explicit text, if template matched, consider it detected
    return { detected: true, text: 'template_matched' };
  }

  console.log("❌ OCR: No subscribe button detected");
  return { detected: false, text: '' };
}

// Decision Engine - SIMPLE AND LENIENT
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

  console.log('=== ANTIFRAUD DECISION ===');
  console.log('contextValid:', contextValid);
  console.log('likeDetected:', likeDetected);
  console.log('subscribeDetected:', subscribeDetected);
  console.log('textDetected:', textDetected);
  console.log('========================');

  // If context is not valid, it's suspicious
  if (!contextValid) {
    return {
      status: 'SUSPEITO',
      confidence: 0,
      score_breakdown: { like_score: 0, subscribe_score: 0, total_score: 0 },
      metadata_alert: true
    };
  }

  // If BOTH like AND subscribe are detected, it's CONFIRMADO
  if (likeDetected && subscribeDetected) {
    return {
      status: 'CONFIRMADO',
      confidence: 1,
      score_breakdown: { like_score: 50, subscribe_score: 50, total_score: 100 },
      metadata_alert: false
    };
  }

  // If only one is detected, it's PROVAVEL
  if (likeDetected || subscribeDetected) {
    return {
      status: 'PROVAVEL',
      confidence: 0.5,
      score_breakdown: {
        like_score: likeDetected ? 50 : 0,
        subscribe_score: subscribeDetected ? 50 : 0,
        total_score: 50
      },
      metadata_alert: false
    };
  }

  // Neither detected - SUSPEITO
  return {
    status: 'SUSPEITO',
    confidence: 0,
    score_breakdown: { like_score: 0, subscribe_score: 0, total_score: 0 },
    metadata_alert: true
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
    submissionId?: string;
    isSuspicious?: boolean;
    supabaseUrl?: string;
    supabaseKey?: string;
  }
): Promise<VisualAnalysisResult> {
  const debugInfo: string[] = [];
  let imageHash = '';
  let isDuplicate = false;
  let dimensionValid = true;

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

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // STEP 0: Validate image dimensions FIRST
    const dimensionResult = validateDimensions(canvas.width, canvas.height);
    dimensionValid = dimensionResult.valid;
    debugInfo.push(`Dimensions: ${canvas.width}x${canvas.height} (${dimensionValid ? 'VALID' : 'INVALID'})`);

    // If dimensions invalid, reject immediately
    if (!dimensionValid) {
      console.log('REJECTED: Invalid image dimensions');
      return {
        status: 'REJEITADO',
        like_detected: false,
        subscribe_detected: false,
        theme_detected: 'light',
        language_detected: 'en',
        confidence: 0,
        details: {
          like_confidence: 0,
          subscribe_confidence: 0,
          theme_confidence: 0,
          error_message: 'Dimensões de imagem inválidas para screenshot mobile',
          debug_info: debugInfo,
          dimension_valid: false,
          dimensions: dimensionResult.dimensions
        }
      };
    }

    // STEP 0b: Calculate hash and check for duplicates
    imageHash = await calculateImageHash(imageData);
    console.log('Image Hash:', imageHash.substring(0, 16) + '...');

    if (metadata?.supabaseUrl && metadata?.supabaseKey) {
      const duplicateResult = await checkDuplicateHash(
        imageHash,
        metadata.userId,
        metadata.supabaseUrl,
        metadata.supabaseKey
      );
      isDuplicate = duplicateResult.isDuplicate;

      if (isDuplicate) {
        console.log('REJECTED: Duplicate screenshot detected');
        return {
          status: 'REJEITADO',
          like_detected: false,
          subscribe_detected: false,
          theme_detected: 'light',
          language_detected: 'en',
          confidence: 0,
          details: {
            like_confidence: 0,
            subscribe_confidence: 0,
            theme_confidence: 0,
            error_message: 'Screenshot duplicado - já submetido anteriormente',
            debug_info: debugInfo,
            duplicate_hash: imageHash,
            is_duplicate: true,
            dimension_valid: true,
            dimensions: dimensionResult.dimensions
          }
        };
      }
    }

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

    // Debug logging with ALL required fields
    console.log('=== ANTIFRAUD FINAL DEBUG ===', {
      hasPlayer: contextValid,
      templateMatch: likeResult.detected && subscribeResult.detected,
      theme: themeResult.theme,
      layoutCorrect: textResult.detected,
      likeDetected: likeResult.detected,
      subscribeDetected: subscribeResult.detected,
      likeScore: likeResult.detected ? 50 : 0,
      subscribeScore: (subscribeResult.detected && textResult.detected) ? 50 : (subscribeResult.detected ? 25 : 0),
      totalScore: (likeResult.detected ? 50 : 0) + ((subscribeResult.detected && textResult.detected) ? 50 : (subscribeResult.detected ? 25 : 0)),
      ocrText: textResult.text,
      imageHash: imageHash.substring(0, 16) + '...',
      isDuplicate,
      dimensionValid,
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

    // Save hash to database after successful validation
    if (imageHash && metadata?.submissionId && metadata?.userId && metadata?.supabaseUrl && metadata?.supabaseKey) {
      await saveImageHash(imageHash, metadata.submissionId, metadata.userId, metadata.supabaseUrl, metadata.supabaseKey);
    }

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
        context_valid: contextValid,
        duplicate_hash: imageHash,
        is_duplicate: false,
        dimension_valid: dimensionValid,
        dimensions: dimensionResult.dimensions
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
        debug_info: debugInfo,
        duplicate_hash: imageHash,
        is_duplicate: isDuplicate,
        dimension_valid: dimensionValid
      }
    };
  }
}
