// ================================
// EXPORT FUNCTIONALITY
// ================================

import { Database } from './firestore-service.js';
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

    // Generate unique 5-character IDs for winners that don't have them
    const winnersWithIds = filteredWinners.map(winner => ({
      ...winner,
      uniqueId: winner.uniqueId || UI.generateId(5).toUpperCase()
    }));

    // Update winners with unique IDs if they didn't have them
    for (const winner of winnersWithIds) {
      if (!winner.uniqueId || winner.winnerId === winner.uniqueId) {
        winner.uniqueId = UI.generateId(5).toUpperCase();
        await Database.saveToStore('winners', winner);
        // No Firebase sync here, as this is a local update for export purposes
      }
    }

    // Create CSV content
    const headers = ['UniqueID', 'Name', 'Prize', 'Timestamp', 'ListName'];
    
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
          winner.uniqueId || winner.winnerId,
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

export const Export = {
  handleExportWinners,
  handleBackupData,
  handleRestoreData,
  processRestoreFile
};

window.Export = Export;