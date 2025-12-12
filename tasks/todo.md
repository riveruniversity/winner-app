# Add Winner Name Search Feature

## Summary
Extend the prize lookup feature to search by winner name in addition to ticket code.

## Current Behavior
- Manual search input only accepts 24-character ticket codes (`/^[a-z0-9]{24}$/`)
- Searches by exact match on `entryId` field
- Single result display (one winner with their prizes)

## Proposed Changes

### Option A: Smart Auto-Detection (Recommended)
Automatically detect whether input is a ticket code or name based on format:
- If input matches ticket code format (24 chars, alphanumeric) → search by ticket code
- Otherwise → search by winner name (case-insensitive partial match)

**Pros:** Single input field, simpler UI, intuitive
**Cons:** Edge case if someone's name happens to be 24 alphanumeric chars

### Option B: Separate Input Fields
Add a second input field specifically for name search.

**Pros:** Explicit, no ambiguity
**Cons:** More cluttered UI

### Option C: Toggle/Dropdown
Add a dropdown or toggle to switch between "Ticket Code" and "Name" search modes.

**Pros:** Clear distinction
**Cons:** Extra click required

---

## Implementation Plan (for Option A)

### 1. Update `qr-scanner.js`
- [ ] Add `findWinnersByName(searchTerm)` method
  - Case-insensitive partial match on `displayName`
  - Returns array of unique persons (grouped by entryId)

### 2. Update `scan-app.js`
- [ ] Modify `searchByTicketCode()` to auto-detect search type
- [ ] Rename to generic `performSearch()`
- [ ] Handle name search returning multiple matches

### 3. Update `scan.html`
- [ ] Update placeholder text to indicate both search types
- [ ] Add UI for displaying multiple search results (name search)
- [ ] Add result selection when multiple matches found

### 4. Handle Multiple Results
- [ ] When name search returns multiple people:
  - Show a selection list
  - User clicks to view that person's prizes
  - Back button returns to search results

---

## Files to Modify
1. `src/js/modules/qr-scanner.js` - Add name search method
2. `src/js/scan-app.js` - Update search logic
3. `scan.html` - Update UI for dual search and multiple results