/**
 * Validation utilities untuk input sanitization dan validation
 */

/**
 * Sanitize input string untuk mencegah XSS dan injection attacks
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }
  
  return input
    .trim()
    .replace(/[<>"'&]/g, (match) => {
      const entities = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return entities[match];
    });
}

/**
 * Validate UUID format
 */
function validateUUID(uuid) {
  if (!uuid || typeof uuid !== 'string') {
    return { valid: false, error: 'UUID must be a string' };
  }
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(uuid)) {
    return { valid: false, error: 'Invalid UUID format' };
  }
  
  return { valid: true };
}

/**
 * Validate email format
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email must be a string' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  return { valid: true };
}

/**
 * Validate phone number format (Indonesian)
 */
function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number must be a string' };
  }
  
  // Remove all non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Indonesian phone number patterns
  const patterns = [
    /^08\d{8,11}$/, // Mobile: 08xxxxxxxxx
    /^628\d{8,11}$/, // Mobile with country code: 628xxxxxxxxx
    /^\+628\d{8,11}$/, // Mobile with + country code: +628xxxxxxxxx
    /^021\d{7,8}$/, // Jakarta landline: 021xxxxxxx
    /^\d{3,4}\d{6,8}$/ // Other area codes
  ];
  
  const isValid = patterns.some(pattern => pattern.test(cleanPhone));
  
  if (!isValid) {
    return { valid: false, error: 'Invalid Indonesian phone number format' };
  }
  
  return { valid: true, cleanPhone };
}

/**
 * Validate required fields
 */
function validateRequired(fields, data) {
  const missing = [];
  
  fields.forEach(field => {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      missing.push(field);
    }
  });
  
  if (missing.length > 0) {
    return { valid: false, error: `Missing required fields: ${missing.join(', ')}` };
  }
  
  return { valid: true };
}

/**
 * Validate string length
 */
function validateLength(value, min = 0, max = Infinity) {
  if (typeof value !== 'string') {
    return { valid: false, error: 'Value must be a string' };
  }
  
  if (value.length < min) {
    return { valid: false, error: `Value must be at least ${min} characters long` };
  }
  
  if (value.length > max) {
    return { valid: false, error: `Value must be no more than ${max} characters long` };
  }
  
  return { valid: true };
}

/**
 * Validate enum values
 */
function validateEnum(value, allowedValues) {
  if (!allowedValues.includes(value)) {
    return { valid: false, error: `Value must be one of: ${allowedValues.join(', ')}` };
  }
  
  return { valid: true };
}

/**
 * Validate number range
 */
function validateRange(value, min = -Infinity, max = Infinity) {
  if (typeof value !== 'number' || isNaN(value)) {
    return { valid: false, error: 'Value must be a number' };
  }
  
  if (value < min) {
    return { valid: false, error: `Value must be at least ${min}` };
  }
  
  if (value > max) {
    return { valid: false, error: `Value must be no more than ${max}` };
  }
  
  return { valid: true };
}

module.exports = {
  sanitizeInput,
  validateUUID,
  validateEmail,
  validatePhoneNumber,
  validateRequired,
  validateLength,
  validateEnum,
  validateRange
};