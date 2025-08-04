// QR Scanner Module for tracking winner pickups
import { Database } from './firestore.js';
import { UI } from './ui.js';
import { Winners } from './winners.js';
import QrScanner from 'https://unpkg.com/qr-scanner@1.4.2/qr-scanner.min.js';

export class QRScannerModule {
  constructor() {
    this.scanner = null;
    this.videoElement = null;
    this.isScanning = false;
    this.currentWinnerData = null;
  }

  async init() {
    // Set worker path for QR Scanner
    QrScanner.WORKER_PATH = 'https://unpkg.com/qr-scanner@1.4.2/qr-scanner-worker.min.js';
  }

  async startScanning() {
    try {
      if (!this.videoElement) {
        this.videoElement = document.getElementById('qr-video');
      }

      if (!this.videoElement) {
        throw new Error('Video element not found');
      }

      // Create scanner instance using imported QrScanner
      this.scanner = new QrScanner(
        this.videoElement,
        result => this.handleScanResult(result),
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );

      await this.scanner.start();
      this.isScanning = true;
      this.updateScannerUI(true);
    } catch (error) {
      console.error('Error starting scanner:', error);
      UI.showToast('Failed to start camera: ' + error.message, 'error');
    }
  }

  stopScanning() {
    if (this.scanner) {
      this.scanner.stop();
      this.scanner = null;
    }
    this.isScanning = false;
    this.updateScannerUI(false);
  }

  async handleScanResult(result) {
    try {
      const ticketCode = result.data;
      
      // Stop scanning temporarily to prevent multiple reads
      this.stopScanning();
      
      // Look up winner by ticket code
      const winnerData = await this.findWinnerByTicketCode(ticketCode);
      
      if (winnerData) {
        this.currentWinnerData = winnerData;
        await this.displayWinnerInfo(winnerData);
      } else {
        UI.showToast('No winner found with this ticket code', 'error');
        // Resume scanning after a delay
        setTimeout(() => this.startScanning(), 2000);
      }
    } catch (error) {
      console.error('Error processing scan result:', error);
      UI.showToast('Error processing scan: ' + error.message, 'error');
      // Resume scanning after a delay
      setTimeout(() => this.startScanning(), 2000);
    }
  }

  async findWinnerByTicketCode(ticketCode) {
    try {
      // Load all winners from database
      const winners = await Database.getFromStore('winners');
      
      // Find winners with matching entry ID (from their original list entry)
      const matchingWinners = winners.filter(w => {
        // Check if the original entry ID matches the scanned ticket code
        if (w.originalEntry && w.originalEntry.id === ticketCode) {
          return true;
        }
        // Also check for direct entryId field (if stored separately)
        if (w.entryId === ticketCode) {
          return true;
        }
        // Check in the data object as well
        if (w.data && Object.values(w.data).includes(ticketCode)) {
          return true;
        }
        return false;
      });
      
      if (matchingWinners.length === 0) {
        return null;
      }

      // Group prizes by the winner (first matching winner as representative)
      const representative = matchingWinners[0];
      const allPrizesWon = matchingWinners.map(w => ({
        winnerId: w.winnerId,
        prize: w.prize,
        timestamp: w.timestamp,
        pickedUp: w.pickedUp || false,
        pickupTimestamp: w.pickupTimestamp || null
      }));

      return {
        winner: representative,
        prizes: allPrizesWon
      };
    } catch (error) {
      console.error('Error finding winner:', error);
      throw error;
    }
  }

  async displayWinnerInfo(winnerData) {
    const { winner, prizes } = winnerData;
    
    // Update UI with winner information
    const winnerInfoDiv = document.getElementById('winnerInfo');
    const winnerNameDiv = document.getElementById('winnerName');
    const winnerDetailsDiv = document.getElementById('winnerDetails');
    const prizeListDiv = document.getElementById('prizeList');
    
    if (!winnerInfoDiv || !winnerNameDiv || !winnerDetailsDiv || !prizeListDiv) {
      console.error('Winner display elements not found');
      return;
    }

    // Display winner name
    winnerNameDiv.textContent = winner.displayName || 'Unknown Winner';
    
    // Display winner details
    const ticketCode = winner.originalEntry?.id || winner.entryId || winner.winnerId;
    const detailsHtml = `
      <div class="winner-detail-item">
        <strong>Ticket Code:</strong> ${ticketCode}
      </div>
      ${winner.info2 ? `<div class="winner-detail-item"><strong>Info:</strong> ${winner.info2}</div>` : ''}
      ${winner.info3 ? `<div class="winner-detail-item"><strong>Additional:</strong> ${winner.info3}</div>` : ''}
    `;
    winnerDetailsDiv.innerHTML = detailsHtml;
    
    // Display prizes
    const prizesHtml = prizes.map((prize, index) => `
      <div class="prize-item ${prize.pickedUp ? 'picked-up' : ''}" data-winner-id="${prize.winnerId}">
        <div class="prize-info">
          <div class="prize-name">${prize.prize}</div>
          <div class="prize-date">Won: ${new Date(prize.timestamp).toLocaleString()}</div>
          ${prize.pickedUp ? `<div class="pickup-date">Picked up: ${new Date(prize.pickupTimestamp).toLocaleString()}</div>` : ''}
        </div>
        <div class="prize-actions">
          ${!prize.pickedUp ? `
            <button class="btn btn-success btn-sm pickup-btn" data-winner-id="${prize.winnerId}">
              <i class="bi bi-check-circle"></i> Mark as Picked Up
            </button>
          ` : `
            <span class="badge bg-success">
              <i class="bi bi-check-circle-fill"></i> Picked Up
            </span>
          `}
        </div>
      </div>
    `).join('');
    
    prizeListDiv.innerHTML = prizesHtml;
    
    // Add event listeners for pickup buttons
    const pickupButtons = prizeListDiv.querySelectorAll('.pickup-btn');
    pickupButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const winnerId = e.currentTarget.dataset.winnerId;
        this.markAsPickedUp(winnerId);
      });
    });
    
    // Show winner info and hide scanner
    document.getElementById('scannerSection').classList.add('d-none');
    winnerInfoDiv.classList.remove('d-none');
  }

  async markAsPickedUp(winnerId) {
    try {
      // Update winner record with pickup status
      const pickupData = {
        pickedUp: true,
        pickupTimestamp: new Date().toISOString()
      };
      
      // Update in Firestore
      await Database.updateWinner(winnerId, pickupData);
      
      UI.showToast('Prize marked as picked up!', 'success');
      
      // Refresh the display
      if (this.currentWinnerData) {
        const updatedData = await this.findWinnerByTicketCode(this.currentWinnerData.winner.winnerId);
        await this.displayWinnerInfo(updatedData);
      }
    } catch (error) {
      console.error('Error marking as picked up:', error);
      UI.showToast('Failed to update pickup status: ' + error.message, 'error');
    }
  }

  updateScannerUI(isScanning) {
    const startBtn = document.getElementById('startScanBtn');
    const stopBtn = document.getElementById('stopScanBtn');
    const statusText = document.getElementById('scanStatus');
    
    if (isScanning) {
      startBtn?.classList.add('d-none');
      stopBtn?.classList.remove('d-none');
      if (statusText) statusText.textContent = 'Scanning for QR codes...';
    } else {
      startBtn?.classList.remove('d-none');
      stopBtn?.classList.add('d-none');
      if (statusText) statusText.textContent = 'Camera stopped';
    }
  }

  reset() {
    this.currentWinnerData = null;
    document.getElementById('winnerInfo')?.classList.add('d-none');
    document.getElementById('scannerSection')?.classList.remove('d-none');
    // Restart scanning immediately
    this.startScanning();
  }

  backToScanner() {
    // Switch views and resume scanning (since it was stopped when winner was found)
    this.currentWinnerData = null;
    document.getElementById('winnerInfo')?.classList.add('d-none');
    document.getElementById('scannerSection')?.classList.remove('d-none');
    // Resume scanning since it was stopped when winner was displayed
    this.startScanning();
  }
}

// Create singleton instance
export const QRScanner = new QRScannerModule();