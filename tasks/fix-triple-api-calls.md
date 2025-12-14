# Fix: Triple API Calls on Prize Selection

## Problem
When selecting a prize from the Quick Setup Tab, the API calls `GET api/winners` and `POST api/batch` run 3 times instead of once.

## Root Cause Analysis

In `src/js/modules/settings.js` lines 1330-1372, the `setupQuickSetupAutoSave()` function sets up **multiple overlapping event handlers** for `quickPrizeSelect`:

### Current Event Handler Chain

For `quickPrizeSelect` (`<select>` element):

1. **Line 1343-1345**: `change` event → `fieldSpecificImmediateSave`
   - Calls `autoSaveQuickSetup('quickPrizeSelect')`
   - Which calls `saveMultipleSettings()` → triggers `Database.batchSave()`
   - Then calls `updateQuickSelectionUI()` → `UI.updateSelectionInfo()` **[CALL 1]**
     - `Database.getFromStore('winners')` → GET /api/winners
     - `Database.batchFetch()` → POST /api/batch

2. **Line 1364**: `input` event → `updateUIHandler`
   - Calls `UI.updateSelectionInfo()` directly **[CALL 2]**
   - (For `<select>` elements, `input` fires alongside `change`)

3. **Line 1365**: `change` event → `updateUIHandler`
   - Calls `UI.updateSelectionInfo()` again **[CALL 3]**

### Result
`UI.updateSelectionInfo()` runs **3 times** on every prize selection, causing:
- 3x `GET /api/winners`
- 3x `POST /api/batch`

## Solution

Remove the redundant `updateUIHandler` registration for `quickPrizeSelect` since `autoSaveQuickSetup()` already calls `updateQuickSelectionUI()` which triggers `UI.updateSelectionInfo()`.

**Note:** Keep the handler for `quickWinnersCount` since number inputs need the debounced `input` event handling differently.

### Code Change

In `src/js/modules/settings.js` lines 1356-1367, change:

```javascript
// Update UI when winner count or prize changes
if (fieldId === 'quickWinnersCount' || fieldId === 'quickPrizeSelect') {
  const updateUIHandler = async () => {
    if (UI && UI.updateSelectionInfo) {
      await UI.updateSelectionInfo();
    }
  };
  cleanupFunctions.push(
    eventManager.on(field, 'input', updateUIHandler),
    eventManager.on(field, 'change', updateUIHandler)
  );
}
```

To:

```javascript
// Update UI when winner count changes (prize is handled by autoSaveQuickSetup)
if (fieldId === 'quickWinnersCount') {
  const updateUIHandler = async () => {
    if (UI && UI.updateSelectionInfo) {
      await UI.updateSelectionInfo();
    }
  };
  cleanupFunctions.push(
    eventManager.on(field, 'input', updateUIHandler),
    eventManager.on(field, 'change', updateUIHandler)
  );
}
```

## Impact
- Prize selection triggers UI update once (via `autoSaveQuickSetup` → `updateQuickSelectionUI`)
- Winner count changes still trigger UI update correctly
- API calls reduced from 3x to 1x per prize selection
