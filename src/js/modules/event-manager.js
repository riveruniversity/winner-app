// ================================
// EVENT MANAGER - Proper Event Listener Management
// ================================

/**
 * EventManager class for managing event listeners with automatic cleanup
 */
class EventManager {
  constructor() {
    // Map to store event listeners by element
    this.listeners = new Map();
    // Set to store global listeners for cleanup
    this.globalListeners = new Set();
    // Flag to track if cleanup has been registered
    this.cleanupRegistered = false;
    
    this.registerCleanup();
  }

  /**
   * Registers global cleanup handlers
   */
  registerCleanup() {
    if (this.cleanupRegistered) return;
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => this.cleanup());
    
    // Cleanup on visibility change (mobile browsers)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.cleanupStale();
      }
    });
    
    this.cleanupRegistered = true;
  }

  /**
   * Adds an event listener with automatic tracking
   * @param {Element|Window|Document} target - Event target
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @param {Object} options - Event listener options
   * @returns {Function} - Cleanup function
   */
  on(target, event, handler, options = {}) {
    if (!target || !event || !handler) {
      console.warn('EventManager.on: Invalid parameters');
      return () => {};
    }

    // Get or create listener array for this element
    if (!this.listeners.has(target)) {
      this.listeners.set(target, []);
    }
    
    const listeners = this.listeners.get(target);
    
    // Check if this exact listener already exists
    const exists = listeners.some(l => 
      l.event === event && 
      l.handler === handler && 
      JSON.stringify(l.options) === JSON.stringify(options)
    );
    
    if (exists) {
      console.warn(`EventManager: Duplicate listener prevented for ${event}`);
      return () => {};
    }
    
    // Add the event listener
    target.addEventListener(event, handler, options);
    
    // Store listener info
    const listenerInfo = { event, handler, options, target };
    listeners.push(listenerInfo);
    
    // Add to global set if it's a window/document listener
    if (target === window || target === document) {
      this.globalListeners.add(listenerInfo);
    }
    
    // Return cleanup function
    return () => this.off(target, event, handler, options);
  }

  /**
   * Removes an event listener
   * @param {Element|Window|Document} target - Event target
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @param {Object} options - Event listener options
   */
  off(target, event, handler, options = {}) {
    if (!target || !this.listeners.has(target)) return;
    
    const listeners = this.listeners.get(target);
    const index = listeners.findIndex(l => 
      l.event === event && 
      l.handler === handler &&
      JSON.stringify(l.options) === JSON.stringify(options)
    );
    
    if (index !== -1) {
      target.removeEventListener(event, handler, options);
      const removed = listeners.splice(index, 1)[0];
      
      // Remove from global set if applicable
      this.globalListeners.delete(removed);
      
      // Clean up empty arrays
      if (listeners.length === 0) {
        this.listeners.delete(target);
      }
    }
  }

  /**
   * Removes all event listeners for a specific element
   * @param {Element|Window|Document} target - Event target
   */
  offAll(target) {
    if (!target || !this.listeners.has(target)) return;
    
    const listeners = this.listeners.get(target);
    listeners.forEach(({ event, handler, options }) => {
      target.removeEventListener(event, handler, options);
      this.globalListeners.delete({ event, handler, options, target });
    });
    
    this.listeners.delete(target);
  }

  /**
   * Delegate event handling for dynamic elements
   * @param {Element} container - Container element
   * @param {string} selector - CSS selector for target elements
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @returns {Function} - Cleanup function
   */
  delegate(container, selector, event, handler) {
    const delegatedHandler = (e) => {
      const target = e.target.closest(selector);
      if (target && container.contains(target)) {
        handler.call(target, e);
      }
    };
    
    return this.on(container, event, delegatedHandler);
  }

  /**
   * Adds a one-time event listener
   * @param {Element|Window|Document} target - Event target
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @param {Object} options - Event listener options
   * @returns {Function} - Cleanup function
   */
  once(target, event, handler, options = {}) {
    const onceHandler = (e) => {
      handler.call(target, e);
      this.off(target, event, onceHandler, options);
    };
    
    return this.on(target, event, onceHandler, options);
  }

  /**
   * Cleans up stale event listeners (for elements no longer in DOM)
   */
  cleanupStale() {
    const staleCandidates = [];
    
    this.listeners.forEach((listeners, target) => {
      if (target instanceof Element && !document.body.contains(target)) {
        staleCandidates.push(target);
      }
    });
    
    staleCandidates.forEach(target => this.offAll(target));
  }

  /**
   * Removes all tracked event listeners
   */
  cleanup() {
    // Use Array.from to avoid modification during iteration
    const targets = Array.from(this.listeners.keys());
    targets.forEach(target => this.offAll(target));
    this.globalListeners.clear();
  }

  /**
   * Gets statistics about tracked listeners
   * @returns {Object} - Listener statistics
   */
  getStats() {
    let total = 0;
    let byType = {};
    
    this.listeners.forEach((listeners) => {
      listeners.forEach(({ event }) => {
        total++;
        byType[event] = (byType[event] || 0) + 1;
      });
    });
    
    return {
      total,
      byType,
      globalCount: this.globalListeners.size,
      elementCount: this.listeners.size
    };
  }
}

// Create singleton instance
const eventManager = new EventManager();

// Export both the class and singleton instance
export { EventManager, eventManager };
export default eventManager;