# Ministry Platform Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Field Naming Conventions](#field-naming-conventions)
4. [Table Conventions](#table-conventions)
5. [Common Operations](#common-operations)
6. [Query Patterns](#query-patterns)
7. [Error Handling](#error-handling)
8. [Best Practices](#best-practices)
9. [Code Examples](#code-examples)
10. [Common Constants](#common-constants)

## Overview

Ministry Platform (MP) is a church management system that provides APIs for managing contacts, events, participants, and various other church-related data. This guide documents the implementation patterns and best practices for integrating with Ministry Platform using the `mp-js-api` library.

## Authentication

Ministry Platform uses client credentials authentication with username and password.

### Setup
```typescript
import { createMPInstance } from 'mp-js-api';

const mp = createMPInstance({
  auth: {
    username: process.env.MP_USERNAME,
    password: process.env.MP_PASSWORD
  }
});
```

### Environment Variables
```bash
MP_USERNAME=your-mp-client-username
MP_PASSWORD=your-mp-client-password
```

## Field Naming Conventions

The `mp-js-api` library automatically handles field name conversion between database and JavaScript formats.

### Database Fields (underscore_case)
- `Contact_ID`
- `First_Name`
- `Last_Name`
- `Event_ID`
- `Participant_ID`
- `Email_Address`
- `Mobile_Phone`

### API Response Fields (camelCase)
- `contactID`
- `firstName`
- `lastName`
- `eventID`
- `participantID`
- `emailAddress`
- `mobilePhone`

### Special Cases
- **Bracketed fields**: `[State/Region]` for fields with special characters
- **Platform fields**: `dp_` prefix for special fields like `dp_fileUniqueId`

## Table Conventions

### Common Tables
| Table Name | Description |
|------------|-------------|
| `Contacts` | Individual contact records |
| `Participants` | Participant records linked to contacts |
| `Events` | Event definitions |
| `Event_Participants` | Junction table linking participants to events |
| `Groups` | Group definitions |
| `Group_Participants` | Junction table linking participants to groups |
| `Households` | Household/family information |
| `Addresses` | Physical address information |
| `Form_Responses` | Form submission records |
| `Form_Response_Answers` | Individual form field answers |

### Table Lookup Pattern (_Table Suffix)

When joining related tables in SELECT statements, use the `_Table` suffix pattern:

```sql
-- Pattern: {ForeignKeyFieldName}_Table
SELECT 
  Contacts.*,
  Household_ID_Table.*,
  Gender_ID_Table.Gender
FROM Contacts
```

**Important**: Only use `_Table` suffix for joins, not for direct table queries.

#### Examples:
- ✅ Correct for joins: `Event_ID_Table.Event_Title`
- ❌ Incorrect for direct query: `SELECT * FROM Events_Table`
- ✅ Correct for direct query: `SELECT * FROM Events`

## Common Operations

### Finding Records

#### Find Contact
```typescript
// By Contact ID
const contact = await mp.getContacts({ 
  filter: `Contact_ID=${contactId}` 
});

// By ID Card or Contact ID
const contact = await mp.getContacts({ 
  filter: `ID_Card='${id}' OR Contact_ID=${id}` 
});

// By Email
const contact = await mp.getContacts({ 
  filter: `Email_Address='${email}'` 
});
```

#### Find Events
```typescript
// By title (partial match)
const events = await mp.getEvents({
  filter: `Event_Title LIKE '%${searchTerm}%'`,
  select: 'Event_ID, Event_Title, Event_Start_Date'
});

// By date range
const events = await mp.getEvents({
  filter: `Event_Start_Date >= '${startDate}' AND Event_Start_Date <= '${endDate}'`,
  select: 'Event_ID, Event_Title, Event_Start_Date'
});

// By IDs
const events = await mp.getEvents({
  filter: `Event_ID IN (${eventIds.join(',')})`,
  select: 'Event_ID, Event_Title, Event_Start_Date'
});
```

#### Find Event Participants
```typescript
const participants = await mp.getEventParticipants({
  filter: `Event_ID_Table.Event_ID IN (${eventIds}) AND Participation_Status_ID = 2`,
  select: `Participant_ID, 
           Event_ID_Table.Event_Title, 
           Contact_ID_Table.Display_Name, 
           Contact_ID_Table.Email_Address`
});
```

### Creating Records

#### Create Contact
```typescript
const contact = await mp.createContact({
  firstName: 'John',
  lastName: 'Doe',
  nickname: 'Johnny',
  displayName: 'Doe, Johnny',
  emailAddress: 'john@example.com',
  mobilePhone: '555-1234',
  dateOfBirth: '1990-01-01T00:00:00',
  genderID: 1,
  householdID: 12345,
  company: false
});

if (contact && 'error' in contact) {
  console.error('Failed to create contact:', contact.error);
  return;
}
```

#### Create Event Participant
```typescript
const eventParticipant = await mp.createEventParticipant({
  eventID: 123,
  participantID: 456,
  participationStatusID: 2, // Registered
  groupID: 789,
  groupRoleID: 16,
  notes: JSON.stringify({
    registrationType: 'online',
    registrationDate: new Date().toISOString()
  }, null, 2)
});
```

### Updating Records

#### Update Contacts (Batch)
```typescript
const updatedContacts = await mp.updateContacts([
  { contactID: 123, mobilePhone: '555-1234' },
  { contactID: 456, emailAddress: 'new@email.com' }
]);
```

#### Update Group Participants
```typescript
const updated = await mp.updateGroupParticipants([{
  groupParticipantID: 789,
  endDate: new Date().toISOString()
}]);
```

## Query Patterns

### Basic Filters
```sql
-- Equality
Field_Name = 123

-- IN clause
Field_Name IN (1, 2, 3)

-- LIKE (partial match)
Field_Name LIKE '%search%'

-- NULL checks
Field_Name IS NULL
Field_Name IS NOT NULL

-- Date range
Date_Field >= '2025-01-01' AND Date_Field <= '2025-12-31'
```

### Complex Filters
```sql
-- Multiple conditions
Field1 = 123 AND Field2 = 'value'

-- OR conditions
Field1 = 123 OR Field2 = 456

-- Nested conditions
(Field1 = 1 OR Field1 = 2) AND Field3 IS NOT NULL

-- Case-insensitive search
Field_Name COLLATE Latin1_general_CI_AI LIKE '%search%'
```

### Join Patterns
```typescript
// Get participants with event and contact details
const participants = await mp.getEventParticipants({
  filter: `Event_ID_Table.Event_ID = 123`,
  select: `Participant_ID,
           Event_ID_Table.Event_Title,
           Event_ID_Table.Event_Start_Date,
           Contact_ID_Table.Display_Name,
           Contact_ID_Table.Email_Address`
});
```

## Error Handling

### Standard Pattern
Always check for errors before processing results:

```typescript
const result = await mp.getEvents(options);

// Check for error
if (result && 'error' in result) {
  console.error('MP API Error:', result.error);
  return { error: result.error };
}

// Safe to process
const events = result; // TypeScript knows this is Event[]
```

### Error Accumulation Pattern
For multiple operations:

```typescript
const errors = [];
const completed = {};

// Create contact
const contact = await mp.createContact(contactData);
if ('error' in contact) {
  errors.push({ 
    error: contact.error, 
    at: 'createContact' 
  });
  return { errors };
}
completed.contact = contact;

// Create participant
const participant = await mp.createParticipant({
  contactID: contact.contactID
});
if ('error' in participant) {
  errors.push({ 
    error: participant.error, 
    at: 'createParticipant' 
  });
  return { completed, errors };
}
completed.participant = participant;

return { completed, errors };
```

## Best Practices

### 1. Duplicate Prevention
Check for existing records before creating:

```typescript
async function findOrCreateContact(person) {
  // Check by email first
  const existing = await mp.getContacts({
    filter: `Email_Address='${person.email}'`
  });
  
  if (existing && !('error' in existing) && existing.length > 0) {
    return existing[0];
  }
  
  // Create new contact
  return await mp.createContact(person);
}
```

### 2. Phone Number Handling
Clean and format phone numbers consistently:

```typescript
function cleanPhoneNumber(phone) {
  return phone?.replace(/\D/g, '') || '';
}

function formatPhone(phone) {
  const cleaned = cleanPhoneNumber(phone);
  if (cleaned.length === 10) {
    return `${cleaned.slice(0,3)}-${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
  }
  return phone;
}
```

### 3. Date Formatting
Format dates as ISO strings:

```typescript
// For date only fields
const dateOfBirth = new Date('1990-01-01').toISOString().split('T')[0] + 'T00:00:00';

// For datetime fields
const eventDate = new Date().toISOString();
```

### 4. Structured Notes
Store complex data in notes fields as JSON:

```typescript
const notes = {
  registrationType: 'online',
  registrationDate: new Date().toISOString(),
  metadata: {
    source: 'website',
    campaign: 'summer2025'
  }
};

await mp.createEventParticipant({
  eventID: 123,
  participantID: 456,
  notes: JSON.stringify(notes, null, 2) // Pretty format for readability
});
```

### 5. Batch Operations
Use batch operations for better performance:

```typescript
// Instead of multiple individual updates
for (const contact of contacts) {
  await mp.updateContact(contact); // ❌ Slow
}

// Use batch update
await mp.updateContacts(contacts); // ✅ Fast
```

### 6. Null Checks in Filters
Always consider NULL values in date filters:

```typescript
// Find active group participants
const active = await mp.getGroupParticipants({
  filter: `Group_ID = 123 AND End_Date IS NULL`
});

// Find past participants
const past = await mp.getGroupParticipants({
  filter: `Group_ID = 123 AND End_Date IS NOT NULL`
});
```

## Code Examples

### Complete Event Registration Flow
```typescript
async function registerForEvent(eventId, personData) {
  const errors = [];
  
  // 1. Find or create contact
  let contact = await mp.getContacts({
    filter: `Email_Address='${personData.email}'`
  });
  
  if ('error' in contact) {
    return { error: contact.error };
  }
  
  if (contact.length === 0) {
    // Create new contact
    contact = await mp.createContact({
      firstName: personData.firstName,
      lastName: personData.lastName,
      displayName: `${personData.lastName}, ${personData.firstName}`,
      emailAddress: personData.email,
      mobilePhone: formatPhone(personData.phone)
    });
    
    if ('error' in contact) {
      return { error: contact.error };
    }
  } else {
    contact = contact[0];
  }
  
  // 2. Get or create participant record
  let participant;
  if (!contact.participantRecord) {
    participant = await mp.createParticipant({
      contactID: contact.contactID,
      participantTypeID: 4 // Guest
    });
    
    if ('error' in participant) {
      return { error: participant.error };
    }
  } else {
    participant = { participantID: contact.participantRecord };
  }
  
  // 3. Check if already registered
  const existing = await mp.getEventParticipants({
    filter: `Event_ID=${eventId} AND Participant_ID=${participant.participantID}`
  });
  
  if (!('error' in existing) && existing.length > 0) {
    return { 
      success: false, 
      message: 'Already registered for this event' 
    };
  }
  
  // 4. Create event registration
  const registration = await mp.createEventParticipant({
    eventID: eventId,
    participantID: participant.participantID,
    participationStatusID: 2, // Registered
    notes: JSON.stringify({
      registrationDate: new Date().toISOString(),
      source: 'online'
    }, null, 2)
  });
  
  if ('error' in registration) {
    return { error: registration.error };
  }
  
  return {
    success: true,
    contact: contact,
    registration: registration
  };
}
```

### Bulk Import with Deduplication
```typescript
async function bulkImportContacts(csvData) {
  const results = {
    created: [],
    updated: [],
    errors: []
  };
  
  // Get all existing contacts by email for deduplication
  const emails = csvData.map(row => row.email).filter(Boolean);
  const existing = await mp.getContacts({
    filter: `Email_Address IN ('${emails.join("','")}')`
  });
  
  if ('error' in existing) {
    return { error: existing.error };
  }
  
  // Create email lookup map
  const existingByEmail = {};
  existing.forEach(contact => {
    if (contact.emailAddress) {
      existingByEmail[contact.emailAddress.toLowerCase()] = contact;
    }
  });
  
  // Process each row
  for (const row of csvData) {
    const email = row.email?.toLowerCase();
    
    if (email && existingByEmail[email]) {
      // Update existing contact
      const updated = await mp.updateContacts([{
        contactID: existingByEmail[email].contactID,
        mobilePhone: formatPhone(row.phone),
        dateOfBirth: row.birthDate ? 
          new Date(row.birthDate).toISOString().split('T')[0] + 'T00:00:00' : 
          undefined
      }]);
      
      if ('error' in updated) {
        results.errors.push({ row, error: updated.error });
      } else {
        results.updated.push(updated[0]);
      }
    } else {
      // Create new contact
      const created = await mp.createContact({
        firstName: row.firstName,
        lastName: row.lastName,
        displayName: `${row.lastName}, ${row.firstName}`,
        emailAddress: row.email,
        mobilePhone: formatPhone(row.phone),
        dateOfBirth: row.birthDate ? 
          new Date(row.birthDate).toISOString().split('T')[0] + 'T00:00:00' : 
          undefined
      });
      
      if ('error' in created) {
        results.errors.push({ row, error: created.error });
      } else {
        results.created.push(created);
      }
    }
  }
  
  return results;
}
```

## Common Constants

### Participation Status
| ID | Status |
|----|--------|
| 2 | Registered |
| 3 | Attended |
| 4 | No Show |
| 5 | Cancelled |

### Gender IDs
| ID | Gender |
|----|--------|
| 1 | Male |
| 2 | Female |

### Household Positions
| ID | Position |
|----|----------|
| 1 | Head of Household |
| 2 | Child |
| 3 | Other |

### Participant Types
| ID | Type |
|----|------|
| 4 | Guest |
| 5 | Attender |
| 6 | Member |
| 11 | Child |

### Group Roles
| ID | Role |
|----|------|
| 16 | Member |
| 22 | Leader |

## Troubleshooting

### Common Issues

#### 1. Field Name Not Found
**Problem**: Error saying field doesn't exist
**Solution**: Remember to use underscore_case in filters, not camelCase

```typescript
// ❌ Wrong
filter: `eventID = 123`

// ✅ Correct
filter: `Event_ID = 123`
```

#### 2. Empty Results When Joining Tables
**Problem**: Query returns empty when using _Table suffix
**Solution**: Only use _Table suffix for actual joins, not direct queries

```typescript
// ❌ Wrong - direct query doesn't need _Table
await mp.getEvents({
  filter: `Event_ID_Table.Event_ID = 123`
});

// ✅ Correct - direct query
await mp.getEvents({
  filter: `Event_ID = 123`
});

// ✅ Correct - join query needs _Table
await mp.getEventParticipants({
  filter: `Event_ID_Table.Event_ID = 123`,
  select: 'Participant_ID, Event_ID_Table.Event_Title'
});
```

#### 3. Date Comparison Issues
**Problem**: Date filters not working as expected
**Solution**: Use ISO format with time component

```typescript
// ❌ May not work consistently
filter: `Event_Date >= '2025-01-01'`

// ✅ Better
filter: `Event_Date >= '2025-01-01T00:00:00'`
```

## Integration with Winner App

The Winner App integrates with Ministry Platform to:
1. Import event participant lists for prize drawings
2. Track winner information back to MP contacts
3. Sync prize pickup status

### Configuration
Store queries in `/data/mp.json`:

```json
{
  "queries": [
    {
      "id": "event-participants",
      "name": "Event Participants",
      "table": "Event_Participants",
      "filter": "Event_ID_Table.Event_ID IN ({{eventId}}) AND Participation_Status_ID = 2",
      "select": "Participant_ID, Contact_ID_Table.Display_Name, Contact_ID_Table.Email_Address",
      "params": {
        "eventId": {
          "type": "number",
          "label": "Event ID(s)",
          "required": true,
          "searchTerm": "Conference 2025"
        }
      }
    }
  ]
}
```

### API Endpoints
- `GET /api/mp/queries` - List available queries
- `POST /api/mp/execute` - Execute a query with parameters
- `POST /api/mp/events` - Search for events

---

*Last Updated: November 2024*
*Version: 2.0.0*