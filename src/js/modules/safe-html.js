// ================================
// SAFE HTML UTILITIES
// ================================

/**
 * Creates a DOM element with safe text content
 * @param {string} tag - HTML tag name
 * @param {string} text - Text content (will be safely escaped)
 * @param {Object} attrs - Optional attributes
 * @returns {HTMLElement}
 */
export function createElement(tag, text = '', attrs = {}) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else {
      element.setAttribute(key, value);
    }
  });
  
  return element;
}

/**
 * Creates a table row with safe content
 * @param {Array} cells - Array of cell contents
 * @param {Object} options - Optional configuration
 * @returns {HTMLTableRowElement}
 */
export function createTableRow(cells, options = {}) {
  const row = document.createElement('tr');
  if (options.className) row.className = options.className;
  if (options.dataset) {
    Object.entries(options.dataset).forEach(([key, value]) => {
      row.dataset[key] = value;
    });
  }
  
  cells.forEach(cell => {
    const td = document.createElement('td');
    if (typeof cell === 'string') {
      td.textContent = cell;
    } else if (cell instanceof HTMLElement) {
      td.appendChild(cell);
    } else if (cell && typeof cell === 'object') {
      if (cell.html) {
        // Only for safe, pre-validated HTML (like buttons)
        td.innerHTML = cell.html;
      } else {
        td.textContent = cell.text || '';
        if (cell.className) td.className = cell.className;
      }
    }
    row.appendChild(td);
  });
  
  return row;
}

/**
 * Safely sets text content for multiple elements
 * @param {Object} updates - Object with selector: text pairs
 */
export function safeTextUpdate(updates) {
  Object.entries(updates).forEach(([selector, text]) => {
    const element = document.querySelector(selector);
    if (element) {
      element.textContent = text;
    }
  });
}

/**
 * Creates a safe HTML fragment from data
 * @param {Array} items - Array of items to render
 * @param {Function} renderer - Function that creates DOM elements
 * @returns {DocumentFragment}
 */
export function createFragment(items, renderer) {
  const fragment = document.createDocumentFragment();
  items.forEach(item => {
    const element = renderer(item);
    if (element) fragment.appendChild(element);
  });
  return fragment;
}

/**
 * Sanitizes a string for safe use in HTML attributes
 * @param {string} str - String to sanitize
 * @returns {string}
 */
export function sanitizeAttribute(str) {
  if (!str) return '';
  return str.replace(/['"<>&]/g, char => {
    const entities = {
      '"': '&quot;',
      "'": '&#39;',
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;'
    };
    return entities[char] || char;
  });
}

/**
 * Creates a button element safely
 * @param {string} text - Button text
 * @param {Object} options - Button options
 * @returns {HTMLButtonElement}
 */
export function createButton(text, options = {}) {
  const button = document.createElement('button');
  button.textContent = text;
  
  if (options.className) button.className = options.className;
  if (options.onclick) button.onclick = options.onclick;
  if (options.dataset) {
    Object.entries(options.dataset).forEach(([key, value]) => {
      button.dataset[key] = value;
    });
  }
  if (options.icon) {
    const icon = document.createElement('i');
    icon.className = options.icon;
    button.innerHTML = '';
    button.appendChild(icon);
    if (text) {
      button.appendChild(document.createTextNode(' ' + text));
    }
  }
  
  return button;
}

export const SafeHTML = {
  createElement,
  createTableRow,
  safeTextUpdate,
  createFragment,
  sanitizeAttribute,
  createButton
};