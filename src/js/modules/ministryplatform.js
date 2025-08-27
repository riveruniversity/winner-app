// MinistryPlatform Integration Module
import { UI } from './ui.js';
import { Lists } from './lists.js';
import { Database } from './database.js';

class MinistryPlatformModule {
  constructor() {
    this.modal = null;
    this.queries = [];
    this.currentQuery = null;
    this.currentData = null;
  }

  async init() {
    // Initialize modal
    const modalElement = document.getElementById('mpImportModal');
    if (modalElement) {
      this.modal = new bootstrap.Modal(modalElement);
    }

    // Set up event listeners
    this.setupEventListeners();
    
    // Load available queries when modal opens
    modalElement?.addEventListener('show.bs.modal', () => {
      this.loadQueries();
    });
  }

  setupEventListeners() {
    // Add from MP button
    const addFromMPBtn = document.getElementById('addFromMPBtn');
    addFromMPBtn?.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent anchor default behavior
      this.showModal();
    });

    // Query selection change
    const querySelect = document.getElementById('mpQuerySelect');
    querySelect?.addEventListener('change', (e) => {
      this.onQuerySelect(e.target.value);
    });

    // Execute query button
    const executeBtn = document.getElementById('mpExecuteBtn');
    executeBtn?.addEventListener('click', () => {
      this.executeQuery();
    });

    // Import button
    const importBtn = document.getElementById('mpImportBtn');
    importBtn?.addEventListener('click', () => {
      this.importData();
    });
  }

  showModal() {
    if (this.modal) {
      this.modal.show();
    }
  }

  async loadQueries() {
    try {
      const querySelect = document.getElementById('mpQuerySelect');
      const errorAlert = document.getElementById('mpErrorAlert');
      
      // Hide error alert
      errorAlert.style.display = 'none';
      
      // Load queries from server
      const response = await fetch('/api/mp/queries');
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load queries');
      }
      
      this.queries = result.queries;
      
      // Populate query dropdown
      querySelect.innerHTML = '<option value="">Select a query...</option>';
      
      // Group queries by category
      const categories = {};
      this.queries.forEach(query => {
        const category = query.category || 'Other';
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push(query);
      });
      
      // Add grouped options
      for (const [category, queries] of Object.entries(categories)) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = category;
        
        queries.forEach(query => {
          const option = document.createElement('option');
          option.value = query.id;
          option.textContent = query.name;
          optgroup.appendChild(option);
        });
        
        querySelect.appendChild(optgroup);
      }
      
      // Reset form
      this.resetForm();
      
    } catch (error) {
      console.error('Error loading MP queries:', error);
      this.showError(error.message);
    }
  }

  onQuerySelect(queryId) {
    const descriptionDiv = document.getElementById('mpQueryDescription');
    const parametersSection = document.getElementById('mpParametersSection');
    const parametersContainer = document.getElementById('mpParametersContainer');
    const executeBtn = document.getElementById('mpExecuteBtn');
    
    if (!queryId) {
      descriptionDiv.textContent = '';
      parametersSection.style.display = 'none';
      executeBtn.disabled = true;
      this.currentQuery = null;
      return;
    }
    
    // Find selected query
    this.currentQuery = this.queries.find(q => q.id === queryId);
    if (!this.currentQuery) return;
    
    // Show description
    descriptionDiv.textContent = this.currentQuery.description || '';
    
    // Show parameters if needed
    if (this.currentQuery.params && Object.keys(this.currentQuery.params).length > 0) {
      parametersSection.style.display = 'block';
      parametersContainer.innerHTML = '';
      
      // Create input fields for parameters
      for (const [paramName, paramConfig] of Object.entries(this.currentQuery.params)) {
        const div = document.createElement('div');
        div.className = 'mb-3';
        
        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = paramConfig.label || paramName;
        if (paramConfig.required) {
          label.innerHTML += ' <span class="text-danger">*</span>';
        }
        
        const input = document.createElement('input');
        input.type = paramConfig.type === 'number' ? 'number' : 'text';
        input.className = 'form-control';
        input.id = `mpParam_${paramName}`;
        input.placeholder = paramConfig.placeholder || `Enter ${paramConfig.label || paramName}`;
        input.required = paramConfig.required || false;
        
        if (paramConfig.defaultValue) {
          input.value = paramConfig.defaultValue;
        }
        
        div.appendChild(label);
        div.appendChild(input);
        
        if (paramConfig.description) {
          const helpText = document.createElement('div');
          helpText.className = 'form-text';
          helpText.textContent = paramConfig.description;
          div.appendChild(helpText);
        }
        
        parametersContainer.appendChild(div);
      }
    } else {
      parametersSection.style.display = 'none';
    }
    
    // Enable execute button
    executeBtn.disabled = false;
    
    // Reset preview
    document.getElementById('mpPreviewSection').style.display = 'none';
    document.getElementById('mpImportBtn').style.display = 'none';
  }

  async executeQuery() {
    try {
      const executeBtn = document.getElementById('mpExecuteBtn');
      const importBtn = document.getElementById('mpImportBtn');
      const errorAlert = document.getElementById('mpErrorAlert');
      const previewSection = document.getElementById('mpPreviewSection');
      
      // Hide error
      errorAlert.style.display = 'none';
      
      // Disable button and show loading
      executeBtn.disabled = true;
      executeBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Executing...';
      
      // Collect parameters
      const params = {};
      if (this.currentQuery.params) {
        for (const paramName of Object.keys(this.currentQuery.params)) {
          const input = document.getElementById(`mpParam_${paramName}`);
          if (input) {
            params[paramName] = input.value;
          }
        }
      }
      
      // Execute query
      const response = await fetch('/api/mp/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          queryId: this.currentQuery.id,
          params: params
        })
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to execute query');
      }
      
      this.currentData = result.data;
      
      // Show preview
      this.showPreview(result.data, result.query.fields);
      
      // Show sections
      previewSection.style.display = 'block';
      importBtn.style.display = 'inline-block';
      
      // Update record count
      document.getElementById('mpRecordCount').textContent = `${result.count} records`;
      
    } catch (error) {
      console.error('Error executing MP query:', error);
      this.showError(error.message);
    } finally {
      const executeBtn = document.getElementById('mpExecuteBtn');
      executeBtn.disabled = false;
      executeBtn.innerHTML = '<i class="bi bi-search me-2"></i>Execute Query';
    }
  }

  showPreview(data, fields) {
    const table = document.getElementById('mpPreviewTable');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    
    if (!data || data.length === 0) {
      thead.innerHTML = '';
      tbody.innerHTML = '<tr><td colspan="100%" class="text-center text-muted">No data returned</td></tr>';
      return;
    }
    
    // Use specified fields or get all fields from first record
    const displayFields = fields || Object.keys(data[0]);
    
    // Create header
    thead.innerHTML = `
      <tr>
        ${displayFields.map(field => `<th>${field}</th>`).join('')}
      </tr>
    `;
    
    // Show first 10 records as preview
    const previewData = data.slice(0, 10);
    tbody.innerHTML = previewData.map(record => `
      <tr>
        ${displayFields.map(field => `<td>${record[field] || ''}</td>`).join('')}
      </tr>
    `).join('');
    
    if (data.length > 10) {
      tbody.innerHTML += `
        <tr>
          <td colspan="${displayFields.length}" class="text-center text-muted">
            ... and ${data.length - 10} more records
          </td>
        </tr>
      `;
    }
  }

async importData() {
    try {
      const listNameInput = document.getElementById('mpListName');
      const importBtn = document.getElementById('mpImportBtn');
      
      // Validate inputs
      if (!listNameInput.value.trim()) {
        throw new Error('Please enter a list name');
      }
      
      if (!this.currentData || this.currentData.length === 0) {
        throw new Error('No data to import');
      }
      
      // Store data for CSV parser
      const listNameValue = listNameInput.value.trim();
      const dataToImport = this.currentData;
      const queryName = this.currentQuery ? this.currentQuery.name : 'Query';
      
      // Close MP modal
      this.modal.hide();
      
      // Pass data to CSV parser's configuration modal
      // Import dynamically to avoid circular dependency
      import('./csv-parser.js').then(({ CSVParser }) => {
        // Set pending data first
        CSVParser.pendingCSVData = {
          listName: listNameValue,
          fileName: `MinistryPlatform_${queryName}.json`,
          data: dataToImport
        };
        // Then show preview
        CSVParser.showCSVPreview(dataToImport, listNameValue);
      });
      
      // Reset form after passing data
      this.resetForm();
      
    } catch (error) {
      console.error('Error importing MP data:', error);
      this.showError(error.message);
      const importBtn = document.getElementById('mpImportBtn');
      importBtn.disabled = false;
      importBtn.innerHTML = '<i class="bi bi-download me-2"></i>Import Data';
    }
  }

  resetForm() {
    // Reset query selection
    document.getElementById('mpQuerySelect').value = '';
    document.getElementById('mpQueryDescription').textContent = '';
    
    // Hide sections
    document.getElementById('mpParametersSection').style.display = 'none';
    document.getElementById('mpPreviewSection').style.display = 'none';
    
    // Reset buttons
    document.getElementById('mpExecuteBtn').disabled = true;
    document.getElementById('mpImportBtn').style.display = 'none';
    
    // Clear inputs
    document.getElementById('mpListName').value = '';
    
    // Clear data
    this.currentQuery = null;
    this.currentData = null;
    
    // Hide error
    document.getElementById('mpErrorAlert').style.display = 'none';
  }

  showError(message) {
    const errorAlert = document.getElementById('mpErrorAlert');
    if (errorAlert) {
      errorAlert.textContent = message;
      errorAlert.style.display = 'block';
    }
  }
}

// Create singleton instance
export const MinistryPlatform = new MinistryPlatformModule();