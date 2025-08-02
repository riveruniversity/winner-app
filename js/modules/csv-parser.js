// ================================
// CSV PARSING & UPLOAD
// ================================

window.CSVParser = (function() {
  
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

    const listName = listNameInput.value.trim();
    const csvFile = csvFileInput.files[0];

    if (!listName) {
      UI.showToast('Please enter a list name', 'warning');
      return;
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
    previewTitle.textContent = `Data Preview - "${listName}" (${data.length} total records, showing first ${previewData.length})`;
    
    showNameConfiguration(headers, data[0]);
    previewCard.scrollIntoView({ behavior: 'smooth' });
    UI.showToast(`Preview ready! Showing first ${previewData.length} of ${data.length} records`, 'info');
  }

  function showNameConfiguration(headers, firstRow) {
    const nameConfigCard = document.getElementById('nameConfigCard');
    const availableFields = document.getElementById('availableFields');
    const nameTemplateInput = document.getElementById('nameTemplate');
    const namePreview = document.getElementById('namePreview');

    nameConfigCard.style.display = 'block';
    availableFields.innerHTML = '';

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

    const defaultTemplate = headers.length > 1 ? `{${headers[0]}} {${headers[1]}}` : `{${headers[0]}}`;
    nameTemplateInput.value = defaultTemplate;

    function updatePreview() {
      const template = nameTemplateInput.value;
      const previewText = template.replace(/\{([^}]+)\}/g, (match, key) => {
        return firstRow[key] || '';
      });
      namePreview.textContent = previewText;
    }

    updatePreview();
    nameTemplateInput.addEventListener('input', updatePreview);
  }

  async function handleConfirmUpload() {
    if (!pendingCSVData) {
      UI.showToast('No data to upload', 'error');
      return;
    }

    try {
      UI.showProgress('Uploading List', 'Creating list...');

      const nameConfig = getNameConfiguration();
      const listId = UI.generateId();
      const listData = {
        listId: listId,
        metadata: {
          listId: listId,
          name: pendingCSVData.listName,
          timestamp: Date.now(),
          originalFilename: pendingCSVData.fileName,
          entryCount: pendingCSVData.data.length,
          nameConfig: nameConfig
        },
        entries: pendingCSVData.data.map((row, index) => ({
          id: UI.generateId(),
          index: index,
          data: row
        }))
      };

      UI.updateProgress(90, 'Saving list...');
      await Database.saveToStore('lists', listData);
      UI.hideProgress();

      UI.showToast(`List "${pendingCSVData.listName}" uploaded successfully with ${pendingCSVData.data.length} entries`, 'success');

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

  function handleCancelUpload() {
    document.getElementById('dataPreviewCard').style.display = 'none';
    document.getElementById('nameConfigCard').style.display = 'none';
    pendingCSVData = null;
    UI.showToast('Upload cancelled', 'info');
  }

  return {
    parseCSV,
    handleCSVUpload,
    handleConfirmUpload,
    handleCancelUpload
  };
})();