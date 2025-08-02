// ================================
// SETTINGS & THEMES
// ================================

window.Settings = (function() {
  
  async function saveSettings() {
    for (const [key, value] of Object.entries(window.settings)) {
      await Database.saveToStore('settings', { key, value });
    }
  }

  async function loadSettings() {
    try {
      const savedSettings = await Database.getAllFromStore('settings');
      for (const setting of savedSettings) {
        if (window.settings.hasOwnProperty(setting.key)) {
          window.settings[setting.key] = setting.value;
        }
      }
    } catch (error) {
      console.warn('Could not load settings:', error);
    }
  }

  async function handleSaveSettings() {
    try {
      const settingsForm = {
        preventDuplicates: document.getElementById('preventDuplicates')?.checked || window.settings.preventDuplicates,
        enableSoundEffects: document.getElementById('enableSoundEffects')?.checked || window.settings.enableSoundEffects,
        hideEntryCounts: document.getElementById('hideEntryCounts')?.checked || window.settings.hideEntryCounts,
        fontFamily: document.getElementById('fontFamily')?.value || window.settings.fontFamily,
        primaryColor: document.getElementById('primaryColor')?.value || window.settings.primaryColor,
        secondaryColor: document.getElementById('secondaryColor')?.value || window.settings.secondaryColor,
        backgroundType: document.getElementById('backgroundType')?.value || window.settings.backgroundType
      };

      const selectionState = {
        selectedListId: document.getElementById('quickListSelect')?.value || window.settings.selectedListId,
        selectedPrizeId: document.getElementById('quickPrizeSelect')?.value || window.settings.selectedPrizeId,
        winnersCount: parseInt(document.getElementById('quickWinnersCount')?.value) || window.settings.winnersCount
      };

      Object.assign(window.settings, settingsForm, selectionState);
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
    root.style.setProperty('--primary-color', window.settings.primaryColor);
    root.style.setProperty('--secondary-color', window.settings.secondaryColor);
    root.style.setProperty('--font-family', window.settings.fontFamily);

    const gradient = `linear-gradient(135deg, ${window.settings.primaryColor} 0%, ${window.settings.secondaryColor} 100%)`;
    root.style.setProperty('--gradient-bg', gradient);
    document.body.style.fontFamily = `'${window.settings.fontFamily}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
  }

  function loadSettingsToForm() {
    const settingsFields = {
      'preventDuplicates': window.settings.preventDuplicates,
      'enableSoundEffects': window.settings.enableSoundEffects,
      'hideEntryCounts': window.settings.hideEntryCounts,
      'fontFamily': window.settings.fontFamily,
      'primaryColor': window.settings.primaryColor,
      'secondaryColor': window.settings.secondaryColor,
      'backgroundType': window.settings.backgroundType
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

    if (quickListSelect && window.settings.selectedListId) {
      quickListSelect.value = window.settings.selectedListId;
    }
    if (quickPrizeSelect && window.settings.selectedPrizeId) {
      quickPrizeSelect.value = window.settings.selectedPrizeId;
    }
    if (quickWinnersCount && window.settings.winnersCount) {
      quickWinnersCount.value = window.settings.winnersCount;
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

    window.settings.primaryColor = config.primaryColor;
    window.settings.secondaryColor = config.secondaryColor;
    window.settings.fontFamily = config.fontFamily;

    applyTheme();
    loadSettingsToForm();
    saveSettings();

    UI.showToast(`Applied ${theme.charAt(0).toUpperCase() + theme.slice(1)} theme`, 'success');
  }

  return {
    saveSettings,
    loadSettings,
    handleSaveSettings,
    setupTheme,
    applyTheme,
    loadSettingsToForm,
    toggleTheme,
    handleThemePreset
  };
})();