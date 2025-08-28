/**
 * Keyboard Shortcuts Module
 * Provides keyboard navigation for the public view to avoid visible mouse movements
 * 
 * Key Mappings:
 * - P: Play button (start selection)
 * - T: Send text messages
 * - U: Undo last selection  
 * - F: Toggle fullscreen
 * - N: New selection
 * - M: Manage (switch to management view)
 */

const KeyboardShortcuts = {
  // Track if shortcuts are enabled (only in public view)
  enabled: false,
  
  // Key mapping configuration
  shortcuts: {
    'p': { 
      action: 'play',
      description: 'Start selection',
      handler: () => {
        // Check if selection controls are hidden (meaning a selection has already been made)
        const selectionControls = document.getElementById('selectionControls');
        if (selectionControls && selectionControls.classList.contains('d-none')) {
          // Don't allow play if a selection is already complete
          // Could optionally show a toast here but it's handled in handleBigPlayClick
          return;
        }
        document.getElementById('bigPlayButton')?.click();
      }
    },
    't': {
      action: 'text',
      description: 'Send text messages',
      handler: () => document.getElementById('sendSMSBtn')?.click()
    },
    'u': {
      action: 'undo',
      description: 'Undo last selection',
      handler: () => document.getElementById('undoSelectionBtn')?.click()
    },
    'f': {
      action: 'fullscreen',
      description: 'Toggle fullscreen',
      handler: () => document.getElementById('fullscreenToggle')?.click()
    },
    'n': {
      action: 'new',
      description: 'New selection',
      handler: () => document.getElementById('newSelectionBtn')?.click()
    },
    'm': {
      action: 'manage',
      description: 'Open management',
      handler: () => document.getElementById('managementToggle')?.click()
    }
  },
  
  /**
   * Initialize keyboard shortcuts
   */
  init() {
    // Add event listener for keypress events
    document.addEventListener('keydown', this.handleKeypress.bind(this));
    
    // Enable shortcuts when in public view
    this.checkViewState();
    
    // Monitor view changes
    this.observeViewChanges();
    
    // Add help tooltip or visual indicator
    this.addHelpIndicator();
  },
  
  /**
   * Handle keypress events
   */
  handleKeypress(event) {
    // Only process if shortcuts are enabled and not in an input field
    if (!this.enabled || this.isInputFocused()) {
      return;
    }
    
    // Get the pressed key (lowercase)
    const key = event.key.toLowerCase();
    
    // Check if this key has a shortcut
    const shortcut = this.shortcuts[key];
    if (shortcut) {
      // Prevent default browser behavior
      event.preventDefault();
      event.stopPropagation();
      
      // Execute the shortcut handler
      try {
        shortcut.handler();
        
        // Show visual feedback
        this.showFeedback(key);
      } catch (error) {
        console.error(`Error executing shortcut ${key}:`, error);
      }
    }
  },
  
  /**
   * Check if an input field is currently focused
   */
  isInputFocused() {
    const activeElement = document.activeElement;
    const inputTypes = ['input', 'textarea', 'select'];
    return inputTypes.includes(activeElement?.tagName?.toLowerCase());
  },
  
  /**
   * Check current view state and enable/disable shortcuts
   */
  checkViewState() {
    const publicInterface = document.getElementById('publicInterface');
    const managementInterface = document.getElementById('managementInterface');
    
    // Enable shortcuts only when public interface is visible
    this.enabled = publicInterface?.style.display !== 'none' && 
                   !managementInterface?.classList.contains('active');
  },
  
  /**
   * Monitor view changes to enable/disable shortcuts
   */
  observeViewChanges() {
    // Use MutationObserver to detect view changes
    const observer = new MutationObserver(() => {
      this.checkViewState();
    });
    
    // Observe both interfaces for changes
    const publicInterface = document.getElementById('publicInterface');
    const managementInterface = document.getElementById('managementInterface');
    
    if (publicInterface) {
      observer.observe(publicInterface, { 
        attributes: true, 
        attributeFilter: ['style'] 
      });
    }
    
    if (managementInterface) {
      observer.observe(managementInterface, { 
        attributes: true, 
        attributeFilter: ['class'] 
      });
    }
  },
  
  /**
   * Add help indicator showing available shortcuts
   */
  addHelpIndicator() {
    // Create a subtle help indicator in the corner
    const helpIndicator = document.createElement('div');
    helpIndicator.id = 'keyboard-shortcuts-help';
    helpIndicator.className = 'keyboard-help-indicator';
    helpIndicator.innerHTML = `
      <button class="btn btn-sm btn-outline-secondary" title="Keyboard Shortcuts">
        <i class="bi bi-keyboard"></i>
      </button>
      <div class="keyboard-help-tooltip">
        <div class="help-title">Keyboard Shortcuts</div>
        <div class="help-shortcuts">
          <div><kbd>P</kbd> Play / Start Selection</div>
          <div><kbd>T</kbd> Send Text Messages</div>
          <div><kbd>U</kbd> Undo Last Selection</div>
          <div><kbd>F</kbd> Toggle Fullscreen</div>
          <div><kbd>N</kbd> New Selection</div>
          <div><kbd>M</kbd> Manage Settings</div>
        </div>
      </div>
    `;
    
    // Add to public interface
    const publicInterface = document.getElementById('publicInterface');
    if (publicInterface) {
      publicInterface.appendChild(helpIndicator);
    }
    
    // Toggle help on hover or click
    const helpButton = helpIndicator.querySelector('button');
    const tooltip = helpIndicator.querySelector('.keyboard-help-tooltip');
    
    helpButton?.addEventListener('mouseenter', () => {
      tooltip.style.display = 'block';
    });
    
    helpIndicator.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
    
    helpButton?.addEventListener('click', (e) => {
      e.preventDefault();
      tooltip.style.display = tooltip.style.display === 'block' ? 'none' : 'block';
    });
  },
  
  /**
   * Show visual feedback when a shortcut is triggered
   */
  showFeedback(key) {
    // Create a temporary feedback element
    const feedback = document.createElement('div');
    feedback.className = 'keyboard-feedback';
    feedback.textContent = key.toUpperCase();
    feedback.style.cssText = `
      position: fixed;
      bottom: 15px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.2);
      color: rgba(255, 255, 255, 0.4);
      padding: 4px 12px;
      border-radius: 3px;
      z-index: 10000;
      animation: fadeInOut 0.6s ease-in-out;
      font-weight: normal;
      font-size: 12px;
      min-width: 30px;
      text-align: center;
    `;
    
    document.body.appendChild(feedback);
    
    // Remove after animation
    setTimeout(() => {
      feedback.remove();
    }, 600);
  }
};

// Export for use in other modules
export default KeyboardShortcuts;