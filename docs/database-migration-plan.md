# Database Migration Plan - Centralized Data Store

## Current State

A centralized `Alpine.store('data')` now handles CRUD for core collections:
- `lists`, `prizes`, `winners`, `history`

However, many modules still call `Database` directly, bypassing the centralized store.

---

## Modules to Migrate (Core Collections)

### lists.js
| Function | Current Call | Migrate To |
|----------|--------------|------------|
| `viewList` | `Database.getFromStore('lists', listId)` | `$store.data.getById('lists', listId)` |
| `deleteList` | `Database.deleteFromStore('lists', listId)` | `$store.data.delete('lists', listId)` |
| `renameList` | `Database.getFromStore` + `Database.saveToStore` | `$store.data.getById` + `$store.data.save` |

### prizes.js
| Function | Current Call | Migrate To |
|----------|--------------|------------|
| `handleAddPrize` | `Database.saveToStore('prizes', prize)` | `$store.data.save('prizes', prize)` |
| `deletePrize` | `Database.deleteFromStore('prizes', prizeId)` | `$store.data.delete('prizes', prizeId)` |
| `getPrizes` | `Database.getFromStore('prizes')` | `$store.data.prizes` (cached) |

### winners.js
| Function | Current Call | Migrate To |
|----------|--------------|------------|
| `deleteWinnerConfirm` | `Database.deleteFromStore('winners', winnerId)` | `$store.data.delete('winners', winnerId)` |
| `updateWinner` | `Database.saveToStore('winners', winner)` | `$store.data.save('winners', winner)` |
| `getWinners` | `Database.getFromStore('winners')` | `$store.data.winners` (cached) |
| History cleanup | `Database.getFromStore/saveToStore/deleteFromStore('history')` | `$store.data` methods |

### selection.js
| Function | Current Call | Migrate To |
|----------|--------------|------------|
| Line 135 | `Database.getFromStore('winners')` | `$store.data.winners` |
| Line 463 | `Database.getFromStore('lists', listId)` | `$store.data.getById('lists', listId)` |
| Line 618 | `Database.saveToStore('prizes', selectedPrize)` | `$store.data.save('prizes', prize)` |
| Line 629 | `Database.saveToStore('history', historyEntry)` | `$store.data.save('history', entry)` |
| Line 660-686 | Multiple list save operations | `$store.data.save('lists', list)` |

### app.js
| Function | Current Call | Migrate To |
|----------|--------------|------------|
| `undoLastSelection` | `Database.getFromStore('history')` | `$store.data.history` |
| `undoLastSelection` | `Database.deleteFromStore('history', historyId)` | `$store.data.delete('history', id)` |

### ui.js
| Function | Current Call | Migrate To |
|----------|--------------|------------|
| `updateSelectionInfo` | `Database.getFromStore('winners')` | `$store.data.winners` |

### csv-parser.js
| Function | Current Call | Migrate To |
|----------|--------------|------------|
| Line 581 | `Database.getFromStore('winners')` | `$store.data.winners` |
| Line 657 | `Database.saveToStore('lists', listData)` | `$store.data.save('lists', listData)` |

### export.js
| Function | Current Call | Migrate To |
|----------|--------------|------------|
| `exportWinners` | `Database.getFromStore('winners')` | `$store.data.winners` |
| `exportWinners` | `Database.getFromStore('lists')` | `$store.data.lists` |
| `createBackup` | Multiple getFromStore calls | `$store.data.[collection]` |

---

## Modules to Keep Using Database (Separate Collections)

These collections are not in the centralized store and can continue using `Database` directly:

| Module | Collection | Reason |
|--------|------------|--------|
| `templates.js` | `templates` | Separate concern, not core data |
| `sounds.js` | `sounds` | Separate concern, audio files |
| `texting.js` | `sms_logs` | Logging, not displayed in main UI |
| `export.js` | `backups` | Backup management, separate concern |
| `settings.js` | `settings` | Uses Alpine $persist, separate pattern |

---

## Migration Benefits

1. **Consistent UI updates** - All changes go through centralized store, Alpine reacts automatically
2. **Single source of truth** - No stale data from direct DB reads
3. **Simpler debugging** - One place to log/trace data changes
4. **Reduced DB calls** - Can use cached `$store.data.lists` instead of fetching

---

## Migration Pattern

**Before:**
```javascript
const list = await Database.getFromStore('lists', listId);
list.name = newName;
await Database.saveToStore('lists', list);
await Lists.loadLists(); // Manual refresh needed
```

**After:**
```javascript
const list = Alpine.store('data').getById('lists', listId);
list.name = newName;
await Alpine.store('data').save('lists', list);
// UI updates automatically - no manual refresh needed
```

---

## Priority Order

1. **High** - `selection.js` (core winner selection flow)
2. **High** - `winners.js` (winner management)
3. **Medium** - `lists.js`, `prizes.js` (CRUD operations)
4. **Medium** - `ui.js` (selection info display)
5. **Low** - `export.js` (backup/export reads)
6. **Low** - `csv-parser.js` (import flow)
