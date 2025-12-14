# Fix Winner Count Reactive State

## Problem
The `winnersCount` field in Setup Tab doesn't update reactively when:
1. Undo is clicked (data reloads but winnersCount stays stale)
2. List selection changes (eligibleEntries changes)
3. List entry count changes (eligibleEntries changes)
4. Prize quantity changes

## Root Cause
- `winnersCount` uses `Alpine.$persist()` (localStorage) - static value
- `onPrizeChange()` only called on prize dropdown `@change` event
- No reactive effect to auto-adjust `winnersCount` when limits change

## Files Involved
- `index.html:2334-2413` - Alpine setup store with `winnersCount`, `eligibleEntries` effect, and `onPrizeChange()`

## Solution: Approach A - Auto-cap when limits change

Add an `Alpine.effect()` that:
1. Watches `eligibleEntries` - when it decreases below `winnersCount`, auto-cap
2. Watches `selectedPrizeQuantity` - when it decreases below `winnersCount`, auto-cap
3. Watches prize data reloads - re-sync `winnersCount` from prize default

### Implementation

Add a second effect in `init()` after the existing `eligibleEntries` effect:

```javascript
// Effect to auto-cap winnersCount when limits change
Alpine.effect(() => {
  const eligibleEntries = this.eligibleEntries;
  const prizeQty = this.selectedPrizeQuantity;

  // Cap to eligibleEntries if exceeded (and entries exist)
  if (eligibleEntries > 0 && this.winnersCount > eligibleEntries) {
    this.winnersCount = eligibleEntries;
  }

  // Cap to prize quantity if exceeded (and quantity is set)
  if (prizeQty !== null && this.winnersCount > prizeQty) {
    this.winnersCount = prizeQty;
  }
});

// Effect to re-sync winnersCount when prize data reloads
Alpine.effect(() => {
  const dataStore = Alpine.store('data');
  const prizes = dataStore?.prizes;

  // When prizes array changes and we have a selection, re-sync
  if (prizes && this.selectedPrizeId) {
    const prize = prizes.find(p => p.prizeId === this.selectedPrizeId);
    if (prize?.winnersCount) {
      this.winnersCount = prize.winnersCount;
    }
  }
});
```

## Tasks
- [ ] Add effect to auto-cap winnersCount when eligibleEntries/prizeQuantity decrease
- [ ] Add effect to re-sync winnersCount when prize data reloads
- [ ] Test undo functionality
- [ ] Test list selection changes
- [ ] Test list entry count changes
- [ ] Test prize quantity changes
