/**
 * HSECORE AI Security & Sanitization Layer
 * Protects against prompt injection, memory exhaustion, and sensitive data leakage.
 */

import { logger } from '../../core/logger.ts';

const MAX_PROMPT_LENGTH = 3500;
const MIN_PROMPT_LENGTH = 2;

// Suspicious prompt injection and adversarial patterns (English & Persian)
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s+override/i,
  /disregard\s+all\s+(rules|guidelines)/i,
  /(developer|dan|jailbreak)\s+mode/i,
  /(override|bypass)\s+system\s+(guidelines|rules|instructions)/i,
  /reveal\s+your\s+system\s+prompt/i,
  /print\s+your\s+initial\s+instructions/i,
  /show\s+me\s+the\s+hidden\s+prompt/i,
  /exec\s*\(\s*["']/i,
  /<script\b[^>]*>/i,
  /drop\s+table\b/i,
  /truncate\s+table\b/i,
  /update\s+users\s+set\s+password/i,
  /delete\s+from\s+users/i,
  // Persian adversarial patterns
  /تمام\s+دستورات\s+(قبلی|پیشین)\s+(را\s+)?(نادیده|فراموش)/i,
  /نادیده\s+بگیر\s+تمام\s+دستورات/i,
  /دستورات\s+سیستم\s+را\s+افشا\s+کن/i,
  /پرامپت\s+سیستم\s+را\s+(نمایش|چاپ|بگو)/i,
  /حالت\s+(توسعه‌دهنده|DAN|دان|هک|جیل‌بریک)/i,
  /رمز\s+(عبور|های)\s+کاربران/i,
  /اطلاعات\s+محرمانه\s+پزشکی\s+پرسنل/i,
  /دیتابیس\s+را\s+(حذف|پاک)\s+کن/i,
];

// Sensitive secret patterns to redact from responses
const SENSITIVE_OUTPUT_PATTERNS = [
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT Tokens
  /(\b(?:password|passwd|secret|token|api[_-]?key)\s*[:=]\s*["']?)[^"'\s,;]{6,}(["']?)/gi,
  /(AIza[0-9A-Za-z-_]{35})/g, // Google API keys
];

export class AISecurityService {
  /**
   * Sanitize and validate incoming user message
   */
  sanitizeUserInput(rawMessage: unknown): { isValid: boolean; sanitized: string; error?: string } {
    if (typeof rawMessage !== 'string') {
      return { isValid: false, sanitized: '', error: 'پیام ورودی باید از نوع متنی باشد.' };
    }

    const trimmed = rawMessage.trim();

    if (trimmed.length < MIN_PROMPT_LENGTH) {
      return { isValid: false, sanitized: '', error: 'طول پیام بسیار کوتاه است.' };
    }

    if (trimmed.length > MAX_PROMPT_LENGTH) {
      logger.warn('[AISecurity] Truncating overly long prompt', { originalLength: trimmed.length });
    }

    // Limit length to prevent CPU memory saturation
    const bounded = trimmed.slice(0, MAX_PROMPT_LENGTH);

    // Check for adversarial prompt injection
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(bounded)) {
        logger.warn('[AISecurity] Prompt injection pattern detected and rejected', {
          matchedPattern: String(pattern),
        });
        return {
          isValid: false,
          sanitized: '',
          error: 'متن ارسالی حاوی عبارات غیرمجاز یا الگوهای مغایر با پروتکل‌های امنیتی سامانه HSECORE است.',
        };
      }
    }

    // Strip HTML/Control tags
    const cleanText = bounded
      .replace(/<[^>]*>/g, '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');

    return { isValid: true, sanitized: cleanText };
  }

  /**
   * Sanitize and redact sensitive data from AI model outputs
   */
  sanitizeOutput(rawOutput: string): string {
    if (!rawOutput) return '';

    let cleaned = rawOutput;
    for (const pattern of SENSITIVE_OUTPUT_PATTERNS) {
      cleaned = cleaned.replace(pattern, '$1[اطلاعات محرمانه مسدود شد]$2');
    }

    return cleaned;
  }
}

export const aiSecurityService = new AISecurityService();
