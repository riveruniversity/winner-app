// Scanner Module - QR scanning only (Alpine.js version)
import { UI } from '../src/js/modules/ui.js';
import { WinnerSearch } from './winner-search.js';
import QrScanner from 'https://unpkg.com/qr-scanner@1.4.2/qr-scanner.min.js';

class ScannerModule {
  constructor() {
    this.scanner = null;
    this.videoElement = null;
    this.isScanning = false;

    // Callbacks for Alpine store integration
    this.onWinnerFound = null;
    this.onNoWinner = null;
    this.onScanningChange = null;
  }

  async init() {
    // No longer needed - qr-scanner handles worker automatically
  }

  async startScanning() {
    try {
      if (!this.videoElement) {
        this.videoElement = document.getElementById('qr-video');
      }

      if (!this.videoElement) {
        throw new Error('Video element not found');
      }

      this.scanner = new QrScanner(
        this.videoElement,
        result => this.handleScanResult(result),
        {
          returnDetailedScanResult: true,
          highlightScanRegion: true,
          highlightCodeOutline: false,
        }
      );

      await this.scanner.start();
      this.isScanning = true;
      this.onScanningChange?.(true);
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
    this.onScanningChange?.(false);
  }

  async handleScanResult(result) {
    try {
      const ticketCode = result.data;

      // Validate QR code format
      if (!WinnerSearch.isTicketCode(ticketCode)) {
        console.log('Invalid QR code format:', ticketCode);
        setTimeout(() => this.startScanning(), 100);
        return;
      }

      // Stop scanning temporarily
      this.stopScanning();

      // Look up winner
      const winnerData = await WinnerSearch.findByTicketCode(ticketCode);

      if (winnerData) {
        this.onWinnerFound?.(winnerData);
      } else {
        this.onNoWinner?.(ticketCode);
      }
    } catch (error) {
      console.error('Error processing scan result:', error);
      UI.showToast('Error processing scan: ' + error.message, 'error');
      setTimeout(() => this.startScanning(), 2000);
    }
  }
}

// Create singleton instance
export const Scanner = new ScannerModule();
