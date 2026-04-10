// Input sanitization and validation

const MAX_STRING_LENGTH = 5000;
const MAX_ARRAY_LENGTH = 1000;
const DANGEROUS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /eval\(/gi,
  /expression\(/gi,
];

export function sanitizeString(input) {
  if (typeof input !== 'string') return '';
  
  // Reject oversized input
  if (input.length > MAX_STRING_LENGTH) {
    throw new Error(`Input exceeds maximum length of ${MAX_STRING_LENGTH}`);
  }

  // Remove dangerous patterns
  let sanitized = input;
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // HTML escape
  return sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return {};
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof key !== 'string' || key.length > 100) continue;
    
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      if (value.length > MAX_ARRAY_LENGTH) {
        throw new Error(`Array exceeds maximum length of ${MAX_ARRAY_LENGTH}`);
      }
      sanitized[key] = value.map(v => 
        typeof v === 'string' ? sanitizeString(v) : v
      );
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

export function validatePassword(password) {
  if (!password || typeof password !== 'string') return false;
  return password.length >= 8 && password.length <= 128;
}