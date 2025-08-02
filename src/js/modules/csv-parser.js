// ================================
// CSV PARSING & UPLOAD
// ================================

import { UI } from './ui.js';
import { Lists } from './lists.js';
import { Database } from './firestore-service.js';

let pendingCSVData = null;

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
        data.push(row);
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
  const listNameInput = document.getElementById('listName');
  const csvFileInput = document.getElementById('csvFile');

  const csvFile = csvFileInput.files[0];
  const fileName = csvFile.name.replace(/\.[^/.]+$/, "");
  const listName = listNameInput.value.trim() || fileName;

  if (!listName) {
    // UI.showToast('Please enter a list name', 'warning');
    // return;
  }

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
  const previewCard = document.getElementById('dataPreviewCard');
  const previewHeaders = document.getElementById('previewHeaders');
  const previewBody = document.getElementById('previewBody');

  previewCard.style.display = 'block';
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

  nameConfigCard.style.display = 'block';
  availableFields.innerHTML = '';

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

  function updatePreview() {
    const template = nameTemplateInput.value;
    const previewText = template.replace(/\{([^}]+)\}/g, (match, key) => {
      return firstRow[key] || '';
    });
    namePreview.textContent = previewText;
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

  // Add fresh listeners
  autoGenerateId.addEventListener('change', toggleIdSection);
  useColumnId.addEventListener('change', toggleIdSection);
  nameTemplateInput.addEventListener('input', updatePreview);

  // Initial setup
  updatePreview();
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
    const idConfig = getIdConfiguration();

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

    const listId = UI.generateId();
    const listData = {
      listId: listId,
      metadata: {
        listId: listId,
        name: pendingCSVData.listName,
        timestamp: Date.now(),
        originalFilename: pendingCSVData.fileName,
        entryCount: pendingCSVData.data.length,
        nameConfig: nameConfig,
        idConfig: idConfig
      },
      entries: pendingCSVData.data.map((row, index) => ({
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

    const entriesText = pendingCSVData.data.length > 1000 ? 
      `${pendingCSVData.data.length} entries (auto-sharded for optimal performance)` :
      `${pendingCSVData.data.length} entries`;
      
    UI.showToast(`List "${pendingCSVData.listName}" processed successfully with ${entriesText}! 📦 Syncing to cloud...`, 'success');

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