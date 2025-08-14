# Giveaway Exports API Documentation

## Overview
The Pretix Reports application provides SQL-based CSV exports for event giveaways. These exports filter attendees based on eligibility criteria and output CSV files with contact information for giveaway fulfillment.

## Available Giveaway Export Endpoints

### 1. Adult Car Giveaway Export
**Filename:** `export_giveaways_adults_car.sql`
**Requirements:** Valid driver's license required

### 2. Adult General Giveaway Export  
**Filename:** `export_giveaways_adults_general.sql`
**Requirements:** No driver's license required

### 3. Minors Under 12 Giveaway Export
**Filename:** `export_giveaways_minors_under_12.sql`
**Requirements:** Minor ticket with age group "under 12"

### 4. Minors Over 12 Giveaway Export
**Filename:** `export_giveaways_minors_over_12.sql`
**Requirements:** Minor ticket with age group "over 12"

### 5. Excluded Adults Report
**Filename:** `export_giveaways_adults_excluded.sql`
**Purpose:** Shows adults who were excluded from giveaways and the reasons why

## API Endpoint Structure

### Base URL
```
https://tickets.revival.com/reports/
```

### Authentication
HTTP Basic Authentication is required for all API calls:
- Username: `admin`
- Password: `revival`

### Execute Export Endpoint
```
GET /execute/{filename}
```

#### Parameters
- **filename** (path parameter, required): The SQL filename to execute (e.g., `export_giveaways_adults_car.sql`)
- **event_id** (query parameter, required): The Pretix event ID to filter by
- **report_type** (query parameter, required): Time range filter
  - `morning`: Today 4am-3pm CDT
  - `night`: Today 3pm-4am CDT next day
  - `today`: Today 4am to current time
  - `last5`: Last 5 hours from now
  - `custom`: Custom time range (requires additional parameters)
- **custom_start** (query parameter, optional): Start datetime for custom range (ISO format)
- **custom_end** (query parameter, optional): End datetime for custom range (ISO format)

## Export CSV Fields

All giveaway exports return the following CSV columns:
- **Order ID**: Order confirmation code (e.g., M3A77)
- **Name**: Attendee's full name
- **Ticket Code**: Individual ticket QR code secret
- **Order Email**: Email address for the order
- **Phone Number**: Contact phone number
- **ZIP Code**: Attendee's ZIP code
- **Language**: Language preference (e.g., 'en' for English)
- **Ticket**: Ticket type (lowercase, e.g., 'adult ticket', 'minor ticket')

## Eligibility Criteria

### Common Exclusions (All Giveaways)
- Ministers (identified by `minister_pastor = True` flag)
- Volunteers (identified by `is_volunteer = True` flag OR ticket name containing 'Volunteer')
- Emails associated with ANY volunteer ticket across all events
- Emails in the `excluded_giveaway_emails` table
- Test/fake entries (names containing digits)
- Invalid phone numbers (empty, NULL, or just '-')

### Adult Giveaways
**Required:**
- Must have an Adult ticket (item name containing 'Adult')
- Must have successfully checked in during the specified time range

**Car Giveaway Additional Requirement:**
- Must have valid driver's license (`valid_license = True`)

### Minor Giveaways
**Required:**
- Must have a Minor ticket (item name containing 'Minor')
- Must have appropriate age group answer
- Falls back to adult guardian's phone if minor has no phone

## Example API Calls

### Using cURL

#### Export Adults for Car Giveaway (Morning Session)
```bash
curl -u admin:revival \
  "https://tickets.revival.com/reports/execute/export_giveaways_adults_car.sql?event_id=chicago-extended&report_type=morning" \
  -o car_giveaway_morning.csv
```

#### Export General Adult Giveaway (Last 5 Hours)
```bash
curl -u admin:revival \
  "https://tickets.revival.com/reports/execute/export_giveaways_adults_general.sql?event_id=chicago-extended&report_type=last5" \
  -o general_giveaway.csv
```

#### Export with Custom Time Range
```bash
curl -u admin:revival \
  "https://tickets.revival.com/reports/execute/export_giveaways_minors_under_12.sql?event_id=chicago-extended&report_type=custom&custom_start=2024-08-10T09:00:00&custom_end=2024-08-10T15:00:00" \
  -o minors_under_12_custom.csv
```

### Using Python

```python
import requests
from requests.auth import HTTPBasicAuth

# Configuration
BASE_URL = "https://tickets.revival.com/reports"
AUTH = HTTPBasicAuth('admin', 'revival')

def export_giveaway(filename, event_id, report_type, custom_start=None, custom_end=None):
    """Export giveaway data as CSV"""
    params = {
        'event_id': event_id,
        'report_type': report_type
    }
    
    if report_type == 'custom':
        params['custom_start'] = custom_start
        params['custom_end'] = custom_end
    
    response = requests.get(
        f"{BASE_URL}/execute/{filename}",
        params=params,
        auth=AUTH
    )
    
    if response.status_code == 200:
        # Save CSV file
        output_filename = filename.replace('.sql', f'_{report_type}.csv')
        with open(output_filename, 'w') as f:
            f.write(response.text)
        print(f"Exported to {output_filename}")
        return response.text
    else:
        print(f"Error: {response.status_code} - {response.text}")
        return None

# Example usage
export_giveaway(
    'export_giveaways_adults_car.sql',
    'chicago-extended',
    'morning'
)
```

### Using JavaScript/Node.js

```javascript
const axios = require('axios');

const BASE_URL = 'https://tickets.revival.com/reports';
const AUTH = {
    username: 'admin',
    password: 'revival'
};

async function exportGiveaway(filename, eventId, reportType, customStart = null, customEnd = null) {
    const params = {
        event_id: eventId,
        report_type: reportType
    };
    
    if (reportType === 'custom') {
        params.custom_start = customStart;
        params.custom_end = customEnd;
    }
    
    try {
        const response = await axios.get(
            `${BASE_URL}/execute/${filename}`,
            {
                params: params,
                auth: AUTH,
                responseType: 'text'
            }
        );
        
        // Save to file
        const fs = require('fs');
        const outputFilename = filename.replace('.sql', `_${reportType}.csv`);
        fs.writeFileSync(outputFilename, response.data);
        console.log(`Exported to ${outputFilename}`);
        return response.data;
    } catch (error) {
        console.error(`Error: ${error.response?.status} - ${error.response?.data}`);
        return null;
    }
}

// Example usage
exportGiveaway(
    'export_giveaways_adults_general.sql',
    'chicago-extended',
    'last5'
);
```

## Response Format

### Success Response
- **Status Code:** 200
- **Content-Type:** text/csv
- **Headers:**
  - `Content-Disposition`: Contains suggested filename
  - `X-Query-Execution-Time`: Query execution time (e.g., "1.234s")
- **Body:** CSV data with headers

### Error Responses

#### 400 Bad Request
- Invalid filename format
- Invalid event ID format
- Missing required parameters

#### 401 Unauthorized
- Invalid authentication credentials

#### 404 Not Found
- SQL file does not exist

#### 500 Internal Server Error
- Database query execution error
- Returns error details in response body

## Performance Considerations

- Query execution time is returned in the `X-Query-Execution-Time` header
- Queries taking over 2 seconds may indicate performance issues
- Use specific time ranges to reduce data volume
- The system uses DISTINCT ON to prevent duplicate entries per attendee

## Data Privacy & Security

- All API endpoints require authentication
- SQL injection is prevented through parameterized queries
- Path traversal attacks are blocked through filename validation
- Sensitive data (phone, email) is only exposed to authenticated users
- Consider implementing API rate limiting for production use

## Time Zone Information

All time filters use Central Time (America/Chicago):
- Morning: 4:00 AM - 3:00 PM CDT
- Night: 3:00 PM - 4:00 AM CDT (next day)
- Internally converted to UTC for database queries

## Testing the API

### Health Check
```bash
curl https://tickets.revival.com/reports/health
```

### List Available Reports
```bash
curl -u admin:revival https://tickets.revival.com/reports/api/reports
```

### List Available Events
```bash
curl -u admin:revival https://tickets.revival.com/reports/api/events
```

## Integration Best Practices

1. **Authentication**: Store credentials securely, never hardcode in production
2. **Error Handling**: Always check response status codes and handle errors appropriately
3. **Rate Limiting**: Implement delays between requests to avoid overloading the server
4. **Caching**: Cache results when appropriate to reduce server load
5. **Time Ranges**: Use specific time ranges rather than broad queries for better performance
6. **CSV Parsing**: Use proper CSV parsing libraries to handle special characters and quotes
7. **Logging**: Log all API calls for audit and debugging purposes

## Support

For issues or questions about the API:
- Check server logs: `journalctl -u sql-reports -f`
- Review SQL files in `/srv/reports/sql/`
- Contact system administrator for database or permission issues