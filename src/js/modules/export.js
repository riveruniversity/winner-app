// ================================
// EXPORT FUNCTIONALITY
// ================================

import { Database } from './database.js';
import { DOMUtils } from './dom-utils.js';
import eventManager from './event-manager.js';
import { UI } from './ui.js';
import { Settings } from './settings.js';

async function handleExportWinners() {
  try {
    const allWinners = await Database.getFromStore('winners');
    const lists = await Database.getFromStore('lists');
    
    if (allWinners.length === 0) {
      UI.showToast('No winners to export', 'warning');
      return;
    }

    // Create a map of listId to listName for consistent filtering
    const listNameMap = {};
    lists.forEach(list => {
      const listId = list.listId || list.metadata.listId;
      listNameMap[listId] = list.metadata.name;
    });

    // Get current filter values to apply the same filtering as the table
    const filterPrize = document.getElementById('filterPrize').value;
    const filterList = document.getElementById('filterList').value;
    const filterSelection = document.getElementById('filterSelection').value;

    // Apply the same filters as the loadWinners function
    const filteredWinners = allWinners.filter(winner => {
      const prizeMatch = !filterPrize || winner.prize === filterPrize;
      const listName = listNameMap[winner.listId] || 'Unknown';
      const listMatch = !filterList || listName === filterList;
      const selectionMatch = !filterSelection || winner.historyId === filterSelection;
      return prizeMatch && listMatch && selectionMatch;
    });

    if (filteredWinners.length === 0) {
      UI.showToast('No winners match the current filters to export', 'warning');
      return;
    }

    // Use winnerId for export (show first 5 characters)
    const winnersWithIds = filteredWinners;

    // Create CSV content
    const headers = ['TicketID', 'Name', 'Prize', 'Timestamp', 'ListName'];
    
    // Add all original record fields as headers
    const allFields = new Set();
    winnersWithIds.forEach(winner => {
      if (winner.originalEntry && winner.originalEntry.data) {
        Object.keys(winner.originalEntry.data).forEach(field => allFields.add(field));
      }
    });
    
    const fieldHeaders = Array.from(allFields);
    const allHeaders = [...headers, ...fieldHeaders];

    const csvContent = [
      allHeaders.join(','),
      ...winnersWithIds.map(winner => {
        const baseData = [
          (winner.winnerId || 'N/A').toString().slice(0, 5).toUpperCase(),
          `"${winner.displayName || 'Unknown'}"`,
          `"${winner.prize || 'Unknown'}"`,
          new Date(winner.timestamp).toISOString(),
          `"${listNameMap[winner.listId] || 'Unknown'}"`
        ];

        const fieldData = fieldHeaders.map(field => {
          const value = winner.originalEntry?.data?.[field] || '';
          return `"${value}"`;
        });

        return [...baseData, ...fieldData].join(',');
      })
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `winner-app-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show appropriate message based on filtering status
    const activeFilters = [filterPrize, filterList, filterSelection].filter(f => f).length;
    const message = activeFilters > 0 
      ? `Exported ${filteredWinners.length} filtered winners to CSV (${allWinners.length} total)`
      : `Exported ${filteredWinners.length} winners to CSV`;
    
    UI.showToast(message, 'success');

  } catch (error) {
    console.error('Error exporting winners:', error);
    UI.showToast('Error exporting winners: ' + error.message, 'error');
  }
}

async function handleBackupData() {
  try {
    UI.showProgress('Creating Backup', 'Collecting data...');

    const backupData = {
      version: '1.0',
      timestamp: Date.now(),
      lists: await Database.getFromStore('lists'),
      prizes: await Database.getFromStore('prizes'),
      winners: await Database.getFromStore('winners'),
      history: await Database.getFromStore('history'),
      settings: Settings.settings // Use imported Settings
    };

    const dataStr = JSON.stringify(backupData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const url = URL.createObjectURL(dataBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `winner-app-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    UI.hideProgress();
    UI.showToast('Backup created successfully', 'success');

  } catch (error) {
    UI.hideProgress();
    console.error('Error creating backup:', error);
    UI.showToast('Error creating backup: ' + error.message, 'error');
  }
}

function handleRestoreData() {
  const input = document.getElementById('restoreFileInput');
  if (input) {
    input.click();
    input.onchange = processRestoreFile;
  }
}

async function processRestoreFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    UI.showProgress('Restoring Data', 'Reading backup file...');

    const jsonText = await UI.readFileAsText(file);
    const backupData = JSON.parse(jsonText);

    if (!backupData.version) {
      throw new Error('Invalid backup file format');
    }

    UI.updateProgress(25, 'Restoring lists...');
    if (backupData.lists) {
      for (const list of backupData.lists) {
        await Database.saveToStore('lists', list);
      }
    }

    UI.updateProgress(50, 'Restoring prizes...');
    if (backupData.prizes) {
      for (const prize of backupData.prizes) {
        await Database.saveToStore('prizes', prize);
      }
    }

    UI.updateProgress(75, 'Restoring winners and history...');
    if (backupData.winners) {
      for (const winner of backupData.winners) {
        await Database.saveToStore('winners', winner);
      }
    }

    if (backupData.history) {
      for (const historyEntry of backupData.history) {
        await Database.saveToStore('history', historyEntry);
      }
    }

    if (backupData.settings) {
      Settings.updateSettings(backupData.settings); // Use imported Settings
      await Settings.saveSettings();
      // Settings.saveSettings already queues for sync, so no need to queue here again
      Settings.applyTheme();
      Settings.loadSettingsToForm();
    }

    UI.updateProgress(100, 'Finalizing...');

    setTimeout(async () => {
      UI.hideProgress();
      UI.showToast('Data restored successfully', 'success');

      // This needs to be handled by app.js or a central orchestrator
      // await initializeApp(); 
      // For now, we'll just reload the page to ensure full UI refresh
      location.reload();
    }, 500);

  } catch (error) {
    UI.hideProgress();
    console.error('Error restoring data:', error);
    UI.showToast('Error restoring data: ' + error.message, 'error');
  }

  // Clear the input
  event.target.value = '';
}

// Clean data for Firestore by removing undefined values
function cleanDataForFirestore(obj) {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => cleanDataForFirestore(item)).filter(item => item !== undefined);
  }
  
  if (typeof obj === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = cleanDataForFirestore(value);
      // Only include the field if it's not undefined
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
      }
    }
    return cleaned;
  }
  
  // For primitive values, return as-is (including null, but not undefined)
  return obj;
}

// Helper function to format backup size info
function formatBackupSize(backup) {
  const dataSize = JSON.stringify(backup.data || {}).length;
  const sizeKB = (dataSize / 1024).toFixed(1);
  return `${sizeKB} KB`;
}

// Global function for backup selection (called from modal HTML)
window.selectBackup = async function(backupId) {
  try {
    // Close the modal
    if (window.appModal) {
      window.appModal.hide();
    }
    
    // Perform the restore
    await performOnlineRestore(backupId);
  } catch (error) {
    console.error('Error selecting backup:', error);
    UI.showToast('Error selecting backup: ' + error.message, 'error');
  }
};

// Global function for backup deletion (called from modal HTML)
window.deleteBackup = async function(backupId) {
  try {
    // Confirm deletion
    if (!confirm('Are you sure you want to delete this backup? This action cannot be undone.')) {
      return;
    }
    
    // Delete the backup
    await Database.deleteFromStore('backups', backupId);
    
    // Remove from UI
    const backupElement = document.getElementById(`backup-${backupId}`);
    if (backupElement) {
      backupElement.style.opacity = '0.5';
      backupElement.style.transition = 'opacity 0.3s';
      setTimeout(() => {
        backupElement.remove();
        
        // Check if any backups remain
        const remainingBackups = document.querySelectorAll('.backup-option');
        if (remainingBackups.length === 0) {
          // Close modal and show message
          if (window.appModal) {
            window.appModal.hide();
          }
          UI.showToast('All backups deleted. No backups remaining.', 'info');
        }
      }, 300);
    }
    
    UI.showToast('Backup deleted successfully', 'success');
  } catch (error) {
    console.error('Error deleting backup:', error);
    UI.showToast('Error deleting backup: ' + error.message, 'error');
  }
};

// Online backup functions (using Firestore cloud storage)
async function handleBackupOnline() {
  try {
    // Auto-generate default backup name with ISO date and time
    const now = new Date();
    const defaultBackupName = now.toISOString().replace('T', ' ').substring(0, 19); // "2024-12-15 14:30:25"
    
    // Show modal to get optional backup name
    const modalContent = `
      <div class="mb-3">
        <label for="backupNameInput" class="form-label">Backup Name (optional)</label>
        <input type="text" class="form-control" id="backupNameInput" 
               placeholder="${defaultBackupName}" 
               value="${defaultBackupName}">
        <small class="text-muted">Leave as default or enter a custom name for this backup</small>
      </div>
    `;
    
    UI.showConfirmationModal('Create Online Backup', modalContent, async () => {
      const customName = document.getElementById('backupNameInput')?.value?.trim();
      const backupName = customName || defaultBackupName;
      
      UI.showProgress('Creating Online Backup', 'Collecting data...');
      
      const backupData = {
        version: '1.0',
        timestamp: Date.now(),
        lists: await Database.getFromStore('lists'),
        prizes: await Database.getFromStore('prizes'),
        winners: await Database.getFromStore('winners'),
        history: await Database.getFromStore('history'),
        settings: Settings.settings
      };

      // Generate a unique backup ID
      const backupId = generateBackupId();
      
      // Clean backup data to remove undefined values (Firestore doesn't allow them)
      const cleanedBackupData = cleanDataForFirestore(backupData);
      
      // Store the complete backup data in Firestore
      await Database.saveToStore('backups', {
        backupId: backupId,
        name: backupName,
        timestamp: Date.now(),
        description: `Backup created at ${new Date().toLocaleString()}`,
        data: cleanedBackupData // Store the cleaned backup data
      });

      UI.hideProgress();
      
      // Show success message
      UI.showToast(`Backup "${backupName}" created successfully!`, 'success');
    });

  } catch (error) {
    UI.hideProgress();
    console.error('Error creating online backup:', error);
    UI.showToast('Error creating online backup: ' + error.message, 'error');
  }
}

async function handleRestoreOnline() {
  try {
    UI.showProgress('Loading Backups', 'Fetching available backups...');
    
    // Get all available backups
    const backups = await Database.getFromStore('backups');
    
    UI.hideProgress();
    
    if (backups.length === 0) {
      UI.showToast('No cloud backups found', 'info');
      return;
    }
    
    // Sort backups by timestamp (newest first)
    backups.sort((a, b) => b.timestamp - a.timestamp);
    
    // Create backup selection UI with delete buttons
    const backupOptions = backups.map(backup => 
      `<div class="backup-option mb-2 p-3 border rounded" style="transition: all 0.2s;" 
           id="backup-${backup.backupId}">
        <div class="d-flex justify-content-between align-items-start">
          <div style="flex-grow: 1; cursor: pointer;" 
               onclick="selectBackup('${backup.backupId}')"
               onmouseover="this.parentElement.parentElement.style.backgroundColor='#f8f9fa'; this.parentElement.parentElement.style.borderColor='#007bff';" 
               onmouseout="this.parentElement.parentElement.style.backgroundColor=''; this.parentElement.parentElement.style.borderColor='';">
            <h6 class="mb-1"><i class="bi bi-cloud-arrow-down me-2"></i>${backup.name}</h6>
            <small class="text-muted">${backup.description}</small>
          </div>
          <div class="text-end">
            <small class="text-muted d-block">${formatBackupSize(backup)}</small>
            <div class="btn-group btn-group-sm mt-1" role="group">
              <button class="btn btn-outline-success" onclick="selectBackup('${backup.backupId}')" 
                      title="Restore" data-bs-toggle="tooltip" data-bs-placement="top">
                <i class="bi bi-arrow-down-circle" style="font-size: 0.875rem;"></i>
              </button>
              <button class="btn btn-outline-danger" onclick="deleteBackup('${backup.backupId}')"
                      title="Delete" data-bs-toggle="tooltip" data-bs-placement="top">
                <i class="bi bi-trash" style="font-size: 0.875rem;"></i>
              </button>
            </div>
          </div>
        </div>
      </div>`
    ).join('');
    
    UI.showConfirmationModal('Select Backup to Restore', 
      `<div class="mb-3">
        <p>Choose a backup to restore or delete:</p>
        <div style="max-height: 400px; overflow-y: auto;">
          ${backupOptions}
        </div>
      </div>`, 
      () => {}
    );
    
  } catch (error) {
    UI.hideProgress();
    console.error('Error loading backups:', error);
    UI.showToast('Error loading backups: ' + error.message, 'error');
  }
}

async function performOnlineRestore(backupId) {
  try {
    UI.showProgress('Restoring Online Backup', 'Downloading backup data...');

    // Get backup from Firestore
    const backup = await Database.getFromStore('backups', backupId);
    
    if (!backup || !backup.data) {
      throw new Error('Backup ID not found or backup data is corrupted');
    }

    const backupData = backup.data;

    // Use existing restore logic from handleRestoreData
    await restoreBackupData(backupData);

    UI.hideProgress();
    UI.showToast('Online backup restored successfully!', 'success');

  } catch (error) {
    UI.hideProgress();
    console.error('Error restoring online backup:', error);
    UI.showToast('Error restoring online backup: ' + error.message, 'error');
  }
}

function generateBackupId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Extract common restore logic
async function restoreBackupData(backupData) {
  if (!backupData.version) {
    throw new Error('Invalid backup file format');
  }

  UI.updateProgress(20, 'Restoring lists...');
  if (backupData.lists) {
    for (const list of backupData.lists) {
      await Database.saveToStore('lists', list);
    }
  }

  UI.updateProgress(40, 'Restoring prizes...');
  if (backupData.prizes) {
    for (const prize of backupData.prizes) {
      await Database.saveToStore('prizes', prize);
    }
  }

  UI.updateProgress(60, 'Restoring winners...');
  if (backupData.winners) {
    for (const winner of backupData.winners) {
      await Database.saveToStore('winners', winner);
    }
  }

  UI.updateProgress(80, 'Restoring history...');
  if (backupData.history) {
    for (const historyEntry of backupData.history) {
      await Database.saveToStore('history', historyEntry);
    }
  }

  UI.updateProgress(90, 'Restoring settings...');
  if (backupData.settings) {
    Settings.updateSettings(backupData.settings);
  }

  UI.updateProgress(100, 'Finalizing...');

  setTimeout(() => {
    location.reload(); // Reload to ensure full UI refresh
  }, 500);
}

export const Export = {
  handleExportWinners,
  handleBackupData,
  handleRestoreData,
  processRestoreFile,
  handleBackupOnline,
  handleRestoreOnline
};

window.Export = Export;