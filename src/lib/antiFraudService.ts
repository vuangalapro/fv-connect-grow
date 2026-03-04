/**
 * Anti-Fraud Service
 * Comprehensive fraud detection and penalty system
 */

import { supabase } from './supabase';

export interface FraudAnalysisResult {
    score: number;
    flags: string[];
    ipShared: boolean;
    deviceShared: boolean;
    uaMatch: boolean;
    sharedAffiliates: number;
    sharedDevices: number;
    ipAddress?: string;
    deviceFingerprint?: string;
}

export interface AffiliatePenalty {
    id: string;
    affiliate_id: string;
    task_submission_id: string | null;
    penalty_type: string;
    penalty_percent: number;
    reason: string;
    system_flags: string[];
    applied_at: string;
}

export interface AffiliateStatus {
    penalty_credit: number;
    affiliate_status: 'active' | 'suspended' | 'banned';
    total_penalties: number;
    fraud_score: number;
}

/**
 * Get device fingerprint from browser
 */
export function getDeviceFingerprint(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('AntiFraud', 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('AntiFraud', 4, 17);

    const canvasHash = canvas.toDataURL();

    const fingerprint = [
        navigator.userAgent,
        navigator.language,
        screen.width,
        screen.height,
        screen.colorDepth,
        new Date().getTimezoneOffset(),
        canvasHash,
        navigator.hardwareConcurrency || 'unknown',
        navigator.maxTouchPoints || 0,
    ].join('|');

    return btoa(fingerprint);
}

/**
 * Get client IP address (requires server-side proxy in production)
 */
export async function getClientIP(): Promise<string> {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch {
        return 'unknown';
    }
}

/**
 * Register device for affiliate (called when they start a task)
 */
export async function registerDevice(
    affiliateId: string,
    deviceFingerprint: string,
    ip?: string
): Promise<string | null> {
    try {
        const { data, error } = await supabase.rpc('register_affiliate_device', {
            p_affiliate_id: affiliateId,
            p_fingerprint: deviceFingerprint,
            p_ip: ip || await getClientIP(),
            p_user_agent: navigator.userAgent,
        });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error registering device:', error);
        return null;
    }
}

/**
 * Register video click when affiliate accesses a task
 */
export async function registerVideoClick(
    affiliateId: string,
    taskId: string,
    token: string,
    fromUrl?: string
): Promise<string | null> {
    try {
        const ip = await getClientIP();
        
        const { data, error } = await supabase.rpc('register_video_click', {
            p_affiliate_id: affiliateId,
            p_task_id: taskId,
            p_token: token,
            p_ip: ip,
            p_user_agent: navigator.userAgent,
            p_from_url: fromUrl || window.location.href,
        });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error registering click:', error);
        return null;
    }
}

/**
 * Calculate fraud score for a submission
 */
export async function calculateFraudScore(
    affiliateId: string,
    ip: string,
    deviceFingerprint: string,
    taskId: string
): Promise<FraudAnalysisResult> {
    try {
        const { data, error } = await supabase.rpc('calculate_fraud_score', {
            p_affiliate_id: affiliateId,
            p_ip: ip,
            p_fingerprint: deviceFingerprint,
            p_task_id: taskId,
        });

        if (error) throw error;

        if (data && data.length > 0) {
            return {
                score: data[0].score || 100,
                flags: data[0].flags || [],
                ipShared: data[0].ip_shared || false,
                deviceShared: data[0].device_shared || false,
                uaMatch: data[0].ua_match || false,
                sharedAffiliates: data[0].shared_affiliates || 0,
                sharedDevices: data[0].shared_devices || 0,
                ipAddress: ip,
                deviceFingerprint: deviceFingerprint,
            };
        }

        return {
            score: 100,
            flags: [],
            ipShared: false,
            deviceShared: false,
            uaMatch: false,
            sharedAffiliates: 0,
            sharedDevices: 0,
            ipAddress: ip,
            deviceFingerprint: deviceFingerprint,
        };
    } catch (error) {
        console.error('Error calculating fraud score:', error);
        return {
            score: 100,
            flags: [],
            ipShared: false,
            deviceShared: false,
            uaMatch: false,
            sharedAffiliates: 0,
            sharedDevices: 0,
        };
    }
}

/**
 * Check if IP is shared by multiple affiliates
 */
export async function checkIPShared(ip: string, affiliateId: string): Promise<boolean> {
    try {
        const { data, error } = await supabase.rpc('check_ip_shared', {
            p_ip: ip,
            p_affiliate_id: affiliateId,
        });

        if (error) throw error;
        return data && data.length > 0;
    } catch {
        return false;
    }
}

/**
 * Check if device is shared
 */
export async function checkDeviceShared(fingerprint: string, affiliateId: string): Promise<boolean> {
    try {
        const { data, error } = await supabase.rpc('check_device_shared', {
            p_fingerprint: fingerprint,
            p_affiliate_id: affiliateId,
        });

        if (error) throw error;
        return data && data.length > 0;
    } catch {
        return false;
    }
}

/**
 * Apply penalty to affiliate
 */
export async function applyPenalty(
    affiliateId: string,
    taskSubmissionId: string,
    penaltyType: string,
    penaltyPercent: number,
    reason: string,
    flags: string[],
    adminId: string
): Promise<boolean> {
    try {
        const { error } = await supabase.rpc('apply_affiliate_penalty', {
            p_affiliate_id: affiliateId,
            p_task_submission_id: taskSubmissionId,
            p_penalty_type: penaltyType,
            p_penalty_percent: penaltyPercent,
            p_reason: reason,
            p_flags: flags,
            p_applied_by: adminId,
        });

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error applying penalty:', error);
        return false;
    }
}

/**
 * Get affiliate penalty history
 */
export async function getAffiliatePenalties(affiliateId: string): Promise<AffiliatePenalty[]> {
    try {
        const { data, error } = await supabase
            .from('affiliate_penalties')
            .select('*')
            .eq('affiliate_id', affiliateId)
            .order('applied_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch {
        return [];
    }
}

/**
 * Get affiliate status
 */
export async function getAffiliateStatus(affiliateId: string): Promise<AffiliateStatus | null> {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('penalty_credit, affiliate_status, total_penalties, fraud_score')
            .eq('id', affiliateId)
            .single();

        if (error) throw error;
        return data;
    } catch {
        return null;
    }
}

/**
 * Get fraud analysis for affiliate (for admin view)
 */
export async function getAffiliateFraudAnalysis(affiliateId: string): Promise<{
    devices: any[];
    clicks: any[];
    penalties: AffiliatePenalty[];
    status: AffiliateStatus | null;
}> {
    try {
        const [devices, clicks, penalties, status] = await Promise.all([
            supabase
                .from('affiliate_devices')
                .select('*')
                .eq('affiliate_id', affiliateId)
                .order('last_seen_at', { ascending: false }),
            supabase
                .from('video_clicks')
                .select('*')
                .eq('affiliate_id', affiliateId)
                .order('clicked_at', { ascending: false })
                .limit(20),
            getAffiliatePenalties(affiliateId),
            getAffiliateStatus(affiliateId),
        ]);

        return {
            devices: devices.data || [],
            clicks: clicks.data || [],
            penalties,
            status,
        };
    } catch (error) {
        console.error('Error getting fraud analysis:', error);
        return {
            devices: [],
            clicks: [],
            penalties: [],
            status: null,
        };
    }
}

/**
 * Get fraud analysis for all affiliates (admin dashboard)
 */
export async function getAllAffiliatesFraudAnalysis(): Promise<any[]> {
    try {
        const { data, error } = await supabase.rpc('v_affiliate_fraud_analysis');
        
        if (error) throw error;
        return data || [];
    } catch {
        return [];
    }
}

/**
 * Determine fraud status based on score
 */
export function getFraudStatus(score: number): 'confiavel' | 'suspeito' | 'alto_risco' {
    if (score >= 80) return 'alto_risco';
    if (score >= 50) return 'suspeito';
    return 'confiavel';
}

/**
 * Calculate penalty based on flags
 */
export function calculatePenalty(flags: string[]): { percent: number; type: string } {
    let percent = 0;
    const types: string[] = [];

    if (flags.includes('IP_SHARED')) {
        percent += 5;
        types.push('IP_SHARED');
    }

    if (flags.includes('DEVICE_SHARED')) {
        percent += 10;
        types.push('DEVICE_SHARED');
    }

    if (flags.includes('MULTI_ACCOUNT')) {
        percent += 40;
        types.push('MULTI_ACCOUNT');
    }

    if (flags.includes('YT_CHANNEL_REUSE')) {
        percent += 50;
        types.push('YT_CHANNEL_REUSE');
    }

    return {
        percent,
        type: types.join(', ') || 'NONE',
    };
}

/**
 * Format flags for display
 */
export function formatFlags(flags: string[]): { label: string; color: string }[] {
    const flagConfig: Record<string, { label: string; color: string }> = {
        'IP_SHARED': { label: 'IP Compartilhado', color: 'yellow' },
        'DEVICE_SHARED': { label: 'Dispositivo Compartilhado', color: 'orange' },
        'MULTI_ACCOUNT': { label: 'Múltiplas Contas', color: 'red' },
        'UA_MATCH': { label: 'User-Agent Igual', color: 'yellow' },
        'YT_CHANNEL_REUSE': { label: 'Canal YouTube Reutilizado', color: 'red' },
        'OCR_FAILED': { label: 'OCR Falhou', color: 'yellow' },
        'CODE_MISMATCH': { label: 'Código Não Confere', color: 'red' },
    };

    return flags.map(flag => ({
        label: flagConfig[flag]?.label || flag,
        color: flagConfig[flag]?.color || 'gray',
    }));
}
