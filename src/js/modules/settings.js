// ================================
// SETTINGS & THEMES
// ================================

import { Database } from './firestore.js';
import { UI } from './ui.js';

// Application settings with defaults
export let settings = {
  preventDuplicates: false,
  hideEntryCounts: false,
  enableDebugLogs: false,
  fontFamily: 'Open Sans',
  primaryColor: '#6366f1',
  secondaryColor: '#8b5cf6',
  backgroundType: 'gradient',
  customBackgroundImage: null,
  selectedListId: '',
  selectedPrizeId: '',
  winnersCount: 1,
  enableWebhook: false,
  webhookUrl: '',
  selectionMode: 'all-at-once',
  preSelectionDelay: 0,
  delayVisualType: 'none',
  displayEffect: 'fade-in',
  displayDuration: 0.5,
  soundDuringDelay: 'none',
  soundEndOfDelay: 'none',
  soundDuringReveal: 'none',
  celebrationEffect: 'confetti',
  celebrationDuration: 4,
  celebrationAutoTrigger: true
};

async function saveSettings() {
  for (const [key, value] of Object.entries(settings)) {
    const settingToSave = { key, value };
    await Database.saveToStore('settings', settingToSave);
  }
}

// Save individual setting efficiently (only updates one setting)
async function saveSingleSetting(key, value) {
  try {
    // Update local settings object
    settings[key] = value;
    
    // Save only this single setting to database
    const settingToSave = { key, value };
    await Database.saveToStore('settings', settingToSave);
    
    debugLog(`Single setting saved: ${key} = ${value}`);
  } catch (error) {
    console.error(`Error saving single setting ${key}:`, error);
    throw error;
  }
}

// Batch save multiple settings efficiently (for related changes)
async function saveMultipleSettings(settingsToSave) {
  try {
    // Update local settings object
    Object.assign(settings, settingsToSave);
    
    // Save only the changed settings
    const savePromises = [];
    for (const [key, value] of Object.entries(settingsToSave)) {
      const settingToSave = { key, value };
      savePromises.push(Database.saveToStore('settings', settingToSave));
    }
    
    await Promise.all(savePromises);
    debugLog(`Batch settings saved:`, settingsToSave);
  } catch (error) {
    console.error('Error saving multiple settings:', error);
    throw error;
  }
}

async function loadSettings() {
  try {
    const savedSettings = await Database.getFromStore('settings');
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
      hideEntryCounts: document.getElementById('hideEntryCounts')?.checked || settings.hideEntryCounts,
      enableDebugLogs: document.getElementById('enableDebugLogs')?.checked || settings.enableDebugLogs,
      fontFamily: document.getElementById('fontFamily')?.value || settings.fontFamily,
      primaryColor: document.getElementById('primaryColor')?.value || settings.primaryColor,
      secondaryColor: document.getElementById('secondaryColor')?.value || settings.secondaryColor,
      backgroundType: document.getElementById('backgroundType')?.value || settings.backgroundType,
      enableWebhook: document.getElementById('enableWebhook')?.checked || settings.enableWebhook,
      webhookUrl: document.getElementById('webhookUrl')?.value || settings.webhookUrl
    };

    const selectionState = {
      selectedListId: document.getElementById('quickListSelect')?.value || settings.selectedListId,
      selectedPrizeId: document.getElementById('quickPrizeSelect')?.value || settings.selectedPrizeId,
      winnersCount: parseInt(document.getElementById('quickWinnersCount')?.value) || settings.winnersCount,
      selectionMode: document.getElementById('selectionMode')?.value || settings.selectionMode,
      preSelectionDelay: parseFloat(document.getElementById('preSelectionDelay')?.value) || settings.preSelectionDelay,
      delayVisualType: document.getElementById('delayVisualType')?.value || settings.delayVisualType,
      displayEffect: document.getElementById('displayEffect')?.value || settings.displayEffect,
      displayDuration: parseFloat(document.getElementById('displayDuration')?.value) || settings.displayDuration,
      soundDuringDelay: document.getElementById('soundDuringDelay')?.value || settings.soundDuringDelay,
      soundEndOfDelay: document.getElementById('soundEndOfDelay')?.value || settings.soundEndOfDelay,
      soundDuringReveal: document.getElementById('soundDuringReveal')?.value || settings.soundDuringReveal
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
  setupSoundTestButtons();
  
  // Initialize sound dropdowns when available, then reload sound settings
  setTimeout(() => {
    if (window.Sounds && window.Sounds.updateSoundDropdowns) {
      window.Sounds.updateSoundDropdowns();
      debugLog('Sound dropdowns updated from setupTheme');
      
      // Reload sound settings after dropdowns are populated
      loadSoundSettingsToForm();
    } else {
      debugLog('Sounds module not available yet in setupTheme');
    }
  }, 500);
}

// Load only sound settings to form (called after sound dropdowns are updated)
function loadSoundSettingsToForm() {
  const soundFields = {
    'soundDuringDelay': settings.soundDuringDelay,
    'soundEndOfDelay': settings.soundEndOfDelay,
    'soundDuringReveal': settings.soundDuringReveal
  };
  
  for (const [fieldId, value] of Object.entries(soundFields)) {
    const element = document.getElementById(fieldId);
    if (element && value) {
      // Check if the option exists in the dropdown
      const option = element.querySelector(`option[value="${value}"]`);
      if (option) {
        element.value = value;
        debugLog(`Restored sound setting ${fieldId} = ${value}`);
      } else {
        debugLog(`Sound option ${value} not found for ${fieldId}, keeping current value`);
      }
    }
  }
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
    'hideEntryCounts': settings.hideEntryCounts,
    'enableDebugLogs': settings.enableDebugLogs,
    'fontFamily': settings.fontFamily,
    'primaryColor': settings.primaryColor,
    'secondaryColor': settings.secondaryColor,
    'backgroundType': settings.backgroundType,
    'enableWebhook': settings.enableWebhook,
    'webhookUrl': settings.webhookUrl
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

  // Load new selection settings
  const selectionMode = document.getElementById('selectionMode');
  const preSelectionDelay = document.getElementById('preSelectionDelay');
  const delayVisualType = document.getElementById('delayVisualType');
  const displayEffect = document.getElementById('displayEffect');
  const displayDuration = document.getElementById('displayDuration');
  
  if (selectionMode && settings.selectionMode) {
    selectionMode.value = settings.selectionMode;
  }
  if (preSelectionDelay && settings.preSelectionDelay !== undefined) {
    preSelectionDelay.value = settings.preSelectionDelay;
  }
  if (delayVisualType && settings.delayVisualType) {
    delayVisualType.value = settings.delayVisualType;
  }
  if (displayEffect && settings.displayEffect) {
    displayEffect.value = settings.displayEffect;
  }
  if (displayDuration && settings.displayDuration !== undefined) {
    displayDuration.value = settings.displayDuration;
  }
  
  // Load sound settings
  const soundDuringDelay = document.getElementById('soundDuringDelay');
  const soundEndOfDelay = document.getElementById('soundEndOfDelay');
  const soundDuringReveal = document.getElementById('soundDuringReveal');
  
  if (soundDuringDelay && settings.soundDuringDelay) {
    soundDuringDelay.value = settings.soundDuringDelay;
  }
  if (soundEndOfDelay && settings.soundEndOfDelay) {
    soundEndOfDelay.value = settings.soundEndOfDelay;
  }
  if (soundDuringReveal && settings.soundDuringReveal) {
    soundDuringReveal.value = settings.soundDuringReveal;
  }
}

function toggleTheme() {
  const body = document.body;
  const themeToggle = document.getElementById('themeToggle');
  const currentTheme = body.getAttribute('data-theme');

  if (currentTheme === 'dark') {
    body.setAttribute('data-theme', 'light');
    themeToggle.innerHTML = '<i class="bi bi-moon-fill"></i>';
    themeToggle.classList.remove('dark');
  } else {
    body.setAttribute('data-theme', 'dark');
    themeToggle.innerHTML = '<i class="bi bi-sun-fill"></i>';
    themeToggle.classList.add('dark');
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

function setupWebhookToggle() {
  const enableWebhook = document.getElementById('enableWebhook');
  const webhookUrl = document.getElementById('webhookUrl');
  
  if (enableWebhook && webhookUrl) {
    enableWebhook.addEventListener('change', function() {
      webhookUrl.disabled = !this.checked;
      if (!this.checked) {
        webhookUrl.value = '';
      }
    });
    
    // Set initial state
    webhookUrl.disabled = !enableWebhook.checked;
  }
}

async function triggerWebhook(webhookData) {
  if (!settings.enableWebhook || !settings.webhookUrl) {
    return;
  }

  try {
    const payload = {
      timestamp: Date.now(),
      ...webhookData
    };

    debugLog('Sending webhook to:', settings.webhookUrl);
    debugLog('Payload:', payload);

    let response;
    try {
      // Try POST first with bypass service worker to avoid caching issues
      response = await fetch(settings.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(payload),
        cache: 'no-store' // Bypass service worker cache
      });
    } catch (corsError) {
      console.warn('POST request failed, trying with query parameters:', corsError);
      
      // Method 2: Fallback to GET with only event in query parameters  
      const queryParams = new URLSearchParams({
        event: webhookData.event || 'winners_selected',
        timestamp: Date.now().toString()
      });
      
      response = await fetch(`${settings.webhookUrl}?${queryParams.toString()}`, {
        method: 'GET',
        cache: 'no-store' // Bypass service worker cache
      });
    }

    if (!response.ok) {
      throw new Error(`Webhook failed with status: ${response.status} - ${response.statusText}`);
    }

    const responseText = await response.text();
    debugLog('Webhook response:', responseText);
    debugLog('Webhook notification sent successfully');
    
  } catch (error) {
    console.error('Webhook notification failed:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    
    // Don't show error toast for webhook failures to avoid disrupting user experience
    console.warn('Webhook failed silently - user experience not affected');
  }
}

function showDelayDisplay(delaySeconds, displayType) {
  debugLog('showDelayDisplay called with:', delaySeconds, displayType);
  
  if (delaySeconds <= 0) {
    debugLog('No delay - returning immediately');
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const overlay = document.getElementById('delayOverlay');
    const spinner = document.getElementById('delaySpinner');
    const countdown = document.getElementById('delayCountdown');
    const progress = document.getElementById('delayProgress');
    const dots = document.getElementById('delayDots');

    debugLog('Elements found:', { 
      overlay: !!overlay, 
      spinner: !!spinner, 
      countdown: !!countdown, 
      progress: !!progress, 
      dots: !!dots 
    });

    if (!overlay) {
      console.error('Delay overlay not found!');
      debugLog('Available elements with "delay" in ID:', 
        Array.from(document.querySelectorAll('[id*="delay"]')).map(el => el.id)
      );
      resolve();
      return;
    }

    // Hide all delay types
    [spinner, countdown, progress, dots].forEach(el => {
      if (el) el.classList.add('d-none');
    });

    // Show overlay
    overlay.classList.remove('d-none');
    debugLog('Overlay shown, display type:', displayType);

    switch (displayType) {
      case 'spinner':
        debugLog('Showing spinner');
        if (spinner) {
          spinner.classList.remove('d-none');
          debugLog('Spinner shown, waiting', delaySeconds, 'seconds');
        } else {
          console.error('Spinner element not found!');
        }
        setTimeout(() => {
          debugLog('Delay complete, hiding overlay');
          overlay.classList.add('d-none');
          resolve();
        }, delaySeconds * 1000);
        break;

      case 'countdown':
        countdown.classList.remove('d-none');
        let count = Math.ceil(delaySeconds);
        const countdownNumber = document.getElementById('delayCountdownNumber');
        countdownNumber.textContent = count;

        const interval = setInterval(() => {
          count--;
          if (count > 0) {
            countdownNumber.textContent = count;
          } else {
            clearInterval(interval);
            overlay.classList.add('d-none');
            resolve();
          }
        }, 1000);
        break;

      case 'progress':
        progress.classList.remove('d-none');
        const progressBar = document.getElementById('delayProgressBar');
        let currentProgress = 0;
        const totalSteps = delaySeconds * 100; // Update every 10ms for smooth animation
        const stepDuration = 10;

        const progressInterval = setInterval(() => {
          currentProgress++;
          const percentage = (currentProgress / totalSteps) * 100;
          progressBar.style.width = percentage + '%';

          if (currentProgress >= totalSteps) {
            clearInterval(progressInterval);
            overlay.classList.add('d-none');
            resolve();
          }
        }, stepDuration);
        break;

      case 'dots':
        dots.classList.remove('d-none');
        setTimeout(() => {
          overlay.classList.add('d-none');
          resolve();
        }, delaySeconds * 1000);
        break;

      case 'animation':
        // Show countdown overlay with particle animation canvas
        const animationCountdownOverlay = document.getElementById('countdownOverlay');
        const animationCountdownNumber = document.getElementById('countdownNumber');
        
        debugLog('Animation case - Elements found:', {
          overlay: !!animationCountdownOverlay,
          number: !!animationCountdownNumber,
          animations: !!window.Animations,
          startParticle: !!(window.Animations && window.Animations.startParticleAnimation)
        });
        
        if (animationCountdownOverlay && animationCountdownNumber) {
          // Hide delay overlay and show countdown overlay
          overlay.classList.add('d-none');
          animationCountdownOverlay.classList.remove('d-none');
          debugLog('Countdown overlay shown for animation');
          
          // Start particle animation
          if (window.Animations && window.Animations.startParticleAnimation) {
            window.Animations.startParticleAnimation();
            debugLog('Particle animation started');
          } else {
            debugLog('Particle animation not available');
          }
          
          let animationCount = Math.ceil(delaySeconds);
          animationCountdownNumber.textContent = animationCount;
          debugLog('Starting countdown from:', animationCount);

          const animationInterval = setInterval(() => {
            animationCount--;
            debugLog('Countdown tick:', animationCount);
            if (animationCount > 0) {
              animationCountdownNumber.textContent = animationCount;
            } else {
              clearInterval(animationInterval);
              animationCountdownOverlay.classList.add('d-none');
              if (window.Animations && window.Animations.stopAnimation) {
                window.Animations.stopAnimation();
              }
              debugLog('Animation countdown completed');
              resolve();
            }
          }, 1000);
        } else {
          debugLog('Animation elements not found, falling back to silent delay');
          overlay.classList.add('d-none');
          setTimeout(resolve, delaySeconds * 1000);
        }
        break;

      case 'swirl-animation':
        // Show countdown overlay with swirl animation canvas
        const swirlCountdownOverlay = document.getElementById('countdownOverlay');
        const swirlCountdownNumber = document.getElementById('countdownNumber');
        
        debugLog('Swirl animation case - Elements found:', {
          overlay: !!swirlCountdownOverlay,
          number: !!swirlCountdownNumber,
          animations: !!window.Animations,
          startSwirl: !!(window.Animations && window.Animations.startSwirlAnimation)
        });
        
        if (swirlCountdownOverlay && swirlCountdownNumber) {
          // Hide delay overlay and show countdown overlay
          overlay.classList.add('d-none');
          swirlCountdownOverlay.classList.remove('d-none');
          debugLog('Countdown overlay shown for swirl animation');
          
          // Start swirl animation
          if (window.Animations && window.Animations.startSwirlAnimation) {
            window.Animations.startSwirlAnimation();
            debugLog('Swirl animation started');
          } else {
            debugLog('Swirl animation not available');
          }
          
          let swirlCount = Math.ceil(delaySeconds);
          swirlCountdownNumber.textContent = swirlCount;
          debugLog('Starting swirl countdown from:', swirlCount);

          const swirlInterval = setInterval(() => {
            swirlCount--;
            debugLog('Swirl countdown tick:', swirlCount);
            if (swirlCount > 0) {
              swirlCountdownNumber.textContent = swirlCount;
            } else {
              clearInterval(swirlInterval);
              swirlCountdownOverlay.classList.add('d-none');
              if (window.Animations && window.Animations.stopAnimation) {
                window.Animations.stopAnimation();
              }
              debugLog('Swirl animation countdown completed');
              resolve();
            }
          }, 1000);
        } else {
          debugLog('Swirl animation elements not found, falling back to silent delay');
          overlay.classList.add('d-none');
          setTimeout(resolve, delaySeconds * 1000);
        }
        break;

      case 'none':
      default:
        // Silent delay - hide overlay immediately and just wait
        overlay.classList.add('d-none');
        setTimeout(resolve, delaySeconds * 1000);
        break;
    }
  });
}

// Test function for debugging delay
function testDelay() {
  // Get current settings from the form
  const delaySeconds = parseFloat(document.getElementById('preSelectionDelay')?.value) || 3;
  const delayVisualType = document.getElementById('delayVisualType')?.value || 'countdown';
  
  debugLog('Testing delay with settings:', delaySeconds, delayVisualType);
  showDelayDisplay(delaySeconds, delayVisualType);
}

// Function to update delay settings quickly - deprecated, no longer needed
function setDelaySettings(delaySeconds, displayType) {
  debugLog('setDelaySettings called but post-display delay has been removed');
}

// Auto-save function for quick setup fields (efficient batch save)
async function autoSaveQuickSetup(triggerElementId = null) {
  try {
    const changedSettings = {};
    
    // Only include settings that have actually changed
    const fieldMappings = {
      'quickListSelect': 'selectedListId',
      'quickPrizeSelect': 'selectedPrizeId', 
      'quickWinnersCount': 'winnersCount',
      'selectionMode': 'selectionMode',
      'preSelectionDelay': 'preSelectionDelay',
      'delayVisualType': 'delayVisualType',
      'displayEffect': 'displayEffect',
      'displayDuration': 'displayDuration',
      'soundDuringDelay': 'soundDuringDelay',
      'soundEndOfDelay': 'soundEndOfDelay',
      'soundDuringReveal': 'soundDuringReveal',
      'celebrationEffect': 'celebrationEffect',
      'celebrationDuration': 'celebrationDuration',
      'celebrationAutoTrigger': 'celebrationAutoTrigger'
    };

    // If a specific element triggered this, only process that element and related ones
    let fieldsToProcess = fieldMappings;
    if (triggerElementId) {
      // Define field groups to prevent cross-contamination
      const fieldGroups = {
        selection: ['quickListSelect', 'quickPrizeSelect', 'quickWinnersCount'],
        timing: ['selectionMode', 'preSelectionDelay', 'delayVisualType'],
        display: ['displayEffect', 'displayDuration'],
        sound: ['soundDuringDelay', 'soundEndOfDelay', 'soundDuringReveal'],
        celebration: ['celebrationEffect', 'celebrationDuration', 'celebrationAutoTrigger']
      };
      
      // Find which group the trigger element belongs to
      let targetGroup = null;
      for (const [groupName, fields] of Object.entries(fieldGroups)) {
        if (fields.includes(triggerElementId)) {
          targetGroup = groupName;
          break;
        }
      }
      
      // Only process fields in the same group
      if (targetGroup) {
        fieldsToProcess = {};
        fieldGroups[targetGroup].forEach(fieldId => {
          if (fieldMappings[fieldId]) {
            fieldsToProcess[fieldId] = fieldMappings[fieldId];
          }
        });
        debugLog(`Processing ${targetGroup} group fields for trigger: ${triggerElementId}`);
      }
    }

    for (const [elementId, settingKey] of Object.entries(fieldsToProcess)) {
      const element = document.getElementById(elementId);
      if (element) {
        debugLog(`Checking field ${elementId} (${settingKey}): element.value="${element.value}", current setting="${settings[settingKey]}"`);
        
        let newValue;
        if (settingKey === 'winnersCount') {
          newValue = parseInt(element.value) || settings[settingKey];
        } else if (settingKey === 'preSelectionDelay' || settingKey === 'displayDuration' || settingKey === 'celebrationDuration') {
          newValue = parseFloat(element.value);
          // Allow 0 as a valid value, only use fallback for NaN
          if (isNaN(newValue)) {
            newValue = settings[settingKey];
          }
        } else if (element.type === 'checkbox') {
          newValue = element.checked;
        } else {
          newValue = element.value || settings[settingKey];
        }
        
        debugLog(`Processed value for ${settingKey}: "${newValue}" (type: ${typeof newValue})`);
        
        // Only add to changedSettings if value actually changed
        if (newValue !== settings[settingKey]) {
          changedSettings[settingKey] = newValue;
          debugLog(`✅ Quick setup detected change for ${settingKey}: ${settings[settingKey]} → ${newValue}`);
        } else {
          debugLog(`❌ No change for ${settingKey}: both are ${newValue}`);
        }
      }
    }

    // Only save if something actually changed
    if (Object.keys(changedSettings).length > 0) {
      await saveMultipleSettings(changedSettings);
      debugLog('Quick setup auto-saved:', Object.keys(changedSettings));
      
      // If quick selection fields changed, update UI displays
      if (changedSettings.selectedListId !== undefined || 
          changedSettings.selectedPrizeId !== undefined || 
          changedSettings.winnersCount !== undefined) {
        updateQuickSelectionUI();
      }
    }
  } catch (error) {
    console.error('Error auto-saving quick setup:', error);
  }
}

// Auto-save function for individual settings (single field changes)
async function autoSaveIndividualSetting(fieldId) {
  try {
    const element = document.getElementById(fieldId);
    if (!element) return;

    let newValue;
    if (element.type === 'checkbox') {
      newValue = element.checked;
    } else {
      newValue = element.value;
    }

    // Map field ID to setting key
    const fieldToSettingMap = {
      'preventDuplicates': 'preventDuplicates',
      'hideEntryCounts': 'hideEntryCounts',
      'celebrationAutoTrigger': 'celebrationAutoTrigger',
      'enableDebugLogs': 'enableDebugLogs',
      'fontFamily': 'fontFamily',
      'primaryColor': 'primaryColor',
      'secondaryColor': 'secondaryColor',
      'backgroundType': 'backgroundType',
      'enableWebhook': 'enableWebhook',
      'webhookUrl': 'webhookUrl'
    };

    const settingKey = fieldToSettingMap[fieldId];
    if (settingKey && newValue !== settings[settingKey]) {
      await saveSingleSetting(settingKey, newValue);
      
      // Apply theme changes immediately for UI settings
      if (['primaryColor', 'secondaryColor', 'fontFamily'].includes(settingKey)) {
        applyTheme();
      }
      
      debugLog(`Individual setting auto-saved: ${settingKey} = ${newValue}`);
    }
  } catch (error) {
    console.error('Error auto-saving individual setting:', error);
    UI.showToast('Error saving setting', 'error');
  }
}

// Legacy function for bulk saves (now more efficient)
async function autoSaveAllSettings() {
  try {
    await handleSaveSettings();
    // Note: handleSaveSettings already shows its own toast, so we don't show another one here
  } catch (error) {
    console.error('Error auto-saving settings:', error);
    UI.showToast('Error saving settings', 'error');
  }
}

// Setup sound test buttons
function setupSoundTestButtons() {
  const testSoundDuringDelay = document.getElementById('testSoundDuringDelay');
  const testSoundEndOfDelay = document.getElementById('testSoundEndOfDelay');
  const testSoundDuringReveal = document.getElementById('testSoundDuringReveal');

  if (testSoundDuringDelay) {
    testSoundDuringDelay.addEventListener('click', () => {
      testSoundEffect('delay');
    });
  }

  if (testSoundEndOfDelay) {
    testSoundEndOfDelay.addEventListener('click', () => {
      testSoundEffect('end');
    });
  }

  if (testSoundDuringReveal) {
    testSoundDuringReveal.addEventListener('click', () => {
      testSoundEffect('reveal');
    });
  }
}

// Test sound effects based on current dropdown selections
function testSoundEffect(phase) {
  if (phase === 'delay') {
    const soundType = document.getElementById('soundDuringDelay')?.value || 'none';
    if (soundType !== 'none') {
      // Import and use the Selection module's playSound function
      import('./selection.js').then(({ Selection }) => {
        Selection.playSound(soundType);
        if (soundType.includes('drum')) {
          setTimeout(() => {
            Selection.playSound('drumroll-stop'); // Stop after 3 seconds for testing
          }, 3000);
        }
      }).catch(error => {
        console.warn('Could not test sound:', error);
      });
    }
  } else if (phase === 'end') {
    const soundType = document.getElementById('soundEndOfDelay')?.value || 'none';
    if (soundType !== 'none') {
      import('./selection.js').then(({ Selection }) => {
        Selection.playSound(soundType);
      }).catch(error => {
        console.warn('Could not test sound:', error);
      });
    }
  } else if (phase === 'reveal') {
    const soundType = document.getElementById('soundDuringReveal')?.value || 'none';
    if (soundType !== 'none') {
      import('./selection.js').then(({ Selection }) => {
        Selection.playSound(soundType);
      }).catch(error => {
        console.warn('Could not test sound:', error);
      });
    }
  }
}

// Store the debounced function and event listeners to prevent duplicates
let debouncedQuickSave = null;
let quickSetupListeners = new Map();

// Setup auto-save listeners for quick setup fields
function setupQuickSetupAutoSave() {
  const quickFields = [
    'quickListSelect',
    'quickPrizeSelect', 
    'quickWinnersCount',
    'selectionMode',
    'preSelectionDelay',
    'delayVisualType',
    'displayEffect',
    'displayDuration',
    'soundDuringDelay',
    'soundEndOfDelay',
    'soundDuringReveal',
    'celebrationEffect',
    'celebrationDuration',
    'celebrationAutoTrigger'
  ];

  // Create the debounced function only once
  if (!debouncedQuickSave) {
    debouncedQuickSave = debounce(() => autoSaveQuickSetup(), 300);
  }

  quickFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      // Remove any existing listeners stored in our map
      if (quickSetupListeners.has(fieldId)) {
        const listeners = quickSetupListeners.get(fieldId);
        listeners.forEach(({ event, handler }) => {
          field.removeEventListener(event, handler);
        });
      }
      
      // Create field-specific handlers that pass the field ID
      const fieldSpecificDebouncedSave = debounce(() => autoSaveQuickSetup(fieldId), 300);
      const fieldSpecificImmediateSave = () => autoSaveQuickSetup(fieldId);
      
      // Create new listeners for this field
      const newListeners = [];
      
      if (field.type === 'number' || field.type === 'text') {
        field.addEventListener('input', fieldSpecificDebouncedSave);
        field.addEventListener('change', fieldSpecificImmediateSave); // Immediate save on blur
        newListeners.push({ event: 'input', handler: fieldSpecificDebouncedSave });
        newListeners.push({ event: 'change', handler: fieldSpecificImmediateSave });
      } else {
        field.addEventListener('change', fieldSpecificImmediateSave);
        newListeners.push({ event: 'change', handler: fieldSpecificImmediateSave });
      }
      
      // Store the listeners for this field
      quickSetupListeners.set(fieldId, newListeners);
      
      debugLog(`Quick setup auto-save listener added for: ${fieldId} (type: ${field.type})`);
    }
  });
}


// Setup auto-save listeners for all settings fields (efficient individual saves)
function setupAllSettingsAutoSave() {
  const allSettingsFields = [
    'preventDuplicates',
    'hideEntryCounts',
    'enableDebugLogs',
    'fontFamily',
    'primaryColor',
    'secondaryColor',
    'backgroundType',
    'enableWebhook',
    'webhookUrl'
  ];

  allSettingsFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      // Create a debounced save function for this specific field
      const debouncedSave = debounce(() => autoSaveIndividualSetting(fieldId), 500);
      
      if (field.type === 'checkbox') {
        field.addEventListener('change', () => autoSaveIndividualSetting(fieldId));
      } else if (field.type === 'color' || field.type === 'url' || field.type === 'text') {
        field.addEventListener('input', debouncedSave); // Debounced for frequent changes
        field.addEventListener('change', () => autoSaveIndividualSetting(fieldId)); // Immediate on blur
      } else {
        field.addEventListener('change', () => autoSaveIndividualSetting(fieldId));
      }
    }
  });
}

// Debounce utility function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Update UI displays when quick selection fields change
function updateQuickSelectionUI() {
  const quickListSelect = document.getElementById('quickListSelect');
  const quickPrizeSelect = document.getElementById('quickPrizeSelect');
  const quickWinnersCount = document.getElementById('quickWinnersCount');

  if (!quickListSelect || !quickPrizeSelect || !quickWinnersCount) return;

  const listOption = quickListSelect.options[quickListSelect.selectedIndex];
  const prizeOption = quickPrizeSelect.options[quickPrizeSelect.selectedIndex];

  const listText = listOption ? listOption.textContent.split(' (')[0] : 'Not Selected';
  const prizeText = prizeOption ? prizeOption.textContent.split(' (')[0] : 'Not Selected';

  // Update display elements
  const currentListDisplay = document.getElementById('currentListDisplay');
  const currentPrizeDisplay = document.getElementById('currentPrizeDisplay');
  const winnersCountDisplay = document.getElementById('winnersCountDisplay');
  
  if (currentListDisplay) currentListDisplay.textContent = listText;
  if (currentPrizeDisplay) currentPrizeDisplay.textContent = prizeText;
  if (winnersCountDisplay) winnersCountDisplay.textContent = quickWinnersCount.value;

  // Update total entries when list changes
  if (quickListSelect.value) {
    updateTotalEntriesFromSettings();
  } else {
    const totalEntriesDisplay = document.getElementById('totalEntriesDisplay');
    if (totalEntriesDisplay) totalEntriesDisplay.textContent = '0';
  }

  // Enable play button only if list and prize are selected
  const bigPlayButton = document.getElementById('bigPlayButton');
  if (bigPlayButton) {
    bigPlayButton.disabled = !quickListSelect.value || !quickPrizeSelect.value;
  }
}

// Update total entries helper function
async function updateTotalEntriesFromSettings() {
  try {
    const quickListSelect = document.getElementById('quickListSelect');
    const listId = quickListSelect?.value;
    if (listId) {
      const list = await Database.getFromStore('lists', listId);
      if (list) {
        const totalEntriesDisplay = document.getElementById('totalEntriesDisplay');
        if (totalEntriesDisplay) {
          totalEntriesDisplay.textContent = list.entries.length;
        }
      }
    }
  } catch (error) {
    console.error('Error updating total entries:', error);
  }
}

// Debug logging utility function
function debugLog(message, ...args) {
  if (settings.enableDebugLogs) {
    console.log(`[DEBUG] ${message}`, ...args);
  }
}

export const Settings = {
  saveSettings,
  saveSingleSetting,
  saveMultipleSettings,
  loadSettings,
  handleSaveSettings,
  setupTheme,
  applyTheme,
  loadSettingsToForm,
  loadSoundSettingsToForm,
  toggleTheme,
  handleThemePreset,
  setupWebhookToggle,
  triggerWebhook,
  showDelayDisplay,
  testDelay,
  setDelaySettings,
  setupSoundTestButtons,
  testSoundEffect,
  autoSaveQuickSetup,
  autoSaveIndividualSetting,
  autoSaveAllSettings,
  setupQuickSetupAutoSave,
  setupAllSettingsAutoSave,
  updateSettings: function(newSettings) { Object.assign(settings, newSettings); }, // Added for external updates
  debugLog // Export debug logging function
};

window.Settings = Settings;
