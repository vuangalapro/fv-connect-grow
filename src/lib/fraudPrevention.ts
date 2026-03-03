/**
 * Fraud Prevention Utilities
 * - Unique comment code generation
 * - Device fingerprinting
 * - Risk score calculation
 */

/**
 * Generate a unique comment code for a task submission
 * Format: TASK-{task_id_short}-USER-{user_id_short}-{random_hash}
 * Example: TASK-ABC123-USER-XYZ789-A1B2C3D4
 */
export function generateUniqueCommentCode(taskId: string, userId: string): string {
    // Get short versions of IDs (first 6 characters)
    const taskShort = taskId.substring(0, 6).toUpperCase().replace(/-/g, '');
    const userShort = userId.substring(0, 6).toUpperCase().replace(/-/g, '');

    // Generate random 8-character hash
    const randomHash = generateRandomHash(8);

    return `TASK-${taskShort}-USER-${userShort}-${randomHash}`;
}

/**
 * Generate a random alphanumeric hash of specified length
 */
export function generateRandomHash(length: number = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Extract video ID from YouTube URL
 */
export function extractVideoId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

/**
 * Generate device fingerprint hash
 * Uses browser and device information to create a unique identifier
 */
export async function generateDeviceFingerprint(): Promise<string> {
    const fingerprintData = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        languages: navigator.languages?.join(','),
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: (navigator as any).deviceMemory,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        screenColorDepth: window.screen.colorDepth,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        touchSupport: 'ontouchstart' in window,
        maxTouchPoints: navigator.maxTouchPoints,
        plugins: Array.from(navigator.plugins || []).map(p => p.name).slice(0, 5).join(','),
        doNotTrack: navigator.doNotTrack,
        cookiesEnabled: navigator.cookieEnabled,
    };

    // Create a simple hash from the fingerprint data
    const fingerprintString = JSON.stringify(fingerprintData);
    return await hashString(fingerprintString);
}

/**
 * Simple hash function for strings (non-cryptographic)
 */
async function hashString(str: string): Promise<string> {
    // Use SubtleCrypto if available for better performance
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
    }

    // Fallback simple hash
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Calculate risk score based on submission data
 * Returns a number between 0-100
 */
export function calculateRiskScore(params: {
    watchedTime: number;
    requiredTime: number;
    hasDuplicateIP: boolean;
    duplicateIPCount: number;
    hasDuplicateDevice: boolean;
    duplicateDeviceCount: number;
    watchDuration: number; // Time from start to submission in seconds
}): number {
    let riskScore = 0;

    const {
        watchedTime,
        requiredTime,
        hasDuplicateIP,
        duplicateIPCount,
        hasDuplicateDevice,
        duplicateDeviceCount,
        watchDuration
    } = params;

    // Risk 1: Watch time too short
    const watchRatio = watchedTime / requiredTime;
    if (watchRatio < 0.8) {
        riskScore += 30; // High risk - less than 80% watched
    } else if (watchRatio < 1) {
        riskScore += 15; // Medium risk - watched but not full time
    }

    // Risk 2: Duplicate IP (same IP used by multiple users)
    if (hasDuplicateIP) {
        const ipRisk = Math.min(duplicateIPCount * 30, 90);
        riskScore += ipRisk;
    }

    // Risk 3: Duplicate device fingerprint
    if (hasDuplicateDevice) {
        const deviceRisk = Math.min(duplicateDeviceCount * 50, 100);
        riskScore += deviceRisk;
    }

    // Risk 4: Suspiciously fast completion (watching video faster than real-time)
    // If someone watches 90 seconds in less than 60 seconds total, it's suspicious
    if (watchDuration < watchedTime * 0.7) {
        riskScore += 20;
    }

    // Risk 5: Very fast submission after starting (less than required time + 10 seconds)
    if (watchDuration < requiredTime + 10 && watchedTime >= requiredTime) {
        riskScore += 10;
    }

    // Cap at 100
    return Math.min(riskScore, 100);
}

/**
 * Determine fraud alert status based on risk score
 */
export function determineFraudAlert(riskScore: number, ocrMatch: boolean | null): 'confiavel' | 'suspeita' | null {
    // If OCR didn't match, it's definitely suspicious
    if (ocrMatch === false) {
        return 'suspeita';
    }

    // High risk score with no OCR verification = suspicious
    if (riskScore >= 70) {
        return 'suspeita';
    }

    // Medium risk with OCR match = trustworthy
    if (riskScore < 40 && ocrMatch === true) {
        return 'confiavel';
    }

    // Default: pending (no definitive判断)
    return null;
}

/**
 * Format time in seconds to MM:SS format
 */
export function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get risk level text based on score
 */
export function getRiskLevel(riskScore: number): {
    level: 'BAIXO' | 'MÉDIO' | 'ALTO';
    color: string;
    bgColor: string;
} {
    if (riskScore >= 70) {
        return { level: 'ALTO', color: 'text-red-400', bgColor: 'bg-red-500/20' };
    } else if (riskScore >= 40) {
        return { level: 'MÉDIO', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
    }
    return { level: 'BAIXO', color: 'text-green-400', bgColor: 'bg-green-500/20' };
}

/**
 * Validate that the extracted code matches the expected format
 */
export function validateCodeFormat(code: string): boolean {
    // Expected format: TASK-XXXXXX-USER-XXXXXX-XXXXXXXX
    const pattern = /^TASK-[A-Z0-9]{6}-USER-[A-Z0-9]{6}-[A-Z0-9]{8}$/;
    return pattern.test(code);
}

/**
 * Compare two codes (case-insensitive)
 */
export function compareCodes(expected: string, extracted: string): boolean {
    return expected.toUpperCase() === extracted.toUpperCase().trim();
}
