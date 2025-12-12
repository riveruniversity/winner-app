// Winner Search Module - handles lookup by ticket code or winner name
import { Database } from '../src/js/modules/database.js';

export class WinnerSearch {
  /**
   * Check if input matches a ticket code format
   * Supports:
   * - 8-24 alphanumeric (mixed case) (e.g., "HWFXaOUlVT", "abc123def456...")
   * - [A-Z]-[0-9]{5,7} prefix format (e.g., "A-369008", "B-1234567")
   */
  static isTicketCode(input) {
    const alphanumericPattern = /^[a-zA-Z0-9]{8,24}$/;
    const prefixPattern = /^[A-Z]-\d{5,7}$/;
    return alphanumericPattern.test(input) || prefixPattern.test(input);
  }

  /**
   * Search by ticket code (exact match on entryId)
   * Returns single winner with all their prizes, or null if not found
   */
  static async findByTicketCode(ticketCode) {
    const winners = await Database.getFromStore('winners');

    const matchingWinners = winners.filter(w => w.entryId === ticketCode);

    if (matchingWinners.length === 0) {
      return null;
    }

    console.log(`Found ${matchingWinners.length} prizes for ticket code: ${ticketCode}`);

    // Verify all matches are for the same person
    const firstWinnerName = matchingWinners[0].displayName;
    const allSamePerson = matchingWinners.every(w => w.displayName === firstWinnerName);

    if (!allSamePerson) {
      console.warn('Warning: Found prizes for different people with same ticket code!');
      // Filter to only show prizes for the first person found
      const filteredWinners = matchingWinners.filter(w => w.displayName === firstWinnerName);
      return this._groupWinnerPrizes(filteredWinners);
    }

    return this._groupWinnerPrizes(matchingWinners);
  }

  /**
   * Search by winner name (case-insensitive partial match)
   * Returns array of unique persons, each with their prizes
   */
  static async findByName(searchTerm) {
    const winners = await Database.getFromStore('winners');
    const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(w => w);

    // Find all winners whose displayName contains ALL search words
    const matchingWinners = winners.filter(w => {
      if (!w.displayName) return false;
      const nameLower = w.displayName.toLowerCase();
      return searchWords.every(word => nameLower.includes(word));
    });

    if (matchingWinners.length === 0) {
      return [];
    }

    console.log(`Found ${matchingWinners.length} prize records matching name: ${searchTerm}`);

    // Group by entryId to get unique persons
    const groupedByPerson = new Map();

    for (const winner of matchingWinners) {
      const key = winner.entryId;
      if (!groupedByPerson.has(key)) {
        groupedByPerson.set(key, []);
      }
      groupedByPerson.get(key).push(winner);
    }

    // Convert to array of person results
    const results = Array.from(groupedByPerson.values()).map(winnerRecords => {
      const grouped = this._groupWinnerPrizes(winnerRecords);
      return {
        ...grouped,
        prizeCount: grouped.prizes.length,
        pendingCount: grouped.prizes.filter(p => !p.pickedUp).length
      };
    });

    // Sort alphabetically by name
    results.sort((a, b) => a.winner.displayName.localeCompare(b.winner.displayName));

    console.log(`Grouped into ${results.length} unique persons`);
    return results;
  }

  /**
   * Auto-detect search type and perform search
   * Returns { type: 'ticketCode' | 'name', results: ... }
   */
  static async search(input) {
    if (this.isTicketCode(input)) {
      const result = await this.findByTicketCode(input);
      return { type: 'ticketCode', result };
    } else {
      const results = await this.findByName(input);
      return { type: 'name', results };
    }
  }

  /**
   * Helper: Group winner records into { winner, prizes } structure
   */
  static _groupWinnerPrizes(winnerRecords) {
    const representative = winnerRecords[0];
    const prizes = winnerRecords.map(w => ({
      winnerId: w.winnerId,
      prize: w.prize,
      timestamp: w.timestamp,
      pickedUp: w.pickedUp || false,
      pickupTimestamp: w.pickupTimestamp || null,
      pickupStation: w.pickupStation || null
    }));

    return {
      winner: representative,
      prizes: prizes
    };
  }
}
