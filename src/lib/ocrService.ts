/**
 * OCR Service using Tesseract.js
 * Extracts text from screenshots to validate comment codes
 */

import Tesseract from 'tesseract.js';
import { validateCodeFormat, compareCodes } from './fraudPrevention';

export interface OCRResult {
    success: boolean;
    extractedText: string;
    foundCodes: string[];
    primaryCode: string | null;
    confidence: number;
    error?: string;
}

/**
 * Perform OCR on an image and extract task codes
 * @param imageData - Base64 image data or URL
 * @param expectedCode - The code we expect to find (for validation)
 * @returns OCR result with extracted codes and confidence score
 */
export async function performOCR(
    imageData: string,
    expectedCode?: string
): Promise<OCRResult> {
    try {
        // Use Tesseract.js to recognize text
        const result = await Tesseract.recognize(imageData, 'eng', {
            logger: (m) => {
                if (m.status === 'recognizing text') {
                    console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                }
            },
        });

        const extractedText = result.data.text;
        const confidence = result.data.confidence;

        console.log('OCR Extracted text:', extractedText);
        console.log('OCR Confidence:', confidence);

        // Extract potential codes from the text
        const foundCodes = extractCodesFromText(extractedText);

        // Find the primary code (the one that matches expected format)
        const primaryCode = foundCodes.length > 0 ? foundCodes[0] : null;

        // Validate if the expected code matches any found code
        let isMatch = false;
        if (expectedCode && primaryCode) {
            isMatch = compareCodes(expectedCode, primaryCode);
        }

        // Also check if any of the found codes match
        if (!isMatch && expectedCode) {
            for (const code of foundCodes) {
                if (compareCodes(expectedCode, code)) {
                    isMatch = true;
                    break;
                }
            }
        }

        return {
            success: true,
            extractedText,
            foundCodes,
            primaryCode,
            confidence: confidence / 100, // Normalize to 0-1
        };
    } catch (error) {
        console.error('OCR Error:', error);
        return {
            success: false,
            extractedText: '',
            foundCodes: [],
            primaryCode: null,
            confidence: 0,
            error: error instanceof Error ? error.message : 'Unknown OCR error',
        };
    }
}

/**
 * Extract task codes from text using regex pattern matching
 * Looks for patterns like: TASK-XXXXXX-USER-XXXXXX-XXXXXXXX
 */
function extractCodesFromText(text: string): string[] {
    // Pattern for TASK-XXXXXX-USER-XXXXXX-XXXXXXXX format
    const pattern = /TASK-[A-Z0-9]{6}-USER-[A-Z0-9]{6}-[A-Z0-9]{8}/gi;

    const matches = text.match(pattern) || [];

    // Also try to find partial matches (in case OCR missed some characters)
    const partialPattern = /TASK-[A-Z0-9]{4,6}.*?USER.*?[A-Z0-9]{4,8}/gi;
    const partialMatches = text.match(partialPattern) || [];

    // Combine and deduplicate
    const allCodes = [...matches, ...partialMatches];
    const uniqueCodes = [...new Set(allCodes.map(c => c.toUpperCase()))];

    // Filter to only valid format codes
    return uniqueCodes.filter(code => validateCodeFormat(code));
}

/**
 * Check if OCR result indicates a match with expected code
 */
export function validateOCRMatch(
    ocrResult: OCRResult,
    expectedCode: string
): {
    isMatch: boolean;
    confidence: number;
    reason: string;
} {
    if (!ocrResult.success) {
        return {
            isMatch: false,
            confidence: 0,
            reason: 'OCR falhou - não foi possível extrair texto da imagem',
        };
    }

    if (ocrResult.foundCodes.length === 0) {
        return {
            isMatch: false,
            confidence: ocrResult.confidence,
            reason: 'Nenhum código encontrado na imagem',
        };
    }

    // Check if expected code is in found codes
    for (const code of ocrResult.foundCodes) {
        if (compareCodes(expectedCode, code)) {
            return {
                isMatch: true,
                confidence: ocrResult.confidence,
                reason: 'Código encontrado e validado com sucesso',
            };
        }
    }

    return {
        isMatch: false,
        confidence: ocrResult.confidence,
        reason: `Código esperado não encontrado. Códigos encontrados: ${ocrResult.foundCodes.join(', ')}`,
    };
}

/**
 * Perform quick OCR with lower quality for faster results
 * Useful for initial validation before full OCR
 */
export async function quickOCR(imageData: string): Promise<OCRResult> {
    try {
        const result = await Tesseract.recognize(imageData, 'eng', {
            logger: () => { }, // Suppress logging
        });

        const extractedText = result.data.text;
        const confidence = result.data.confidence / 100;

        const foundCodes = extractCodesFromText(extractedText);
        const primaryCode = foundCodes.length > 0 ? foundCodes[0] : null;

        return {
            success: true,
            extractedText,
            foundCodes,
            primaryCode,
            confidence,
        };
    } catch (error) {
        return {
            success: false,
            extractedText: '',
            foundCodes: [],
            primaryCode: null,
            confidence: 0,
            error: error instanceof Error ? error.message : 'Quick OCR failed',
        };
    }
}
