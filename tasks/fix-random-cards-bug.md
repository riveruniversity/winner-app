# Bug Analysis: Random Cards Sliding In During Sequential Display

## Issue Description
Towards the end of winner selection, random cards from different lists slide in unexpectedly, showing different card numbers like 14, 15, etc.

## Root Cause #1: setTimeout Race Condition (MAIN CAUSE)

When a new selection starts while a previous sequential display is still in progress, the old setTimeout callbacks continue to fire and add cards from the previous selection to the grid.

**Scenario:**
1. User selects 15 winners from List A
2. Sequential display creates 15 setTimeout callbacks (card 15 fires at ~7 seconds)
3. User clicks "New Selection" and selects 5 winners from List B
4. New selection clears grid and starts 5 new callbacks
5. **Old callbacks from List A (cards 14, 15) fire and add wrong winners to the grid**

**Fix:** Track pending display timeouts and clear them before starting a new display.

## Root Cause #2: Missing `position` Field

The active code path `performWinnerSelection()` (lines 388-410) does **not** set a `position` field on winner objects.

When `createWinnerCard()` at line 950 runs:
```javascript
numberDiv.textContent = String(winner.position || index + 1);
```

Without `position`, it falls back to the `index` from the forEach loop. During sequential display with setTimeout delays, this becomes unreliable if the winners array is reordered by database/Alpine reactivity.

## Dead Code: `selectWinners()` Function

The legacy `selectWinners()` function (lines 573-754) is **never called**:
- It's defined and exported but no code invokes it
- The active path is: `handleBigPlayClick()` → `selectWinnersWithDelay()` → `performWinnerSelection()`
- It duplicates logic that's now in `performWinnerSelection()` and `selectWinnersWithDelay()`
- It's ~182 lines of dead code

## Implementation Steps

- [ ] Add `position: index + 1` to `performWinnerSelection()` at line 408 (before `data: entry.data`)
- [ ] Remove the entire `selectWinners()` function (lines 573-754)
- [ ] Remove `selectWinners` from the export object at line 1180

## Code Changes

### 1. Add position field to performWinnerSelection (line 408)

```javascript
return {
  winnerId: winnerId,
  entryId: entry.id,
  displayName: Lists.formatDisplayName(entry, getCurrentList().metadata.nameConfig),
  prize: selectedPrize.name,
  timestamp: timestamp + index,
  listId: entry.sourceListId || getCurrentList().listId || getCurrentList().metadata.listId,
  listName: entry.sourceListName || getCurrentList().metadata.name,
  historyId: historyId,
  pickedUp: false,
  pickupTimestamp: null,
  position: index + 1, // ← ADD THIS LINE
  data: entry.data
};
```

### 2. Remove dead selectWinners function (lines 573-754)

Delete the entire function (~182 lines).

### 3. Remove from export (line 1180)

Change from:
```javascript
export const Selection = {
  createRandomWorker,
  handleBigPlayClick,
  showCountdown,
  selectWinners,  // ← REMOVE THIS LINE
  displayWinnersPublicly,
  ...
};
```

To:
```javascript
export const Selection = {
  createRandomWorker,
  handleBigPlayClick,
  showCountdown,
  displayWinnersPublicly,
  ...
};
```
