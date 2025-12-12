# Fix Quick Setup Warning Reactivity

## Problem
The warning in Quick Setup tab ("No entries available" / "Only X entries available") doesn't update reactively when:
1. Lists are selected/deselected
2. Prize changes (when `preventSamePrize` setting is enabled)
3. Winners data changes

## Root Cause
Alpine.js getters in stores that reference OTHER stores don't trigger reactivity properly. The current implementation uses a local `x-data` getter that accesses `$store.data.lists`, but Alpine doesn't track these cross-store dependencies.

## Solution
Add an `eligibleEntries` getter to the `setup` store that:
1. Uses `Alpine.effect()` internally to track dependencies
2. Accounts for the `preventSamePrize` setting
3. Returns the count that considers prize-based exclusions

## Implementation

### File: `index.html`

#### 1. Update the `setup` store (lines ~1706-1740)

Add `eligibleEntries` property and effect:

```javascript
Alpine.store('setup', {
  selectedListIds: Alpine.$persist([]).as('setup_selectedListIds'),
  selectedPrizeId: Alpine.$persist('').as('setup_selectedPrizeId'),
  winnersCount: Alpine.$persist(1).as('setup_winnersCount'),
  eligibleEntries: 0,  // Computed by effect
  excludedCount: 0,    // How many excluded due to same prize

  init() {
    // Use Alpine.effect() to compute eligibleEntries reactively
    Alpine.effect(() => {
      const dataStore = Alpine.store('data');
      const settingsStore = Alpine.store('settings');

      // Calculate total entries from selected lists
      let total = this.selectedListIds.reduce((sum, listId) => {
        const list = dataStore.lists.find(l => l.listId === listId);
        return sum + (list?.entries?.length || 0);
      }, 0);

      let excluded = 0;

      // If preventSamePrize is enabled and a prize is selected, calculate exclusions
      if (settingsStore.preventSamePrize && this.selectedPrizeId) {
        const prize = dataStore.prizes.find(p => p.prizeId === this.selectedPrizeId);
        const prizeName = prize?.name;

        if (prizeName) {
          // Find entry IDs that already won this prize
          const samePrizeWinnerEntryIds = new Set(
            dataStore.winners
              .filter(w => w.prize === prizeName)
              .map(w => w.entryId)
              .filter(Boolean)
          );

          if (samePrizeWinnerEntryIds.size > 0) {
            // Recount entries excluding same-prize winners
            let eligible = 0;
            for (const listId of this.selectedListIds) {
              const list = dataStore.lists.find(l => l.listId === listId);
              if (list?.entries) {
                for (const entry of list.entries) {
                  const entryId = entry.id || entry.data?.['Ticket Code'] || entry.data?.ticketCode;
                  if (!entryId || !samePrizeWinnerEntryIds.has(entryId)) {
                    eligible++;
                  } else {
                    excluded++;
                  }
                }
              }
            }
            total = eligible;
          }
        }
      }

      this.eligibleEntries = total;
      this.excludedCount = excluded;
    });
  },

  // ... existing methods
});
```

#### 2. Update the warning HTML (lines ~221-236)

Remove the local `x-data` getter and use the store value directly:

```html
<div class="col-md-2">
  <label class="form-label fw-semibold">Number of Winners</label>
  <input type="number" class="form-control form-control-lg" id="quickWinnersCount"
         value="1" min="1" max="9999" placeholder="Count"
         x-model.number="$store.setup.winnersCount"
         :class="{ 'border-danger text-danger': $store.setup.winnersCount > $store.setup.eligibleEntries && $store.setup.selectedListIds.length > 0 }">
  <small class="text-danger d-block mt-1"
         x-show="$store.setup.winnersCount > $store.setup.eligibleEntries && $store.setup.selectedListIds.length > 0"
         x-text="$store.setup.eligibleEntries === 0 ? 'No entries available' : 'Only ' + $store.setup.eligibleEntries + ' entries available' + ($store.setup.excludedCount > 0 ? ' (' + $store.setup.excludedCount + ' excluded)' : '')"></small>
</div>
```

#### 3. Update totalSelectedEntries display (search for id="totalSelectedEntries")

Change to use the reactive store value with exclusion info:

```html
<span id="totalSelectedEntries"
      x-text="$store.setup.eligibleEntries.toLocaleString() + ($store.setup.excludedCount > 0 ? ' (' + $store.setup.excludedCount + ' excluded)' : '')">0</span>
```

## Testing
1. Select a list - warning should NOT show if winnersCount <= entries
2. Enter winnersCount > entries - warning should show
3. Deselect list - warning should show "No entries available"
4. Enable preventSamePrize, select prize that has previous winners - count should decrease
5. Change prize - excluded count should update
