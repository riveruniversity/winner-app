// ================================
// GIVEAWAY REPORTS IMPORT MODULE
// ================================

import { Database } from './database.js';
import { UI } from './ui.js';
import { Lists } from './lists.js';

// Reports API configuration - using proxy to avoid CORS issues
const REPORTS_API_BASE = '/api/reports-proxy';  // Proxy through our server to avoid CORS
const REPORTS_AUTH = {
  username: 'admin',
  password: 'revival'
};

// Initialize report import functionality
function initReportImport() {
  const addFromReportBtn = document.getElementById('addFromReportBtn');
  const importReportBtn = document.getElementById('importReportBtn');
  const timeRangeSelect = document.getElementById('timeRange');
  
  if (addFromReportBtn) {
    addFromReportBtn.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent anchor default behavior
      showReportImportModal();
    });
  }
  
  if (importReportBtn) {
    importReportBtn.addEventListener('click', handleReportImport);
  }
  
  if (timeRangeSelect) {
    timeRangeSelect.addEventListener('change', function() {
      const customTimeRange = document.getElementById('customTimeRange');
      if (this.value === 'custom') {
        customTimeRange.classList.remove('d-none');
      } else {
        customTimeRange.classList.add('d-none');
      }
    });
  }
}

// Show the report import modal
function showReportImportModal() {
  const modal = new bootstrap.Modal(document.getElementById('reportImportModal'));
  
  // Set default list name based on report type and time
  const reportType = document.getElementById('reportType');
  const timeRange = document.getElementById('timeRange');
  const listNameInput = document.getElementById('reportListName');
  
  const updateListName = () => {
    const reportName = reportType.options[reportType.selectedIndex]?.text || '';
    const timeName = timeRange.options[timeRange.selectedIndex]?.text || '';
    
    if (reportName && reportName !== 'Select a report...') {
      const cleanReportName = reportName.replace(' (License Required)', '');
      listNameInput.value = `${cleanReportName} - ${timeName}`;
    }
  };
  
  reportType.addEventListener('change', updateListName);
  timeRange.addEventListener('change', updateListName);
  
  modal.show();
}

// Handle the actual report import
async function handleReportImport() {
  const reportType = document.getElementById('reportType').value;
  const eventId = document.getElementById('eventId').value;
  const timeRange = document.getElementById('timeRange').value;
  const listNameInput = document.getElementById('reportListName');
  
  // Use provided list name, otherwise it will be auto-generated later
  const listName = listNameInput.value.trim() || listNameInput.placeholder || '';
  
  if (!reportType || !eventId || !timeRange) {
    UI.showToast('Please fill in all required fields', 'error');
    return;
  }
  
  try {
    UI.showProgress('Importing Report', 'Fetching data from server...');
    
    // Build API URL with parameters
    const params = new URLSearchParams({
      event_id: eventId,
      report_type: timeRange
    });
    
    // Add custom time parameters if needed
    if (timeRange === 'custom') {
      const customStart = document.getElementById('customStart').value;
      const customEnd = document.getElementById('customEnd').value;
      
      if (!customStart || !customEnd) {
        UI.hideProgress();
        UI.showToast('Please specify custom start and end times', 'error');
        return;
      }
      
      params.append('custom_start', customStart);
      params.append('custom_end', customEnd);
    }
    
    // Fetch the report data
    const response = await fetch(`${REPORTS_API_BASE}/execute/${reportType}?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${REPORTS_AUTH.username}:${REPORTS_AUTH.password}`)
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch report: ${response.status} ${response.statusText}`);
    }
    
    UI.updateProgress(30, 'Parsing CSV data...');
    
    const csvText = await response.text();
    console.log('CSV Response length:', csvText.length);
    console.log('First 500 chars of CSV:', csvText.substring(0, 500));
    
    // Check if we have data or just a message
    if (csvText.trim() === 'No data found' || csvText.trim().length === 0) {
      UI.hideProgress();
      UI.showToast('No entries found in the report for the selected time range', 'warning');
      return;
    }
    
    UI.updateProgress(60, 'Opening CSV configuration...');
    
    // Close the report import modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('reportImportModal'));
    modal.hide();
    
    UI.hideProgress();
    
    // Pass the CSV data to the CSV parser to allow field configuration
    const { CSVParser } = await import('./csv-parser.js');
    
    // Parse the CSV to get data in the right format
    const { data, errors } = CSVParser.parseCSV(csvText);
    
    if (errors.length > 0) {
      UI.showToast('Error parsing report data: ' + errors.join(', '), 'error');
      return;
    }
    
    if (data.length === 0) {
      UI.showToast('No entries found in the report', 'warning');
      return;
    }
    
    // Set up the pending CSV data for the parser
    CSVParser.setPendingCSVData({
      listName: listName,
      fileName: `${reportType}_${eventId}_${timeRange}.csv`,
      data: data,
      source: 'report',
      reportType: reportType,
      eventId: eventId,
      timeRange: timeRange
    });
    
    // Show the CSV preview and configuration dialog
    CSVParser.showCSVPreview(data, listName);
    
    UI.showToast(`Fetched ${data.length} entries. Please configure how to display the data.`, 'success');
    
  } catch (error) {
    console.error('Error importing report:', error);
    UI.hideProgress();
    UI.showToast('Error importing report: ' + error.message, 'error');
  }
}

// Parse CSV text into entries array
function parseReportCSV(csvText) {
  const lines = csvText.trim().split('\n');
  console.log('Total lines in CSV:', lines.length);
  
  if (lines.length < 2) {
    console.log('CSV has less than 2 lines, returning empty');
    return [];
  }
  
  // Parse headers
  const headers = parseCSVLine(lines[0]);
  console.log('Headers:', headers);
  const entries = [];
  
  // Parse each data row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    const values = parseCSVLine(line);
    if (values.length !== headers.length) {
      console.log(`Line ${i} has ${values.length} values but expected ${headers.length}, skipping`);
      continue;
    }
    
    // Create entry object
    const data = {};
    headers.forEach((header, index) => {
      data[header] = values[index];
    });
    
    // Create entry with required structure
    entries.push({
      id: data['Ticket Code'] || UI.generateId(),
      index: i - 1,
      data: data
    });
  }
  
  return entries;
}

// Parse a single CSV line handling quoted values
function parseCSVLine(line) {
  const values = [];
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
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add last value
  values.push(current.trim());
  
  return values;
}

export const Reports = {
  initReportImport,
  showReportImportModal,
  handleReportImport,
  parseReportCSV
};

window.Reports = Reports;
