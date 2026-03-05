/**
 * Visual Anti-Fraud Service
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
        error_message?: string;
    };
}

// YouTube button colors by theme
const BUTTON_COLORS = {
    light: {
        like_active: { r: 0, g: 0, b: 0 },       // Black when liked
        like_inactive: { r: 136, g: 136, b: 136 }, // Gray when not liked
        subscribe_active: { r: 255, g: 255, b: 255 }, // White when subscribed
        subscribe_inactive: { r: 255, g: 0, b: 0 },  // Red when not subscribed
    },
    dark: {
        like_active: { r: 255, g: 255, b: 255 },    // White when liked
        like_inactive: { r: 136, g: 136, b: 136 }, // Gray when not liked
        subscribe_active: { r: 0, g: 0, b: 0 },    // Black when subscribed
        subscribe_inactive: { r: 255, g: 0, b: 0 }, // Red when not subscribed
    },
};

// Language patterns
const SUBSCRIBE_PATTERNS = {
    pt: ['subscrever', 'subscrito', 'inscrever', 'inscrito', 'subscreva', 'inscreve'],
    en: ['subscribe', 'subscribed', 'subscribing'],
};

/**
 * Load image with CORS proxy for canvas access
 */
async function loadImageWithProxy(imageUrl: string): Promise<HTMLImageElement> {
    // Use Vercel proxy if image is from external source
    let proxyUrl = imageUrl;

    if (imageUrl.includes('supabase') || imageUrl.startsWith('http')) {
        // Use our own proxy
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

/**
 * Detect theme) from image (light/dark
 */
function detectTheme(pixels: Uint8ClampedArray, width: number, height: number): { theme: 'light' | 'dark'; confidence: number } {
    // Sample from top portion of image
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

    if (darkRatio > 0.6) {
        return { theme: 'dark', confidence: darkRatio };
    } else if (darkRatio < 0.4) {
        return { theme: 'light', confidence: 1 - darkRatio };
    }

    return { theme: 'light', confidence: 0.5 };
}

/**
 * Analyze button region for like detection
 */
function analyzeLikeButton(pixels: Uint8ClampedArray, width: number, height: number, theme: 'light' | 'dark'): { detected: boolean; confidence: number } {
    // Like button is typically in bottom-left area
    const region = {
        x: Math.floor(width * 0.05),
        y: Math.floor(height * 0.75),
        w: Math.floor(width * 0.15),
        h: Math.floor(height * 0.1),
    };

    let darkCount = 0;
    let lightCount = 0;
    let totalPixels = 0;

    for (let y = region.y; y < region.y + region.h && y < height; y++) {
        for (let x = region.x; x < region.x + region.w && x < width; x++) {
            const idx = (y * width + x) * 4;
            const brightness = (pixels[idx] + pixels[idx + 1] + pixels[idx + 2]) / 3;

            if (brightness < 80) darkCount++;
            else if (brightness > 200) lightCount++;
            totalPixels++;
        }
    }

    const expectedActive = theme === 'light' ? BUTTON_COLORS.light.like_active : BUTTON_COLORS.dark.like_active;
    const activeColor = (expectedActive.r + expectedActive.g + expectedActive.b) / 3;

    // If we see mostly dark (light theme) or white (dark theme), like is likely active
    const isLikeActive = theme === 'light'
        ? (darkCount / totalPixels > 0.3)
        : (lightCount / totalPixels > 0.2);

    const confidence = Math.min(Math.abs((darkCount / totalPixels) - 0.5) + 0.5, 1);

    return { detected: isLikeActive, confidence };
}

/**
 * Analyze button region for subscribe detection
 */
function analyzeSubscribeButton(pixels: Uint8ClampedArray, width: number, height: number, theme: 'light' | 'dark'): { detected: boolean; confidence: number } {
    // Subscribe button is typically in bottom-right area
    const region = {
        x: Math.floor(width * 0.75),
        y: Math.floor(height * 0.75),
        w: Math.floor(width * 0.2),
        h: Math.floor(height * 0.1),
    };

    let whiteCount = 0;
    let redCount = 0;
    let blackCount = 0;
    let totalPixels = 0;

    for (let y = region.y; y < region.y + region.h && y < height; y++) {
        for (let x = region.x; x < region.x + region.w && x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];

            // Detect white (subscribed in light theme)
            if (r > 200 && g > 200 && b > 200) whiteCount++;
            // Detect red (not subscribed)
            else if (r > 200 && g < 50 && b < 50) redCount++;
            // Detect black (subscribed in dark theme)
            else if (r < 50 && g < 50 && b < 50) blackCount++;

            totalPixels++;
        }
    }

    // White = subscribed (light theme), Black = subscribed (dark theme)
    const isSubscribed = theme === 'light'
        ? (whiteCount / totalPixels > 0.3)
        : (blackCount / totalPixels > 0.2);

    const confidence = theme === 'light'
        ? Math.min((whiteCount / totalPixels) + 0.5, 1)
        : Math.min((blackCount / totalPixels) + 0.5, 1);

    return { detected: isSubscribed, confidence };
}

/**
 * Main analysis function - runs visual anti-fraud detection
 */
export async function analyzeVisualAntifraud(imageUrl: string): Promise<VisualAnalysisResult> {
    try {
        // Load image with proxy for CORS
        const img = await loadImageWithProxy(imageUrl);

        // Create canvas for pixel analysis
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get canvas context');
        }

        // Draw image to canvas
        ctx.drawImage(img, 0, 0);

        // Get pixel data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        // Detect theme
        const themeResult = detectTheme(pixels, canvas.width, canvas.height);
        const theme = themeResult.theme;

        // Analyze buttons
        const likeResult = analyzeLikeButton(pixels, canvas.width, canvas.height, theme);
        const subscribeResult = analyzeSubscribeButton(pixels, canvas.width, canvas.height, theme);

        // Calculate overall confidence
        const overallConfidence = (likeResult.confidence + subscribeResult.confidence + themeResult.confidence) / 3;

        // Determine status
        let status: VisualAnalysisResult['status'];
        if (likeResult.detected && subscribeResult.detected && overallConfidence >= 0.7) {
            status = 'CONFIRMADO';
        } else if ((likeResult.detected || subscribeResult.detected) && overallConfidence >= 0.5) {
            status = 'PROVAVEL';
        } else if (overallConfidence < 0.3) {
            status = 'INCONCLUSIVO';
        } else {
            status = 'SUSPEITO';
        }

        return {
            status,
            like_detected: likeResult.detected,
            subscribe_detected: subscribeResult.detected,
            theme_detected: theme,
            language_detected: 'pt', // Default, not detecting language in this simplified version
            confidence: overallConfidence,
            details: {
                like_confidence: likeResult.confidence,
                subscribe_confidence: subscribeResult.confidence,
                theme_confidence: themeResult.confidence,
            },
        };

    } catch (error) {
        console.error('Visual analysis error:', error);

        // Return INCONCLUSIVO on any error - this should NOT count as fraud
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
                error_message: error instanceof Error ? error.message : 'Unknown error',
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
            return '✅ CONFIRMADO - Like e Inscrição detectados';
        case 'PROVAVEL':
            return '⚠️ PROVÁVEL - Alta confiança de fraude';
        case 'INCONCLUSIVO':
            return '❓ INCONCLUSIVO - Falha técnica na análise';
        case 'SUSPEITO':
            return '🚨 SUSPEITO - Forte correlação de fraude';
        default:
            return 'Desconhecido';
    }
}
