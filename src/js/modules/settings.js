// ================================
// SETTINGS & THEMES
// ================================

import { Database } from './database.js';
import { UI } from './ui.js';

// Application settings with defaults
export let settings = {
  preventDuplicates: false,
  enableSoundEffects: false,
  hideEntryCounts: false,
  fontFamily: 'Open Sans',
  primaryColor: '#6366f1',
  secondaryColor: '#8b5cf6',
  backgroundType: 'gradient',
  customBackgroundImage: null,
  selectedListId: '',
  selectedPrizeId: '',
  winnersCount: 1
};

async function saveSettings() {
  for (const [key, value] of Object.entries(settings)) {
    const settingToSave = { key, value };
    await Database.saveToStore('settings', settingToSave);
    await Database.queueForSync({ id: UI.generateId(), type: 'add_update', collection: 'settings', data: settingToSave });
  }
}

async function loadSettings() {
  try {
    const savedSettings = await Database.getAllFromStore('settings');
    for (const setting of savedSettings) {
      if (settings.hasOwnProperty(setting.key)) {
        settings[setting.key] = setting.value;
      }
    }
  } catch (error) {
    console.warn('Could not load settings:', error);
  }
}

async function handleSaveSettings() {
  try {
    const settingsForm = {
      preventDuplicates: document.getElementById('preventDuplicates')?.checked || settings.preventDuplicates,
      enableSoundEffects: document.getElementById('enableSoundEffects')?.checked || settings.enableSoundEffects,
      hideEntryCounts: document.getElementById('hideEntryCounts')?.checked || settings.hideEntryCounts,
      fontFamily: document.getElementById('fontFamily')?.value || settings.fontFamily,
      primaryColor: document.getElementById('primaryColor')?.value || settings.primaryColor,
      secondaryColor: document.getElementById('secondaryColor')?.value || settings.secondaryColor,
      backgroundType: document.getElementById('backgroundType')?.value || settings.backgroundType
    };

    const selectionState = {
      selectedListId: document.getElementById('quickListSelect')?.value || settings.selectedListId,
      selectedPrizeId: document.getElementById('quickPrizeSelect')?.value || settings.selectedPrizeId,
      winnersCount: parseInt(document.getElementById('quickWinnersCount')?.value) || settings.winnersCount
    };

    Object.assign(settings, settingsForm, selectionState);
    await saveSettings();
    applyTheme();
    await UI.populateQuickSelects();
    UI.applyVisibilitySettings();

    UI.showToast('Settings saved successfully', 'success');
  } catch (error) {
    console.error('Error saving settings:', error);
    UI.showToast('Error saving settings: ' + error.message, 'error');
  }
}

function setupTheme() {
  applyTheme();
  loadSettingsToForm();
}

function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty('--primary-color', settings.primaryColor);
  root.style.setProperty('--secondary-color', settings.secondaryColor);
  root.style.setProperty('--font-family', settings.fontFamily);

  const gradient = `linear-gradient(135deg, ${settings.primaryColor} 0%, ${settings.secondaryColor} 100%)`;
  root.style.setProperty('--gradient-bg', gradient);
  document.body.style.fontFamily = `'${settings.fontFamily}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
}

function loadSettingsToForm() {
  const settingsFields = {
    'preventDuplicates': settings.preventDuplicates,
    'enableSoundEffects': settings.enableSoundEffects,
    'hideEntryCounts': settings.hideEntryCounts,
    'fontFamily': settings.fontFamily,
    'primaryColor': settings.primaryColor,
    'secondaryColor': settings.secondaryColor,
    'backgroundType': settings.backgroundType
  };

  for (const [fieldId, value] of Object.entries(settingsFields)) {
    const element = document.getElementById(fieldId);
    if (element) {
      if (element.type === 'checkbox') {
        element.checked = value;
      } else {
        element.value = value;
      }
    }
  }

  const quickListSelect = document.getElementById('quickListSelect');
  const quickPrizeSelect = document.getElementById('quickPrizeSelect');
  const quickWinnersCount = document.getElementById('quickWinnersCount');

  if (quickListSelect && settings.selectedListId) {
    quickListSelect.value = settings.selectedListId;
  }
  if (quickPrizeSelect && settings.selectedPrizeId) {
    quickPrizeSelect.value = settings.selectedPrizeId;
  }
  if (quickWinnersCount && settings.winnersCount) {
    quickWinnersCount.value = settings.winnersCount;
  }
}

function toggleTheme() {
  const body = document.body;
  const themeToggle = document.getElementById('themeToggle');
  const currentTheme = body.getAttribute('data-theme');

  if (currentTheme === 'dark') {
    body.setAttribute('data-theme', 'light');
    themeToggle.innerHTML = '<i class="bi bi-moon-fill"></i>';
  } else {
    body.setAttribute('data-theme', 'dark');
    themeToggle.innerHTML = '<i class="bi bi-sun-fill"></i>';
  }
}

function handleThemePreset(event) {
  const theme = event.currentTarget.getAttribute('data-theme');
  
  const themeConfigs = {
    default: { primaryColor: '#6366f1', secondaryColor: '#8b5cf6', fontFamily: 'Inter' },
    emerald: { primaryColor: '#10b981', secondaryColor: '#06d6a0', fontFamily: 'Inter' },
    ruby: { primaryColor: '#ef4444', secondaryColor: '#f87171', fontFamily: 'Poppins' },
    gold: { primaryColor: '#f59e0b', secondaryColor: '#fbbf24', fontFamily: 'Poppins' },
    ocean: { primaryColor: '#0ea5e9', secondaryColor: '#06b6d4', fontFamily: 'Open Sans' },
    corporate: { primaryColor: '#374151', secondaryColor: '#6b7280', fontFamily: 'Roboto' }
  };

  const config = themeConfigs[theme];
  if (!config) return;

  settings.primaryColor = config.primaryColor;
  settings.secondaryColor = config.secondaryColor;
  settings.fontFamily = config.fontFamily;

  applyTheme();
  loadSettingsToForm();
  saveSettings();

  UI.showToast(`Applied ${theme.charAt(0).toUpperCase() + theme.slice(1)} theme`, 'success');
}

export const Settings = {
  saveSettings,
  loadSettings,
  handleSaveSettings,
  setupTheme,
  applyTheme,
  loadSettingsToForm,
  toggleTheme,
  handleThemePreset,
  updateSettings: function(newSettings) { Object.assign(settings, newSettings); } // Added for external updates
};

window.Settings = Settings;
