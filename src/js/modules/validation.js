// ================================
// INPUT VALIDATION UTILITIES
// ================================

/**
 * Validates winner count input
 * @param {any} input - Input value
 * @param {number} maxAvailable - Maximum available entries
 * @returns {Object} { isValid, value, error }
 */
export function validateWinnerCount(input, maxAvailable) {
  const num = parseInt(input);
  
  if (isNaN(num)) {
    return { isValid: false, value: 1, error: 'Please enter a valid number' };
  }
  
  if (num < 1) {
    return { isValid: false, value: 1, error: 'Must select at least 1 winner' };
  }
  
  if (num > maxAvailable) {
    return { isValid: false, value: maxAvailable, error: `Cannot select more than ${maxAvailable} winners` };
  }
  
  if (num > 100) {
    return { isValid: false, value: 100, error: 'Maximum 100 winners at once for performance' };
  }
  
  return { isValid: true, value: num, error: null };
}

/**
 * Validates prize quantity
 * @param {any} input - Input value
 * @returns {Object} { isValid, value, error }
 */
export function validatePrizeQuantity(input) {
  const num = parseInt(input);
  
  if (isNaN(num)) {
    return { isValid: false, value: 0, error: 'Please enter a valid number' };
  }
  
  if (num < 0) {
    return { isValid: false, value: 0, error: 'Quantity cannot be negative' };
  }
  
  if (num > 10000) {
    return { isValid: false, value: 10000, error: 'Maximum quantity is 10,000' };
  }
  
  return { isValid: true, value: num, error: null };
}

/**
 * Validates name inputs (list names, prize names, etc.)
 * @param {string} input - Input value
 * @param {string} fieldName - Name of field for error message
 * @returns {Object} { isValid, value, error }
 */
export function validateName(input, fieldName = 'Name') {
  const trimmed = String(input || '').trim();
  
  if (!trimmed) {
    return { isValid: false, value: '', error: `${fieldName} is required` };
  }
  
  if (trimmed.length > 100) {
    return { isValid: false, value: trimmed.substring(0, 100), error: `${fieldName} must be less than 100 characters` };
  }
  
  // Check for potentially dangerous characters
  const dangerousChars = /<>\"\'`;/;
  if (dangerousChars.test(trimmed)) {
    return { isValid: false, value: trimmed.replace(/[<>\"\'`;]/g, ''), error: 'Special characters < > " \' ` ; are not allowed' };
  }
  
  return { isValid: true, value: trimmed, error: null };
}

/**
 * Validates phone number for SMS
 * @param {string} phone - Phone number
 * @returns {Object} { isValid, value, error }
 */
export function validatePhoneNumber(phone) {
  // Remove all non-digits
  const digits = String(phone || '').replace(/\D/g, '');
  
  if (!digits) {
    return { isValid: false, value: '', error: 'Phone number is required' };
  }
  
  // US phone numbers should be 10 or 11 digits
  if (digits.length === 11 && digits[0] === '1') {
    // Remove country code
    const formatted = digits.substring(1);
    return { isValid: true, value: formatted, error: null };
  }
  
  if (digits.length !== 10) {
    return { isValid: false, value: digits, error: 'Phone number must be 10 digits' };
  }
  
  return { isValid: true, value: digits, error: null };
}

/**
 * Validates webhook URL
 * @param {string} url - URL string
 * @returns {Object} { isValid, value, error }
 */
export function validateWebhookURL(url) {
  const trimmed = String(url || '').trim();
  
  if (!trimmed) {
    return { isValid: true, value: '', error: null }; // Empty is OK for optional webhook
  }
  
  try {
    const urlObj = new URL(trimmed);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return { isValid: false, value: trimmed, error: 'URL must use http or https' };
    }
    return { isValid: true, value: trimmed, error: null };
  } catch (e) {
    return { isValid: false, value: trimmed, error: 'Invalid URL format' };
  }
}

/**
 * Validates CSV file
 * @param {File} file - File object
 * @returns {Object} { isValid, value, error }
 */
export function validateCSVFile(file) {
  if (!file) {
    return { isValid: false, value: null, error: 'Please select a file' };
  }
  
  // Check file extension
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'csv') {
    return { isValid: false, value: file, error: 'File must be a CSV (.csv)' };
  }
  
  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { isValid: false, value: file, error: 'File size must be less than 10MB' };
  }
  
  if (file.size === 0) {
    return { isValid: false, value: file, error: 'File is empty' };
  }
  
  return { isValid: true, value: file, error: null };
}

/**
 * Validates delay time in seconds
 * @param {any} input - Input value
 * @returns {Object} { isValid, value, error }
 */
export function validateDelay(input) {
  const num = parseFloat(input);
  
  if (isNaN(num)) {
    return { isValid: false, value: 0, error: 'Please enter a valid number' };
  }
  
  if (num < 0) {
    return { isValid: false, value: 0, error: 'Delay cannot be negative' };
  }
  
  if (num > 60) {
    return { isValid: false, value: 60, error: 'Maximum delay is 60 seconds' };
  }
  
  return { isValid: true, value: num, error: null };
}

/**
 * Sanitizes HTML input to prevent XSS
 * @param {string} input - Input string
 * @returns {string} Sanitized string
 */
export function sanitizeHTML(input) {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

export const Validation = {
  validateWinnerCount,
  validatePrizeQuantity,
  validateName,
  validatePhoneNumber,
  validateWebhookURL,
  validateCSVFile,
  validateDelay,
  sanitizeHTML
};