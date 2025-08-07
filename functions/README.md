# Netlify Functions

## EZ Texting API Function

This serverless function provides a secure wrapper for the EZ Texting API, allowing you to send SMS messages without exposing credentials to the client.

### Setup

1. **Set Environment Variables** in Netlify:
   - Go to your Netlify site settings → Environment variables
   - Add the following:
     ```
     EZ_TEXTING_USERNAME=your-email@example.com
     EZ_TEXTING_PASSWORD=your-api-key-or-password
     ```

2. **Local Development**:
   - Create a `.env` file in the project root (copy from `.env.example`)
   - Add your EZ Texting credentials
   - Run `netlify dev` to test locally with environment variables

### Usage

The function endpoint will be available at:
- Production: `https://your-site.netlify.app/.netlify/functions/ez-texting`
- Local: `http://localhost:3000/.netlify/functions/ez-texting`

### API Actions

#### Send Message
```javascript
const response = await fetch('/.netlify/functions/ez-texting', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'sendMessage',
    data: {
      message: 'Hello from the Winner App!',
      phoneNumbers: ['1234567890', '0987654321'],
      options: {
        companyName: 'River University'
      }
    }
  })
});

const result = await response.json();
```

#### Send to Groups
```javascript
const response = await fetch('/.netlify/functions/ez-texting', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'sendMessageToGroups',
    data: {
      message: 'Group announcement!',
      groupIds: ['group-123', 'group-456']
    }
  })
});
```

#### Schedule Message
```javascript
const response = await fetch('/.netlify/functions/ez-texting', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'scheduleMessage',
    data: {
      message: 'Reminder: Event tomorrow!',
      phoneNumbers: ['1234567890'],
      sendAt: '2024-12-25T10:00:00Z'
    }
  })
});
```

#### Send with Media
```javascript
const response = await fetch('/.netlify/functions/ez-texting', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'sendMessageWithMedia',
    data: {
      message: 'Check out this prize!',
      phoneNumbers: ['1234567890'],
      mediaUrl: 'https://example.com/image.jpg'
    }
  })
});
```

#### Get Credit Balance
```javascript
const response = await fetch('/.netlify/functions/ez-texting', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'getCreditBalance',
    data: {}
  })
});
```

#### Get Message Report
```javascript
const response = await fetch('/.netlify/functions/ez-texting', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'getMessageReport',
    data: {
      messageId: 'msg-123456'
    }
  })
});
```

### Integration with Winner App

To integrate SMS notifications when winners are selected:

```javascript
// In your winner selection module
async function notifyWinner(winner) {
  try {
    const response = await fetch('/.netlify/functions/ez-texting', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'sendMessage',
        data: {
          message: `Congratulations ${winner.name}! You've won ${winner.prize}. Your ticket code is ${winner.ticketCode}`,
          phoneNumbers: [winner.phone],
          options: {
            companyName: 'River Winner App'
          }
        }
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('SMS sent successfully:', result.data);
    } else {
      console.error('SMS failed:', result.error);
    }
  } catch (error) {
    console.error('Error sending SMS:', error);
  }
}
```

### Error Handling

The function returns appropriate HTTP status codes:
- `200`: Success
- `400`: Bad request (invalid parameters, API errors)
- `405`: Method not allowed (only POST is supported)
- `500`: Server error (missing credentials, network issues)

Response format:
```javascript
// Success
{
  "success": true,
  "statusCode": 200,
  "data": { /* API response data */ },
  "rawResponse": "..."
}

// Error
{
  "success": false,
  "error": "Error message here"
}
```

### Rate Limiting

EZ Texting API has rate limits. The function doesn't implement rate limiting internally, so consider:
1. Implementing client-side throttling
2. Using a queue system for bulk messages
3. Monitoring your API usage in the EZ Texting dashboard

### Security Notes

- Credentials are stored as environment variables, never exposed to the client
- The function validates all input parameters
- Phone numbers are validated before sending
- Consider adding additional authentication (e.g., API keys) for production use
- Add CORS headers if needed for specific domains