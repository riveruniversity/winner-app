# Add Parent Phone to Children Import

## Status: COMPLETED

## Goal
When importing children from MP queries, automatically fetch and attach the Head of Household's mobile phone to each child record.

## Implementation Summary

### Backend Changes (`backend/routes/mp.ts`)
1. Added `fetchParentPhones()` helper function that:
   - Takes array of Household_IDs
   - Queries Contacts with `Household_Position_ID = 1` (Head of Household)
   - Returns Map of householdId → Mobile_Phone

2. Modified `/mp/execute` endpoint to:
   - Check for `fetchParentPhone: true` in query config
   - Fetch parent phones for unique household IDs
   - Add `parentPhone` field to each child record
   - Copy `parentPhone` to `mobilePhone` if `mobilePhone` is empty

### Query Changes (`data/mp.json`)
Updated kids queries with:
- Added `Participant_ID_Table_Contact_ID_Table.Household_ID` to select
- Added `"fetchParentPhone": true` flag

Affected queries:
- `christmas-fest-toys-bears`
- `christmas-fest-toys-kids`
- `christmas-fest-toys-youngsters`

### UI Changes (`index.html`)
- Added "Fetch Parent Phone" checkbox in query editor Options section
- Checkbox bound to `editingQuery.fetchParentPhone`

## How It Works
1. When a query with `fetchParentPhone: true` is executed
2. Backend extracts unique Household_IDs from child records
3. Queries MP for Head of Household contacts in those households
4. Adds `parentPhone` to each child record
5. If child's `mobilePhone` is empty, copies `parentPhone` to `mobilePhone`
