# Family Member Winner Search Feature

## Overview
Add a fallback search feature to the scan module that finds family members who won prizes when a parent scans their QR code (idCard) but isn't a direct winner.

**Scope:** Only applies to MP-formatted idCards matching `/^[A-Z]-\d{5,7}$/` (e.g., "A-167162")

## Current Flow
1. Parent scans their QR code → e.g., "A-123456"
2. System looks for winner with `entryId === "A-123456"`
3. Not found → Shows "No Winner Found" alert

## Proposed Flow
1. Parent scans their QR code → e.g., "A-123456"
2. System looks for winner with `entryId === "A-123456"` (direct match)
3. If not found AND idCard matches MP format (`/^[A-Z]-\d{5,7}$/`):
   - Call MP API with the idCard to get family member idCards
   - Match family idCards against winners (`data.idCard` or `entryId`)
4. Show list of family members who won with distinct UI

## Implementation Tasks

### Backend (routes.ts)
- [x] Add new endpoint `POST /api/mp/family-members`
  - Input: `{ idCard: string }` (parent's idCard, e.g., "A-123456")
  - Uses MP API to query Contacts by ID_Card → get Household_ID
  - Queries all Contacts in same Household
  - Returns: `{ success: true, familyIdCards: string[], householdId }`

### Frontend - winner-search.js
- [x] Add method `isMPIdCard(input)` - checks for `/^[A-Z]-\d{5,7}$/` format
- [x] Add method `findFamilyWinners(idCard, winners)`
  - Calls `/api/mp/family-members` API
  - Matches returned idCards against local winners (`data.idCard` or `entryId`)
  - Returns array of family winner objects
- [x] Update `findByTicketCode()` to call `findFamilyWinners()` as fallback
  - Only for idCards matching `/^[A-Z]-\d{5,7}$/`
  - Returns `{ type: 'familyWinners', scannedIdCard, results: [...] }` for family matches

### Frontend - scanner.js
- [x] Add `onFamilyWinners` callback
- [x] Update `handleScanResult()` to check for `type: 'familyWinners'` and call appropriate callback

### Frontend - scan-app.js
- [x] Set up `Scanner.onFamilyWinners` callback
- [x] Handle family winners in `performSearch()` for manual search
- [x] Reset `isFamilySearch` and `scannedIdCard` in `backToScanner()`

### Frontend - scan.html
- [x] Add `isFamilySearch` and `scannedIdCard` state to Alpine store
- [x] Show "Family Members Who Won" header with alert-info styling when isFamilySearch
- [x] Show scanned idCard info (not a winner)
- [x] Hide "Refine search" input for family searches
- [x] Update backToScanner() placeholder to reset new state

## Data Flow Example
```
Parent scans: "A-100000"
↓
No direct winner match (entryId lookup)
↓
idCard matches /^[A-Z]-\d{5,7}$/ → proceed with family lookup
↓
MP API: Get family members for idCard "A-100000"
↓
Returns family idCards: ["A-167162", "A-159077", ...]
↓
Match against winners.data.idCard or entryId
↓
Found: Michael Francois (A-167162), Adrian Francois (A-159077)
↓
Display family winners UI
```

## Defaults
- Show ALL family winners (both pending and picked up)
- Parent CAN mark pickup on behalf of children
- Use Households table for family lookup
