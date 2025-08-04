// ================================
// SOUND FILE MANAGEMENT
// ================================

import { Database } from './firestore.js';
import { UI } from './ui.js';
import { Settings } from './settings.js';

// Available sound files (initially with default sounds)
let availableSounds = {
  'drum-roll': { name: 'Drum Roll', filename: 'drum-roll.mp3', type: 'default' },
  'applause': { name: 'Applause', filename: 'applause.mp3', type: 'default' },
  'applause-winner': { name: 'Applause Winner', filename: 'applause-winner.mp3', type: 'default' },
  'electronic-build-up': { name: 'Electronic Build-up', filename: 'electronic_build-up.mp3', type: 'default' },
  'sting-rimshot-drum-roll': { name: 'Sting Rimshot', filename: 'sting-rimshot-drum-roll.mp3', type: 'default' },
  'tada-fanfare': { name: 'Tada Fanfare', filename: 'tada-fanfare.mp3', type: 'default' }
};

// Initialize sound file management
async function initSounds() {
  await loadCustomSounds();
  updateSoundFilesList();
  updateSoundDropdowns();
  setupSoundUploadHandlers();
}

// Load custom sounds from database
async function loadCustomSounds() {
  try {
    const customSounds = await Database.getFromStore('sounds');
    if (customSounds && Array.isArray(customSounds)) {
      customSounds.forEach(sound => {
        if (sound.soundId && sound.name && sound.filename) {
          if (sound.type === 'uploaded') {
            // Uploaded sounds (look for file in public/sounds)
            availableSounds[sound.soundId] = {
              name: sound.name,
              filename: sound.filename,
              type: 'uploaded'
            };
          } else {
            // Legacy custom sounds with base64 data
            availableSounds[sound.soundId] = {
              name: sound.name,
              filename: sound.filename,
              type: 'custom',
              data: sound.data
            };
          }
        }
      });
    }
    Settings.debugLog('Loaded custom sounds:', Object.keys(availableSounds).filter(id => availableSounds[id].type === 'custom' || availableSounds[id].type === 'uploaded'));
  } catch (error) {
    console.error('Error loading custom sounds:', error);
  }
}

// Update the sound files list in the UI
function updateSoundFilesList() {
  const soundFilesList = document.getElementById('soundFilesList');
  if (!soundFilesList) return;

  soundFilesList.innerHTML = '';

  Object.entries(availableSounds).forEach(([soundId, sound]) => {
    const soundItem = document.createElement('div');
    soundItem.className = 'd-flex justify-content-between align-items-center p-2 border rounded';
    
    const soundInfo = document.createElement('div');
    soundInfo.innerHTML = `
      <strong>${sound.name}</strong>
      <small class="text-muted d-block">${sound.filename}</small>
    `;
    
    const soundActions = document.createElement('div');
    soundActions.className = 'd-flex gap-2';
    
    // Test button
    const testBtn = document.createElement('button');
    testBtn.className = 'btn btn-sm btn-outline-primary';
    testBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
    testBtn.title = 'Test Sound';
    testBtn.addEventListener('click', () => testSound(soundId));
    
    soundActions.appendChild(testBtn);
    
    // Delete button for custom and uploaded sounds
    if (sound.type === 'custom' || sound.type === 'uploaded') {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn btn-sm btn-outline-danger';
      deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
      deleteBtn.title = 'Delete Sound';
      deleteBtn.addEventListener('click', () => deleteCustomSound(soundId));
      soundActions.appendChild(deleteBtn);
    }
    
    soundItem.appendChild(soundInfo);
    soundItem.appendChild(soundActions);
    soundFilesList.appendChild(soundItem);
  });
}

// Setup event handlers for sound upload
function setupSoundUploadHandlers() {
  const uploadBtn = document.getElementById('uploadSoundFilesBtn');
  const fileInput = document.getElementById('soundFileInput');
  
  if (uploadBtn && fileInput) {
    // Button clicks file input, then processes immediately
    uploadBtn.addEventListener('click', () => {
      fileInput.click();
    });
    
    // When files are selected, process immediately
    fileInput.addEventListener('change', handleSoundUpload);
  }
}

// Handle sound file upload
async function handleSoundUpload(event) {
  const fileInput = event.target;
  const files = fileInput.files;
  
  if (!files || files.length === 0) {
    UI.showToast('Please select MP3 files to upload', 'warning');
    return;
  }
  
  Settings.debugLog('Starting sound upload process for', files.length, 'files');
  UI.showProgress('Uploading Sound Files', `Processing ${files.length} file${files.length > 1 ? 's' : ''}...`);
  
  try {
    let uploadedCount = 0;
    const errors = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file type
      if (!file.type.startsWith('audio/') && !file.name.toLowerCase().endsWith('.mp3')) {
        errors.push(`${file.name}: Not a valid audio file`);
        continue;
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        errors.push(`${file.name}: File too large (max 5MB)`);
        continue;
      }
      
      try {
        await uploadSoundFile(file);
        uploadedCount++;
        UI.updateProgress(((i + 1) / files.length) * 100, `Uploaded ${uploadedCount} of ${files.length} files`);
        Settings.debugLog('Successfully uploaded:', file.name);
      } catch (error) {
        console.error('Error uploading file:', file.name, error);
        errors.push(`${file.name}: ${error.message}`);
      }
    }
    
    UI.hideProgress();
    
    // Show results
    if (uploadedCount > 0) {
      UI.showToast(`Downloaded ${uploadedCount} sound file${uploadedCount > 1 ? 's' : ''}. Please place ${uploadedCount > 1 ? 'them' : 'it'} in the public/sounds directory.`, 'info');
      updateSoundFilesList();
      updateSoundDropdowns();
      
      // Clear file input
      fileInput.value = '';
    }
    
    if (errors.length > 0) {
      const errorMessage = errors.join('\n');
      UI.showToast(`Some files failed to upload:\n${errorMessage}`, 'error');
      Settings.debugLog('Upload errors:', errors);
    }
    
  } catch (error) {
    UI.hideProgress();
    console.error('Error in sound upload process:', error);
    UI.showToast('Error uploading sound files: ' + error.message, 'error');
  }
}

// Upload a single sound file
async function uploadSoundFile(file) {
  try {
    // Create a download link for the user to manually save the file
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Create sound record with file reference (no base64 data)
    const soundId = generateSoundId(file.name);
    const soundName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
    
    const soundRecord = {
      soundId,
      name: soundName,
      filename: file.name,
      uploadDate: Date.now(),
      size: file.size,
      type: 'uploaded'
    };
    
    // Save metadata to database
    await Database.saveToStore('sounds', soundRecord);
    
    // Add to available sounds as uploaded type (will look for file in public/sounds)
    availableSounds[soundId] = {
      name: soundName,
      filename: file.name,
      type: 'uploaded'
    };
    
    Settings.debugLog('Sound file metadata saved:', soundId);
    
    // Show instructions to user
    UI.showToast(`File "${file.name}" downloaded. Please place it in the public/sounds directory and refresh the page.`, 'info');
    
    return soundRecord;
    
  } catch (error) {
    throw error;
  }
}

// Generate unique sound ID
function generateSoundId(filename) {
  const baseName = filename.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9]/g, '-');
  const timestamp = Date.now().toString(36);
  return `${baseName}-${timestamp}`;
}

// Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to Blob URL for playing
function base64ToBlob(base64Data, mimeType = 'audio/mpeg') {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

// Test a sound
function testSound(soundId) {
  const sound = availableSounds[soundId];
  if (!sound) {
    UI.showToast('Sound not found', 'error');
    return;
  }
  
  Settings.debugLog('Testing sound:', soundId, sound.name);
  
  try {
    let audioUrl;
    
    if (sound.type === 'default' || sound.type === 'uploaded') {
      // Default and uploaded sounds from public/sounds folder
      audioUrl = `/sounds/${sound.filename}`;
    } else {
      // Custom sounds from base64 data
      const blob = base64ToBlob(sound.data);
      audioUrl = URL.createObjectURL(blob);
    }
    
    const audio = new Audio(audioUrl);
    audio.volume = 0.7;
    audio.play().catch(error => {
      console.error('Error playing sound:', error);
      UI.showToast('Error playing sound', 'error');
    });
    
    // Clean up blob URL for custom sounds
    if (sound.type === 'custom') {
      audio.addEventListener('ended', () => URL.revokeObjectURL(audioUrl));
    }
    
  } catch (error) {
    console.error('Error testing sound:', error);
    UI.showToast('Error playing sound: ' + error.message, 'error');
  }
}

// Delete custom sound
async function deleteCustomSound(soundId) {
  if (!availableSounds[soundId] || (availableSounds[soundId].type !== 'custom' && availableSounds[soundId].type !== 'uploaded')) {
    return;
  }
  
  try {
    // Remove from database
    await Database.deleteFromStore('sounds', soundId);
    
    // Remove from available sounds
    delete availableSounds[soundId];
    
    // Update UI
    updateSoundFilesList();
    updateSoundDropdowns();
    
    UI.showToast('Sound file deleted', 'success');
    Settings.debugLog('Deleted custom sound:', soundId);
    
  } catch (error) {
    console.error('Error deleting sound:', error);
    UI.showToast('Error deleting sound file', 'error');
  }
}

// Update sound dropdowns with available options
function updateSoundDropdowns() {
  console.log('updateSoundDropdowns called. Available sounds:', availableSounds);
  
  const soundDropdowns = [
    'soundDuringDelay',
    'soundEndOfDelay', 
    'soundDuringReveal'
  ];
  
  soundDropdowns.forEach(dropdownId => {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) {
      console.log(`Dropdown ${dropdownId} not found in DOM`);
      return;
    }
    
    const currentValue = dropdown.value;
    
    // Also check if we should use the value from settings
    const settingsValue = Settings.settings?.[dropdownId] || currentValue;
    
    // Clear current options except 'none'
    Array.from(dropdown.options).forEach(option => {
      if (option.value !== 'none') {
        option.remove();
      }
    });
    
    // Add ALL available sounds to ALL dropdowns
    console.log(`Adding ${Object.keys(availableSounds).length} sounds to ${dropdownId}`);
    Object.entries(availableSounds).forEach(([soundId, sound]) => {
      const option = document.createElement('option');
      option.value = soundId;
      option.textContent = sound.name;
      dropdown.appendChild(option);
      console.log(`Added ${sound.name} (${soundId}) to ${dropdownId}`);
    });
    
    // Restore previous selection - prefer settings value, fallback to current value
    const valueToRestore = settingsValue || currentValue;
    if (valueToRestore && valueToRestore !== 'none' && dropdown.querySelector(`option[value="${valueToRestore}"]`)) {
      dropdown.value = valueToRestore;
      console.log(`Restored value ${valueToRestore} for ${dropdownId}`);
    } else if (valueToRestore === 'none') {
      dropdown.value = 'none';
      console.log(`Restored default value 'none' for ${dropdownId}`);
    } else if (valueToRestore && valueToRestore !== 'none') {
      console.log(`Could not restore value ${valueToRestore} for ${dropdownId} - option not found, defaulting to 'none'`);
      dropdown.value = 'none';
    }
  });
  
  Settings.debugLog('Updated sound dropdowns with', Object.keys(availableSounds).length, 'available sounds');
  
  // Re-setup auto-save listeners for sound dropdowns after updating them
  if (Settings && Settings.setupQuickSetupAutoSave) {
    Settings.setupQuickSetupAutoSave();
  }
  
  // Also reload sound settings if available
  if (Settings && Settings.loadSoundSettingsToForm) {
    Settings.loadSoundSettingsToForm();
  }
}

// Get sound URL for playing (used by selection.js)
function getSoundUrl(soundId) {
  const sound = availableSounds[soundId];
  if (!sound) return null;
  
  if (sound.type === 'default' || sound.type === 'uploaded') {
    return `/sounds/${sound.filename}`;
  } else {
    const blob = base64ToBlob(sound.data);
    return URL.createObjectURL(blob);
  }
}

// Export public API
export const Sounds = {
  initSounds,
  updateSoundDropdowns,
  getSoundUrl,
  testSound,
  availableSounds: () => availableSounds
};

window.Sounds = Sounds;