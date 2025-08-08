// ================================
// CSV PARSING & UPLOAD
// ================================

import { UI } from './ui.js';
import { Lists } from './lists.js';
import { Database } from './firestore.js';
import { settings, Settings } from './settings.js';

let pendingCSVData = null;

// Handler for skip existing winners checkbox
function handleSkipWinnersChange(event) {
  const checked = event.target.checked;
  Settings.saveSingleSetting('skipExistingWinners', checked);
  console.log('Skip existing winners setting saved:', checked);
}

// Utility functions for camelizing object keys
function camelize(key) {
  const prefix = key.match(/^_{1,2}/)?.[0] || '';
  const keyWithoutPrefix = key.slice(prefix.length);

  if (keyWithoutPrefix === '' || keyWithoutPrefix.match(/^\|+$/)) {
    return prefix;
  }

  const cleaned = keyWithoutPrefix
    .normalize('NFD') // Decompose Unicode characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .replace(/[^\p{Alphabetic}\p{Number}]+/gu, '|')
    .replace(/(?<=[a-z0-9])([A-Z][A-Za-z]*[A-Za-z]\b)/, str => '|' + str)
    .toLowerCase();

  const camelizedKey = cleaned.split('|').filter(Boolean).map((part, i) => (i === 0 ? part : capitalize(part))).join('');

  return prefix + camelizedKey;
}

/**
 * Recursively or shallowly transforms the keys of an object to camelCase.
 *
 * @param {Object|Array} obj - The object or array whose keys should be camelized.
 * @param {boolean} [deep=false] - Whether to recursively camelize nested objects and arrays.
 * @returns {Object|Array} A new object or array with camelized keys.
 */
function camelizeObj(obj, deep = false) {
  if (Array.isArray(obj)) {
    return deep ? obj.map(item => camelizeObj(item, true)) : obj;
  }

  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  return Object.entries(obj).reduce((acc, [key, value]) => {
    const newKey = camelize(key);
    const newValue = deep ? camelizeObj(value, true) : value;
    acc[newKey] = newValue;
    return acc;
  }, {});
}

function lowerCase(str) {
  return str.length && str[0].toLowerCase() + str.slice(1);
}

// Capitalize a string
function capitalize(str, { lowerRest = false } = {}) {
  if (!str) return str;
  if (lowerRest) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    return { data: [], errors: ['Empty file'] };
  }

  const headers = parseCSVLine(lines[0]);
  const data = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i]);
      if (values.length > 0) {
        const row = {};
        headers.forEach((header, index) => {
          row[header.trim()] = values[index]?.trim() || '';
        });
        // Camelize the row object keys for consistency
        const camelizedRow = camelizeObj(row);
        data.push(camelizedRow);
      }
    } catch (error) {
      errors.push(`Line ${i + 1}: ${error.message}`);
    }
  }

  return { data, errors };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

async function handleCSVUpload() {
  console.log('handleCSVUpload called');
  const listNameInput = document.getElementById('listName');
  const csvFileInput = document.getElementById('csvFile');

  if (!csvFileInput || !csvFileInput.files || csvFileInput.files.length === 0) {
    console.log('No file selected');
    return;
  }

  const csvFile = csvFileInput.files[0];
  console.log('CSV file:', csvFile);
  const fileName = csvFile.name.replace(/\.[^/.]+$/, "");
  const listName = listNameInput.value.trim() || fileName;

  if (!csvFile) {
    UI.showToast('Please select a CSV file', 'warning');
    return;
  }

  try {
    UI.showProgress('Processing CSV', 'Reading file...');

    const csvText = await UI.readFileAsText(csvFile);
    const { data, errors } = parseCSV(csvText);

    if (errors.length > 0) {
      throw new Error('CSV parsing errors: ' + errors.join(', '));
    }

    if (data.length === 0) {
      throw new Error('CSV file appears to be empty');
    }

    UI.hideProgress();

    pendingCSVData = {
      listName: listName,
      fileName: csvFile.name,
      data: data
    };

    showCSVPreview(data, listName);
  } catch (error) {
    UI.hideProgress();
    console.error('CSV upload error:', error);
    UI.showToast('Error processing CSV: ' + error.message, 'error');
  }
}

function showCSVPreview(data, listName) {
  console.log('showCSVPreview called with', data.length, 'rows');
  const previewCard = document.getElementById('dataPreviewCard');
  const previewHeaders = document.getElementById('previewHeaders');
  const previewBody = document.getElementById('previewBody');

  console.log('Preview card element:', previewCard);
  if (!previewCard) {
    console.error('dataPreviewCard element not found!');
    return;
  }
  
  previewCard.style.display = 'block';
  console.log('Set preview card to display: block');
  const headers = Object.keys(data[0]);

  previewHeaders.innerHTML = '<tr>' +
    headers.map(header => `<th>${header}</th>`).join('') +
    '</tr>';

  const previewData = data.slice(0, 10);

  previewBody.innerHTML = previewData.map(row =>
    '<tr>' +
    headers.map(header => `<td>${row[header] || ''}</td>`).join('') +
    '</tr>'
  ).join('');

  const previewTitle = document.querySelector('#dataPreviewCard .card-title');
  previewTitle.innerHTML = `Data Preview - <span class="list-name">"${listName}"</span> <span class="list-count">(${data.length} total records, showing first ${previewData.length})</span>`;

  showNameConfiguration(headers, data[0]);
  previewCard.scrollIntoView({ behavior: 'smooth' });
  UI.showToast(`Preview ready! Showing first ${previewData.length} of ${data.length} records`, 'info');
}

function showNameConfiguration(headers, firstRow) {
  const nameConfigCard = document.getElementById('nameConfigCard');
  const availableFields = document.getElementById('availableFields');
  const nameTemplateInput = document.getElementById('nameTemplate');
  const namePreview = document.getElementById('namePreview');
  const idColumnSelect = document.getElementById('idColumnSelect');
  const columnIdSection = document.getElementById('columnIdSection');
  const autoGenerateId = document.getElementById('autoGenerateId');
  const useColumnId = document.getElementById('useColumnId');
  const skipExistingWinnersCheckbox = document.getElementById('skipExistingWinners');

  nameConfigCard.style.display = 'block';
  availableFields.innerHTML = '';
  
  // Load the skipExistingWinners setting
  if (skipExistingWinnersCheckbox) {
    console.log('Skip winners checkbox found, setting to:', settings.skipExistingWinners);
    skipExistingWinnersCheckbox.checked = settings.skipExistingWinners || false;
    
    // Add change listener to save the setting
    skipExistingWinnersCheckbox.removeEventListener('change', handleSkipWinnersChange);
    skipExistingWinnersCheckbox.addEventListener('change', handleSkipWinnersChange);
    
    // Make sure the checkbox and its container are visible
    skipExistingWinnersCheckbox.style.display = 'inline-block';
    const checkboxContainer = skipExistingWinnersCheckbox.closest('.mb-3');
    if (checkboxContainer) {
      checkboxContainer.style.display = 'block';
    }
  } else {
    console.error('Skip winners checkbox not found!');
  }

  // Populate available fields for name template
  headers.forEach(header => {
    const fieldBtn = document.createElement('button');
    fieldBtn.className = 'btn btn-sm btn-outline-secondary';
    fieldBtn.textContent = header;
    fieldBtn.onclick = () => {
      const cursorPos = nameTemplateInput.selectionStart;
      const text = nameTemplateInput.value;
      const placeholder = `{${header}}`;
      nameTemplateInput.value = text.slice(0, cursorPos) + placeholder + text.slice(cursorPos);
      nameTemplateInput.focus();
      updatePreview();
    };
    availableFields.appendChild(fieldBtn);
  });

  // Populate available fields for info templates
  const infoAvailableFields = document.getElementById('infoAvailableFields');
  const info1Template = document.getElementById('info1Template');
  const info2Template = document.getElementById('info2Template');
  const info3Template = document.getElementById('info3Template');
  
  // Track which info field was last focused
  let lastFocusedInfoField = info1Template;
  
  info1Template.addEventListener('focus', () => lastFocusedInfoField = info1Template);
  info2Template.addEventListener('focus', () => lastFocusedInfoField = info2Template);
  info3Template.addEventListener('focus', () => lastFocusedInfoField = info3Template);
  
  infoAvailableFields.innerHTML = '';
  headers.forEach(header => {
    const fieldBtn = document.createElement('button');
    fieldBtn.className = 'btn btn-sm btn-outline-primary';
    fieldBtn.textContent = header;
    fieldBtn.onclick = (e) => {
      e.preventDefault();
      
      // Add field to the last focused info template
      const targetInput = lastFocusedInfoField;
      const cursorPos = targetInput.selectionStart || targetInput.value.length;
      const text = targetInput.value;
      const placeholder = `{${header}}`;
      targetInput.value = text.slice(0, cursorPos) + placeholder + text.slice(cursorPos);
      targetInput.focus();
      // Set cursor position after the inserted placeholder
      const newCursorPos = cursorPos + placeholder.length;
      targetInput.setSelectionRange(newCursorPos, newCursorPos);
      updateInfoPreviews();
    };
    infoAvailableFields.appendChild(fieldBtn);
  });

  // Populate ID column dropdown
  idColumnSelect.innerHTML = '<option value="">Select a column...</option>';
  headers.forEach(header => {
    const option = document.createElement('option');
    option.value = header;
    option.textContent = header;
    idColumnSelect.appendChild(option);
  });

  // Set default name template
  const defaultTemplate = headers.length > 1 ? `{${headers[0]}} {${headers[1]}}` : `{${headers[0]}}`;
  nameTemplateInput.value = defaultTemplate;

  // Set default info templates
  if (headers.length >= 1) info1Template.value = headers.length > 1 ? `{${headers[0]}} {${headers[1]}}` : `{${headers[0]}}`;
  if (headers.length >= 3) info2Template.value = `{${headers[2]}}`;
  if (headers.length >= 4) info3Template.value = `{${headers[3]}}`;

  function updatePreview() {
    const template = nameTemplateInput.value;
    const previewText = template.replace(/\{([^}]+)\}/g, (match, key) => {
      return firstRow[key] || '';
    });
    namePreview.textContent = previewText;
  }

  function updateInfoPreviews() {
    const info1Preview = document.getElementById('info1Preview');
    const info2Preview = document.getElementById('info2Preview');
    const info3Preview = document.getElementById('info3Preview');
    
    const info1Text = info1Template.value.replace(/\{([^}]+)\}/g, (match, key) => {
      return firstRow[key] || '';
    });
    const info2Text = info2Template.value.replace(/\{([^}]+)\}/g, (match, key) => {
      return firstRow[key] || '';
    });
    const info3Text = info3Template.value.replace(/\{([^}]+)\}/g, (match, key) => {
      return firstRow[key] || '';
    });
    
    info1Preview.textContent = info1Text || 'Info 1 preview';
    info2Preview.textContent = info2Text || 'Info 2 preview';
    info3Preview.textContent = info3Text || 'Info 3 preview';
    
    // Hide empty previews
    info1Preview.style.display = info1Text ? 'block' : 'none';
    info2Preview.style.display = info2Text ? 'block' : 'none';
    info3Preview.style.display = info3Text ? 'block' : 'none';
  }

  // Setup ID source radio button listeners
  function toggleIdSection() {
    if (useColumnId.checked) {
      columnIdSection.style.display = 'block';
    } else {
      columnIdSection.style.display = 'none';
    }
  }

  // Remove existing listeners to prevent conflicts
  autoGenerateId.removeEventListener('change', toggleIdSection);
  useColumnId.removeEventListener('change', toggleIdSection);
  nameTemplateInput.removeEventListener('input', updatePreview);
  info1Template.removeEventListener('input', updateInfoPreviews);
  info2Template.removeEventListener('input', updateInfoPreviews);
  info3Template.removeEventListener('input', updateInfoPreviews);

  // Add fresh listeners
  autoGenerateId.addEventListener('change', toggleIdSection);
  useColumnId.addEventListener('change', toggleIdSection);
  nameTemplateInput.addEventListener('input', updatePreview);
  info1Template.addEventListener('input', updateInfoPreviews);
  info2Template.addEventListener('input', updateInfoPreviews);
  info3Template.addEventListener('input', updateInfoPreviews);

  // Initial setup
  updatePreview();
  updateInfoPreviews();
  toggleIdSection();
}

async function handleConfirmUpload() {
  if (!pendingCSVData) {
    UI.showToast('No data to upload', 'error');
    return;
  }

  try {
    UI.showProgress('Processing List', 'Validating data...');

    const nameConfig = getNameConfiguration();
    const infoConfig = getInfoConfiguration();
    const idConfig = getIdConfiguration();
    
    // Get skipExistingWinners from checkbox if available, otherwise use settings
    const skipCheckbox = document.getElementById('skipExistingWinners');
    const skipExistingWinners = skipCheckbox ? skipCheckbox.checked : settings.skipExistingWinners;
    
    console.log('Skip existing winners:', skipExistingWinners, 'Checkbox exists:', !!skipCheckbox);

    // Validate ID configuration if using column-based IDs
    if (idConfig.source === 'column') {
      const validation = validateColumnIds(pendingCSVData.data, idConfig.column);
      if (!validation.isValid) {
        UI.hideProgress();
        UI.showToast(`ID validation failed: ${validation.error}`, 'error');
        return;
      }
    }

    UI.updateProgress(25, 'Creating list structure...');

    // Filter out existing winners if the option is enabled
    let dataToUpload = pendingCSVData.data;
    let skippedCount = 0;
    
    if (skipExistingWinners) {
      UI.updateProgress(30, 'Checking for existing winners...');
      const winners = await Database.getFromStore('winners');
      console.log('Total winners in database:', winners.length);
      
      const winnerIds = new Set();
      
      // Collect all winner IDs (unique IDs only, not names)
      winners.forEach(winner => {
        // Check for original entry ID (preferred)
        if (winner.originalEntry?.id) {
          winnerIds.add(winner.originalEntry.id);
        }
        // Also check entryId field
        if (winner.entryId) {
          winnerIds.add(winner.entryId);
        }
        // Check winnerId as fallback (in case it was used as the record ID)
        if (winner.winnerId) {
          winnerIds.add(winner.winnerId);
        }
      });
      
      console.log('Winner IDs collected:', winnerIds.size);

      // Filter the data - match by ID only
      dataToUpload = pendingCSVData.data.filter((row, index) => {
        const entryId = generateEntryId(row, index, idConfig);
        
        const isWinner = winnerIds.has(entryId);
        
        if (isWinner) {
          const displayName = nameConfig.replace(/\{([^}]+)\}/g, (match, key) => {
            return row[key.trim()] || '';
          }).trim();
          console.log(`Skipping winner by ID match: "${displayName}" (ID: ${entryId})`);
          skippedCount++;
          return false;
        }
        return true;
      });
      
      if (skippedCount > 0) {
        UI.showToast(`Skipping ${skippedCount} records that have already won prizes`, 'info');
      }
      
      if (dataToUpload.length === 0) {
        UI.hideProgress();
        UI.showToast('All records in this file have already won prizes. No new records to upload.', 'warning');
        return;
      }
    }

    UI.updateProgress(35, 'Creating list structure...');

    const listId = UI.generateId();
    const listData = {
      listId: listId,
      metadata: {
        listId: listId,
        name: pendingCSVData.listName,
        timestamp: Date.now(),
        originalFilename: pendingCSVData.fileName,
        entryCount: dataToUpload.length,
        originalCount: pendingCSVData.data.length,
        skippedWinners: skippedCount,
        nameConfig: nameConfig,
        infoConfig: infoConfig,
        idConfig: idConfig
      },
      entries: dataToUpload.map((row, index) => ({
        id: generateEntryId(row, index, idConfig),
        index: index,
        data: row
      }))
    };

    UI.updateProgress(50, 'Saving locally...');
    
    // Save list (handles sharding automatically for large lists)
    await Database.saveToStore('lists', listData, {
      onProgress: (progress, message) => {
        UI.updateProgress(50 + (progress * 0.4), message); // Scale progress to 50-90%
      }
    });
    
    UI.updateProgress(100, 'Complete! Syncing to cloud in background...');
    
    // Hide progress after a short delay to show completion
    setTimeout(() => {
      UI.hideProgress();
    }, 1000);

    const entriesText = dataToUpload.length > 1000 ? 
      `${dataToUpload.length} entries (auto-sharded for optimal performance)` :
      `${dataToUpload.length} entries`;
    
    const skippedText = skippedCount > 0 ? ` (${skippedCount} duplicates skipped)` : '';
      
    UI.showToast(`List "${pendingCSVData.listName}" processed successfully with ${entriesText}${skippedText}! 📦 Syncing to cloud...`, 'success');

    // Clear form and hide preview
    document.getElementById('listName').value = '';
    document.getElementById('csvFile').value = '';
    handleCancelUpload();

    pendingCSVData = null;

    // Refresh displays
    await Lists.loadLists();
    await UI.populateQuickSelects();

  } catch (error) {
    UI.hideProgress();
    console.error('Error confirming upload:', error);
    UI.showToast('Error uploading list: ' + error.message, 'error');
  }
}

function getNameConfiguration() {
  const nameTemplateInput = document.getElementById('nameTemplate');
  return nameTemplateInput.value.trim();
}

function getInfoConfiguration() {
  const info1Template = document.getElementById('info1Template');
  const info2Template = document.getElementById('info2Template');
  const info3Template = document.getElementById('info3Template');
  
  return {
    info1: info1Template.value.trim(),
    info2: info2Template.value.trim(), 
    info3: info3Template.value.trim()
  };
}

function getIdConfiguration() {
  const autoGenerateId = document.getElementById('autoGenerateId');
  const useColumnId = document.getElementById('useColumnId');
  const idColumnSelect = document.getElementById('idColumnSelect');

  if (useColumnId.checked) {
    const selectedColumn = idColumnSelect.value;
    if (!selectedColumn) {
      throw new Error('Please select a column for record IDs');
    }
    return {
      source: 'column',
      column: selectedColumn
    };
  } else {
    return {
      source: 'auto'
    };
  }
}

function validateColumnIds(data, columnName) {
  const ids = [];
  const duplicates = [];
  const emptyValues = [];

  for (let i = 0; i < data.length; i++) {
    const value = data[i][columnName];
    const rowNum = i + 1;

    // Check for empty values
    if (!value || value.toString().trim() === '') {
      emptyValues.push(rowNum);
      continue;
    }

    const trimmedValue = value.toString().trim();

    // Check for duplicates
    if (ids.includes(trimmedValue)) {
      duplicates.push({
        value: trimmedValue,
        row: rowNum
      });
    } else {
      ids.push(trimmedValue);
    }
  }

  if (emptyValues.length > 0) {
    return {
      isValid: false,
      error: `Empty ID values found in rows: ${emptyValues.slice(0, 5).join(', ')}${emptyValues.length > 5 ? ` and ${emptyValues.length - 5} more` : ''}`
    };
  }

  if (duplicates.length > 0) {
    const duplicateList = duplicates.slice(0, 3).map(d => `"${d.value}" (row ${d.row})`).join(', ');
    return {
      isValid: false,
      error: `Duplicate ID values found: ${duplicateList}${duplicates.length > 3 ? ` and ${duplicates.length - 3} more` : ''}`
    };
  }

  return {
    isValid: true
  };
}

function generateEntryId(row, index, idConfig) {
  if (idConfig.source === 'column') {
    const value = row[idConfig.column];
    return value ? value.toString().trim() : UI.generateId();
  } else {
    return UI.generateId();
  }
}

function handleCancelUpload() {
  document.getElementById('dataPreviewCard').style.display = 'none';
  document.getElementById('nameConfigCard').style.display = 'none';
  pendingCSVData = null;
  UI.showToast('Upload cancelled', 'info');
}

export const CSVParser = {
  parseCSV,
  handleCSVUpload,
  handleConfirmUpload,
  handleCancelUpload
};

window.CSVParser = CSVParser;