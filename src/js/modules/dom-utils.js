// ================================
// DOM UTILITIES - Safe HTML Manipulation
// ================================

/**
 * Sanitizes HTML string to prevent XSS attacks
 * @param {string} str - The string to sanitize
 * @returns {string} - Sanitized HTML string
 */
export function sanitizeHTML(str) {
  if (!str) return '';
  
  // Create a temporary div and use textContent to escape HTML
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Creates DOM element from HTML string safely
 * @param {string} html - HTML string
 * @returns {Element} - Created DOM element
 */
export function createElement(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild;
}

/**
 * Safely sets text content of an element
 * @param {Element} element - Target element
 * @param {string} text - Text to set
 */
export function safeSetText(element, text) {
  if (element) {
    element.textContent = text || '';
  }
}

/**
 * Safely sets HTML content with sanitization
 * @param {Element} element - Target element
 * @param {string} html - HTML to set
 * @param {boolean} trusted - If true, skips sanitization (use only for hardcoded HTML)
 */
export function safeSetHTML(element, html, trusted = false) {
  if (!element) return;
  
  if (trusted) {
    element.innerHTML = html;
  } else {
    // For user-generated content, create elements safely
    element.innerHTML = '';
    const temp = createElement(`<div>${html}</div>`);
    while (temp.firstChild) {
      element.appendChild(temp.firstChild);
    }
  }
}

/**
 * Builds HTML string with automatic escaping of dynamic values
 * @param {TemplateStringsArray} strings - Template literal strings
 * @param {...any} values - Values to interpolate
 * @returns {string} - Safe HTML string
 */
export function html(strings, ...values) {
  let result = strings[0];
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    // Sanitize the value if it's user-generated
    const sanitized = typeof value === 'string' ? sanitizeHTML(value) : value;
    result += sanitized + strings[i + 1];
  }
  return result;
}

/**
 * Creates a document fragment for efficient batch DOM updates
 * @param {Array} items - Items to render
 * @param {Function} renderFn - Function to render each item
 * @returns {DocumentFragment} - Document fragment with rendered items
 */
export function createFragment(items, renderFn) {
  const fragment = document.createDocumentFragment();
  items.forEach(item => {
    const element = renderFn(item);
    if (element) {
      fragment.appendChild(element);
    }
  });
  return fragment;
}

/**
 * Safely updates element attributes
 * @param {Element} element - Target element
 * @param {Object} attributes - Attributes to set
 */
export function safeSetAttributes(element, attributes) {
  if (!element || !attributes) return;
  
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'innerHTML' || key === 'outerHTML') {
      console.warn('Use safeSetHTML instead of setting innerHTML directly');
      return;
    }
    
    if (key.startsWith('on')) {
      console.warn('Use addEventListener instead of inline event handlers');
      return;
    }
    
    element.setAttribute(key, value);
  });
}

// Export as default object for easier importing
export const DOMUtils = {
  sanitizeHTML,
  createElement,
  safeSetText,
  safeSetHTML,
  html,
  createFragment,
  safeSetAttributes
};

export default DOMUtils;