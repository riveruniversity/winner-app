/**
 * SMS Texting Module for Winner Notifications
 * Integrates with EZ Texting API via Netlify Functions
 */

import { Database } from './firestore.js';
import { UI } from './ui.js';
import { Winners } from './winners.js';
import { getCurrentWinners } from '../app.js';
import { settings } from './settings.js';

// Rate limiting configuration
const RATE_LIMIT = {
  maxRequestsPerMinute: 200,
  requestWindow: 60 * 1000, // 60 seconds in milliseconds
  safetyBuffer: 0.9 // Use 90% of limit to be safe (180 requests/minute)
};

// Rate limiting tracker
class RateLimiter {
  constructor() {
    this.requests = []; // Array of request timestamps
  }

  // Remove old requests outside the current window
  cleanOldRequests() {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT.requestWindow;
    this.requests = this.requests.filter(timestamp => timestamp > windowStart);
  }

  // Check if we can make a request
  canMakeRequest() {
    this.cleanOldRequests();
    const maxRequests = Math.floor(RATE_LIMIT.maxRequestsPerMinute * RATE_LIMIT.safetyBuffer);
    return this.requests.length < maxRequests;
  }

  // Calculate how long to wait before next request
  getWaitTime() {
    this.cleanOldRequests();
    if (this.canMakeRequest()) {
      return 0;
    }
    
    // Find the oldest request that would need to expire
    const maxRequests = Math.floor(RATE_LIMIT.maxRequestsPerMinute * RATE_LIMIT.safetyBuffer);
    const oldestRelevantRequest = this.requests[this.requests.length - maxRequests];
    const waitUntil = oldestRelevantRequest + RATE_LIMIT.requestWindow;
    return Math.max(0, waitUntil - Date.now());
  }

  // Record a successful request
  recordRequest() {
    this.requests.push(Date.now());
  }

  // Get current request count in the window
  getCurrentCount() {
    this.cleanOldRequests();
    return this.requests.length;
  }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter();

class TextingService {
  constructor() {
    this.sendingInProgress = false;
    this.abortController = null;
  }

  /**
   * Makes a POST request to the EZ Texting Netlify function with rate limiting
   */
  async makeRequest(body) {
    // Check rate limit and wait if necessary
    const waitTime = rateLimiter.getWaitTime();
    if (waitTime > 0) {
      const waitSeconds = Math.ceil(waitTime / 1000);
      console.log(`Rate limit reached. Waiting ${waitSeconds} seconds...`);
      UI.updateProgress(null, `Rate limit reached. Waiting ${waitSeconds} seconds...`);
      await this.delay(waitTime);
    }

    // Record the request attempt
    rateLimiter.recordRequest();

    const response = await fetch('/.netlify/functions/ez-texting', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: this.abortController?.signal
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Sends a single SMS message
   */
  async sendSingleText(phoneNumber, message, options = {}) {
    try {
      const body = {
        action: 'sendMessage',
        data: {
          message: message,
          phoneNumbers: Array.isArray(phoneNumber) ? phoneNumber : [phoneNumber],
          options: options
        }
      };

      const result = await this.makeRequest(body);
      return result;
    } catch (error) {
      console.error('Error sending single text:', error);
      throw error;
    }
  }

  /**
   * Sends SMS to multiple recipients with async rate limiting (200 requests/minute)
   */
  async sendBatchTexts(recipients, messageTemplate, options = {}) {
    const results = {
      successful: [],
      failed: [],
      total: recipients.length
    };

    // Create all SMS tasks
    const smsTasks = recipients.map((recipient, index) => ({
      recipient,
      index,
      task: async () => {
        try {
          // Check if sending was cancelled
          if (this.abortController?.signal.aborted) {
            return {
              success: false,
              recipient,
              error: 'Cancelled by user'
            };
          }

          // Check if recipient has a phone number
          if (!recipient.phone) {
            return {
              success: false,
              recipient,
              error: 'No phone number'
            };
          }

          // Personalize message for this recipient
          let personalizedMessage = messageTemplate;
          personalizedMessage = personalizedMessage.replace('{name}', recipient.displayName || recipient.name || 'Winner');
          personalizedMessage = personalizedMessage.replace('{prize}', recipient.prize || 'your prize');
          personalizedMessage = personalizedMessage.replace('{ticketCode}', recipient.ticketCode || recipient.data?.ticketCode || recipient.winnerId || '');

          // Send individual message (rate limiting handled in makeRequest)
          const body = {
            action: 'sendMessage',
            data: {
              message: personalizedMessage,
              phoneNumbers: [recipient.phone],
              options: options
            }
          };

          const result = await this.makeRequest(body);
          
          return {
            success: result.success,
            recipient,
            error: result.success ? null : (result.error || 'Unknown error')
          };

        } catch (error) {
          return {
            success: false,
            recipient,
            error: error.message
          };
        }
      }
    }));

    // Process tasks with controlled concurrency and rate limiting
    let completed = 0;
    const promises = [];
    
    for (const smsTask of smsTasks) {
      // Wait for rate limit if needed
      const waitTime = rateLimiter.getWaitTime();
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      // Start the SMS task (don't await here)
      const promise = smsTask.task().then(result => {
        completed++;
        
        // Update progress
        const progress = Math.round((completed / recipients.length) * 100);
        const currentCount = rateLimiter.getCurrentCount();
        const maxRequests = Math.floor(RATE_LIMIT.maxRequestsPerMinute * RATE_LIMIT.safetyBuffer);
        
        UI.updateProgress(
          progress,
          `Sending ${completed}/${recipients.length} (Rate: ${currentCount}/${maxRequests} requests/min)`
        );

        // Store result
        if (result.success) {
          results.successful.push(result.recipient);
        } else {
          results.failed.push({
            recipient: result.recipient,
            error: result.error
          });
        }

        return result;
      });

      promises.push(promise);

      // Small delay between starting requests (300ms = 200 requests/minute)
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Wait for all SMS tasks to complete
    await Promise.all(promises);

    return results;
  }

  /**
   * Sends SMS to current winners (the ones just selected)
   */
  async sendToCurrentWinners() {
    if (this.sendingInProgress) {
      UI.showToast('Already sending messages. Please wait...', 'warning');
      return;
    }

    const currentWinners = getCurrentWinners();
    
    if (!currentWinners || currentWinners.length === 0) {
      UI.showToast('No current winners to send messages to. Please select winners first.', 'warning');
      return;
    }

    // Show confirmation modal with template preview
    const confirmed = await this.showSMSConfirmationModal(currentWinners.length);
    if (!confirmed) return;

    // Use SMS template from settings
    const message = settings.smsTemplate || 'Congratulations {name}! You won {prize}. Your ticket: {ticketCode}';
    if (!message.trim()) {
      UI.showToast('SMS template is empty. Please set a template in Settings.', 'warning');
      return;
    }

    this.sendingInProgress = true;
    UI.showProgress('Sending messages...');

    try {
      // Find winners with phone numbers
      const winnersWithPhone = currentWinners.filter(winner => {
        // Check direct properties
        if (winner.phone || winner.Phone || winner.mobile || winner.phoneNumber) {
          return true;
        }
        // Check data object (camelized CSV fields)
        if (winner.data) {
          return winner.data.phoneNumber || winner.data.phone || winner.data.mobile || 
                 winner.data.cellPhone || winner.data.cell || winner.data.telephone;
        }
        return false;
      });

      if (winnersWithPhone.length === 0) {
        UI.showToast('No winners with phone numbers found', 'warning');
        return;
      }

      // Send messages asynchronously with proper rate limiting
      const results = await this.sendBatchTexts(
        winnersWithPhone.map(winner => {
          // Get phone number from direct properties or camelized data object
          const phone = winner.phone || winner.Phone || winner.mobile || winner.phoneNumber ||
                       (winner.data && (winner.data.phoneNumber || winner.data.phone || winner.data.mobile || 
                                       winner.data.cellPhone || winner.data.cell || winner.data.telephone));
          return {
            ...winner,
            phone: this.cleanPhoneNumber(phone)
          };
        }),
        message
      );

      UI.showToast(`SMS sent: ${results.successful.length} successful, ${results.failed.length} failed`, 
                   results.successful.length > 0 ? 'success' : 'error');

    } catch (error) {
      UI.showToast('Error sending messages: ' + error.message, 'error');
    } finally {
      this.sendingInProgress = false;
      UI.hideProgress();
    }
  }

  /**
   * Shows SMS confirmation modal with template preview
   */
  async showSMSConfirmationModal(winnerCount) {
    return new Promise((resolve) => {
      const modal = document.getElementById('appModal');
      const modalTitle = document.getElementById('appModalLabel');
      const modalBody = document.getElementById('appModalBody');
      const confirmBtn = document.getElementById('appModalConfirmBtn');
      
      modalTitle.textContent = 'Send SMS Messages';
      
      const currentWinners = getCurrentWinners();
      const sampleWinner = currentWinners[0] || { displayName: 'John Doe', prize: 'Sample Prize', winnerId: 'ABC123' };
      const template = settings.smsTemplate || 'Congratulations {name}! You won {prize}. Your ticket: {ticketCode}';
      
      // Create preview message
      let previewMessage = template
        .replace('{name}', sampleWinner.displayName || 'John Doe')
        .replace('{prize}', sampleWinner.prize || 'Sample Prize')
        .replace('{ticketCode}', sampleWinner.ticketCode || sampleWinner.data?.ticketCode || sampleWinner.winnerId || 'ABC123');
      
      modalBody.innerHTML = `
        <div class="mb-3">
          <p>Send SMS messages to <strong>${winnerCount} current winner${winnerCount > 1 ? 's' : ''}</strong> with phone numbers?</p>
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold">Message Preview:</label>
          <div class="alert alert-info">
            <div class="mb-2">${previewMessage}</div>
            <small class="text-muted">
              ${this.calculateSMSInfo(previewMessage)}
            </small>
          </div>
        </div>
        <div class="mb-3">
          <small class="text-muted">
            <i class="bi bi-info-circle me-1"></i>
            You can edit the SMS template in Settings if needed.
          </small>
        </div>
      `;

      confirmBtn.textContent = 'Send Messages';
      confirmBtn.className = 'btn btn-success';
      confirmBtn.onclick = () => {
        window.appModal.hide();
        resolve(true);
      };

      // Add cancel functionality
      const cancelBtn = document.getElementById('appModalCancelBtn') || this.createCancelButton();
      cancelBtn.onclick = () => {
        window.appModal.hide();
        resolve(false);
      };
      cancelBtn.style.display = 'inline-block';

      window.appModal.show();
    });
  }

  /**
   * Calculate SMS info (character count and message count)
   */
  calculateSMSInfo(message) {
    const charCount = message.length;
    let smsCount;
    if (charCount === 0) {
      smsCount = 1;
    } else if (charCount <= 160) {
      smsCount = 1;
    } else {
      smsCount = Math.ceil(charCount / 153);
    }
    return `${charCount} characters, ${smsCount} SMS${smsCount > 1 ? ' messages' : ''}`;
  }

  /**
   * Create cancel button if it doesn't exist
   */
  createCancelButton() {
    const modalFooter = document.querySelector('#appModal .modal-footer');
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'appModalCancelBtn';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.display = 'none';
    modalFooter.insertBefore(cancelBtn, modalFooter.firstChild);
    return cancelBtn;
  }


  /**
   * Shows results of bulk send operation
   */
  showSendResults(results) {
    const modal = document.getElementById('appModal');
    const modalTitle = document.getElementById('appModalLabel');
    const modalBody = document.getElementById('appModalBody');
    const confirmBtn = document.getElementById('appModalConfirmBtn');

    modalTitle.textContent = 'SMS Send Results';
    
    const successRate = Math.round((results.successful.length / results.total) * 100);
    
    modalBody.innerHTML = `
      <div class="alert alert-${successRate === 100 ? 'success' : successRate > 50 ? 'warning' : 'danger'}">
        <h5>Send Complete</h5>
        <p>Success rate: ${successRate}%</p>
      </div>
      <div class="row">
        <div class="col-6">
          <div class="card">
            <div class="card-body text-center">
              <h3 class="text-success">${results.successful.length}</h3>
              <p class="text-muted">Successful</p>
            </div>
          </div>
        </div>
        <div class="col-6">
          <div class="card">
            <div class="card-body text-center">
              <h3 class="text-danger">${results.failed.length}</h3>
              <p class="text-muted">Failed</p>
            </div>
          </div>
        </div>
      </div>
      ${results.failed.length > 0 ? `
        <div class="mt-3">
          <h6>Failed Recipients:</h6>
          <div class="small" style="max-height: 200px; overflow-y: auto;">
            ${results.failed.map(f => `
              <div class="text-danger">
                ${f.recipient.displayName || 'Unknown'}: ${f.error}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    confirmBtn.textContent = 'Close';
    confirmBtn.onclick = () => {
      window.appModal.hide();
    };

    window.appModal.show();
  }

  /**
   * Logs SMS send event to database
   */
  async logSendEvent(results, messageTemplate) {
    try {
      const logEntry = {
        timestamp: Date.now(),
        type: 'sms_bulk_send',
        message: messageTemplate,
        results: {
          total: results.total,
          successful: results.successful.length,
          failed: results.failed.length
        },
        date: new Date().toISOString()
      };

      await Database.saveToStore('sms_logs', logEntry);
    } catch (error) {
      console.error('Error logging SMS event:', error);
    }
  }

  /**
   * Cleans and validates phone number
   */
  cleanPhoneNumber(phone) {
    if (!phone) return null;
    
    // Remove all non-digit characters
    const cleaned = String(phone).replace(/\D/g, '');
    
    // Add country code if missing (assuming US)
    if (cleaned.length === 10) {
      return '1' + cleaned;
    }
    
    return cleaned;
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cancels ongoing send operation
   */
  cancelSending() {
    if (this.abortController) {
      this.abortController.abort();
      UI.showToast('Sending cancelled', 'info');
    }
  }

  /**
   * Gets current rate limiting status
   */
  getRateLimitStatus() {
    const currentCount = rateLimiter.getCurrentCount();
    const maxRequests = Math.floor(RATE_LIMIT.maxRequestsPerMinute * RATE_LIMIT.safetyBuffer);
    const waitTime = rateLimiter.getWaitTime();
    const canMakeRequest = rateLimiter.canMakeRequest();
    
    return {
      currentRequests: currentCount,
      maxRequests: maxRequests,
      remaining: maxRequests - currentCount,
      waitTime: waitTime,
      canMakeRequest: canMakeRequest,
      percentageUsed: Math.round((currentCount / maxRequests) * 100)
    };
  }

  /**
   * Gets SMS sending statistics
   */
  async getStats() {
    try {
      const logs = await Database.getAllFromStore('sms_logs');
      
      const stats = {
        totalSent: 0,
        totalFailed: 0,
        lastSent: null
      };

      logs.forEach(log => {
        if (log.type === 'sms_bulk_send') {
          stats.totalSent += log.results.successful;
          stats.totalFailed += log.results.failed;
          if (!stats.lastSent || log.timestamp > stats.lastSent) {
            stats.lastSent = log.timestamp;
          }
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting SMS stats:', error);
      return null;
    }
  }
}

// Create and export singleton instance
export const Texting = new TextingService();

// Make available globally for debugging
window.Texting = Texting;

// Simple test function
window.testSMS = () => {
  // Set mock current winners
  window.setCurrentWinners([{
    name: 'Test Winner',
    displayName: 'Test Winner',
    phone: '5551234567',
    prize: 'Test Prize',
    ticketCode: 'TEST123'
  }]);
  
  // Show SMS button
  const btn = document.getElementById('sendSMSBtn');
  if (btn) {
    btn.classList.remove('d-none');
    console.log('SMS button should now be visible. Click it to test.');
  }
};

