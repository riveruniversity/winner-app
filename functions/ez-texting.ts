/**
 * EZ Texting API Library for Netlify Functions
 * 
 * This library provides a wrapper for the EZ Texting API v1
 * Documentation: https://developers.eztexting.com/
 */

import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

// Type definitions
interface MessageData {
  message: string;
  toNumbers?: string[];
  groupIds?: string[];
  companyName?: string;
  sendAt?: string;
  mediaFileId?: string;
  mediaUrl?: string;
  messageTemplateId?: string;
  fromNumber?: string;
  strictValidation?: boolean;
}

interface APIResponse {
  success: boolean;
  statusCode: number;
  data: any;
  rawResponse: string;
}

interface ValidationResult {
  valid: string[];
  invalid: string[];
}

class EZTextingAPI {
  private username: string;
  private password: string;
  private baseUrl: string;
  private authHeader: string;

  /**
   * Constructor for EZ Texting API wrapper
   */
  constructor(username: string, password: string) {
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    this.username = username;
    this.password = password;
    this.baseUrl = 'https://a.eztexting.com/v1';
    this.authHeader = this._createAuthHeader(username, password);
  }

  /**
   * Creates the base64 encoded authorization header
   */
  private _createAuthHeader(username: string, password: string): string {
    const credentials = `${username}:${password}`;
    const encoded = Buffer.from(credentials).toString('base64');
    return `Basic ${encoded}`;
  }

  /**
   * Validates phone number format
   */
  private _validatePhoneNumber(phoneNumber: string): boolean {
    if (typeof phoneNumber !== 'string') {
      return false;
    }

    // Remove all non-digit characters
    const cleanNumber = phoneNumber.replace(/\D/g, '');

    // Check if length is between 10-15 digits (international format)
    return cleanNumber.length >= 10 && cleanNumber.length <= 15;
  }

  /**
   * Validates an array of phone numbers
   */
  private _validatePhoneNumbers(phoneNumbers: string[]): ValidationResult {
    const valid: string[] = [];
    const invalid: string[] = [];

    phoneNumbers.forEach(number => {
      if (this._validatePhoneNumber(number)) {
        valid.push(number);
      } else {
        invalid.push(number);
      }
    });

    return { valid, invalid };
  }

  /**
   * Makes HTTP request to EZ Texting API
   */
  private async _makeRequest(
    endpoint: string,
    method: string = 'GET',
    payload: any = null
  ): Promise<APIResponse> {
    const url = `${this.baseUrl}${endpoint}`;

    const options: RequestInit = {
      method: method,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json'
      }
    };

    if (payload && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(payload);
    }

    try {
      const response = await fetch(url, options);
      const responseText = await response.text();
      const responseCode = response.status;

      // Parse JSON response if possible
      let responseData: any;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = responseText;
      }

      const result: APIResponse = {
        success: responseCode >= 200 && responseCode < 300,
        statusCode: responseCode,
        data: responseData,
        rawResponse: responseText
      };

      // Enhanced error handling for API errors
      if (!result.success) {
        let errorMessage = `HTTP ${responseCode}`;

        if (responseData && typeof responseData === 'object') {
          if (responseData.error) {
            errorMessage += `: ${responseData.error.message || responseData.error}`;
          } else if (responseData.message) {
            errorMessage += `: ${responseData.message}`;
          }
        }

        throw new Error(`API Error - ${errorMessage}`);
      }

      return result;

    } catch (error: any) {
      if (error.message?.includes('API Error')) {
        throw error; // Re-throw API errors as-is
      }
      throw new Error('Network request failed: ' + error.toString());
    }
  }

  /**
   * Creates and sends a message
   */
  async createMessage(messageData: MessageData): Promise<APIResponse> {
    // Validate required parameters
    if (!messageData) {
      throw new Error('Message data is required');
    }

    if (!messageData.message) {
      throw new Error('Message text is required');
    }

    if (!messageData.toNumbers && !messageData.groupIds) {
      throw new Error('Either toNumbers or groupIds must be provided');
    }

    if (messageData.toNumbers && !Array.isArray(messageData.toNumbers)) {
      throw new Error('toNumbers must be an array');
    }

    if (messageData.groupIds && !Array.isArray(messageData.groupIds)) {
      throw new Error('groupIds must be an array');
    }

    // Validate phone numbers if provided
    if (messageData.toNumbers) {
      const validation = this._validatePhoneNumbers(messageData.toNumbers);
      if (validation.invalid.length > 0) {
        throw new Error(`Invalid phone numbers detected: ${validation.invalid.join(', ')}`);
      }
    }

    // Validate sendAt format if provided
    if (messageData.sendAt) {
      const date = new Date(messageData.sendAt);
      if (isNaN(date.getTime())) {
        throw new Error('sendAt must be a valid ISO datetime string');
      }
    }

    // Build request payload
    const payload: any = {
      message: messageData.message
    };

    // Add optional parameters if provided
    if (messageData.companyName) payload.companyName = messageData.companyName;
    if (messageData.sendAt) payload.sendAt = messageData.sendAt;
    if (messageData.mediaFileId) payload.mediaFileId = messageData.mediaFileId;
    if (messageData.mediaUrl) payload.mediaUrl = messageData.mediaUrl;
    if (messageData.messageTemplateId) payload.messageTemplateId = messageData.messageTemplateId;
    if (messageData.fromNumber) payload.fromNumber = messageData.fromNumber;
    if (messageData.toNumbers) payload.toNumbers = messageData.toNumbers;
    if (messageData.groupIds) payload.groupIds = messageData.groupIds;
    if ('strictValidation' in messageData) {
      payload.strictValidation = messageData.strictValidation;
    }

    return this._makeRequest('/messages', 'POST', payload);
  }

  /**
   * Sends a simple text message to phone numbers
   */
  async sendMessage(
    message: string,
    phoneNumbers: string | string[],
    options: Partial<MessageData> = {}
  ): Promise<APIResponse> {
    const toNumbers = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers];

    const messageData: MessageData = {
      message: message,
      toNumbers: toNumbers,
      ...options
    };

    return this.createMessage(messageData);
  }

  /**
   * Sends a message to contact groups
   */
  async sendMessageToGroups(
    message: string,
    groupIds: string | string[],
    options: Partial<MessageData> = {}
  ): Promise<APIResponse> {
    const groups = Array.isArray(groupIds) ? groupIds : [groupIds];

    const messageData: MessageData = {
      message: message,
      groupIds: groups,
      ...options
    };

    return this.createMessage(messageData);
  }

  /**
   * Schedules a message for future delivery
   */
  async scheduleMessage(
    message: string,
    phoneNumbers: string | string[],
    sendAt: Date | string,
    options: Partial<MessageData> = {}
  ): Promise<APIResponse> {
    const toNumbers = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers];

    // Convert Date to ISO string if needed
    const sendAtString = sendAt instanceof Date ? sendAt.toISOString() : sendAt;

    const messageData: MessageData = {
      message: message,
      toNumbers: toNumbers,
      sendAt: sendAtString,
      ...options
    };

    return this.createMessage(messageData);
  }

  /**
   * Sends a message with media attachment
   */
  async sendMessageWithMedia(
    message: string,
    phoneNumbers: string | string[],
    mediaUrl: string,
    options: Partial<MessageData> = {}
  ): Promise<APIResponse> {
    const toNumbers = Array.isArray(phoneNumbers) ? phoneNumbers : [phoneNumbers];

    const messageData: MessageData = {
      message: message,
      toNumbers: toNumbers,
      mediaUrl: mediaUrl,
      ...options
    };

    return this.createMessage(messageData);
  }

  /**
   * Gets the account's credit balance
   */
  async getCreditBalance(): Promise<APIResponse> {
    return this._makeRequest('/credits', 'GET');
  }

  /**
   * Gets a message report by message ID
   */
  async getMessageReport(messageId: string): Promise<APIResponse> {
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    return this._makeRequest(`/message-reports/${messageId}`, 'GET');
  }

  /**
   * Gets message delivery responses by message ID
   */
  async getMessageDeliveryResponses(messageId: string): Promise<APIResponse> {
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    return this._makeRequest(`/message-reports/${messageId}/responses/delivery`, 'GET');
  }

  /**
   * Gets the current delivery status from a message report response
   */
  getCurrentStatus(messageReportResponse: APIResponse): string {
    if (!messageReportResponse || !messageReportResponse.success) {
      throw new Error('Invalid message report response');
    }

    let deliveryData: any;

    // Try to parse from rawResponse first (more reliable)
    if (messageReportResponse.rawResponse) {
      try {
        const parsedData = JSON.parse(messageReportResponse.rawResponse);
        deliveryData = parsedData.delivery;
      } catch (e) {
        // Fall back to data object if JSON parsing fails
        deliveryData = messageReportResponse.data?.delivery;
      }
    } else {
      deliveryData = messageReportResponse.data?.delivery;
    }

    if (!deliveryData) {
      throw new Error('No delivery data found in message report');
    }

    // Check status priority: Delivered > Bounced > Queued
    if (deliveryData.total_delivered && deliveryData.total_delivered.data > 0) {
      return 'Delivered';
    }

    if (deliveryData.bounced && deliveryData.bounced.data > 0) {
      return 'Bounced';
    }

    if (deliveryData.queued && deliveryData.queued.data > 0) {
      return 'Queued';
    }

    // Default fallback - this shouldn't happen with valid data
    return 'Queued';
  }
}

/**
 * Factory function to create EZ Texting API instance
 */
export function createEZTextingAPI(username: string, password: string): EZTextingAPI {
  return new EZTextingAPI(username, password);
}

/**
 * Netlify Function handler for EZ Texting API operations
 * 
 * This function uses environment variables for authentication:
 * - EZ_TEXTING_USERNAME: Your EZ Texting username/email
 * - EZ_TEXTING_PASSWORD: Your EZ Texting password/API key
 * 
 * Request body should contain:
 * - action: The API action to perform (e.g., 'sendMessage', 'getCreditBalance')
 * - data: Action-specific data
 */
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Get credentials from environment variables
  const username = process.env.EZ_TEXTING_USERNAME;
  const password = process.env.EZ_TEXTING_PASSWORD;

  if (!username || !password) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Server configuration error: EZ Texting credentials not configured' 
      })
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { action, data } = body;

    // Validate required fields
    if (!action) {
      throw new Error('Action is required');
    }

    // Create API instance with environment credentials
    const api = createEZTextingAPI(username, password);

    // Handle different actions
    let result: APIResponse;

    switch (action) {
      case 'sendMessage':
        if (!data.message || !data.phoneNumbers) {
          throw new Error('Message and phoneNumbers are required for sendMessage');
        }
        result = await api.sendMessage(data.message, data.phoneNumbers, data.options || {});
        break;

      case 'sendMessageToGroups':
        if (!data.message || !data.groupIds) {
          throw new Error('Message and groupIds are required for sendMessageToGroups');
        }
        result = await api.sendMessageToGroups(data.message, data.groupIds, data.options || {});
        break;

      case 'scheduleMessage':
        if (!data.message || !data.phoneNumbers || !data.sendAt) {
          throw new Error('Message, phoneNumbers, and sendAt are required for scheduleMessage');
        }
        result = await api.scheduleMessage(data.message, data.phoneNumbers, data.sendAt, data.options || {});
        break;

      case 'sendMessageWithMedia':
        if (!data.message || !data.phoneNumbers || !data.mediaUrl) {
          throw new Error('Message, phoneNumbers, and mediaUrl are required for sendMessageWithMedia');
        }
        result = await api.sendMessageWithMedia(data.message, data.phoneNumbers, data.mediaUrl, data.options || {});
        break;

      case 'createMessage':
        if (!data.messageData) {
          throw new Error('messageData is required for createMessage');
        }
        result = await api.createMessage(data.messageData);
        break;

      case 'getCreditBalance':
        result = await api.getCreditBalance();
        break;

      case 'getMessageReport':
        if (!data.messageId) {
          throw new Error('messageId is required for getMessageReport');
        }
        result = await api.getMessageReport(data.messageId);
        break;

      case 'getMessageDeliveryResponses':
        if (!data.messageId) {
          throw new Error('messageId is required for getMessageDeliveryResponses');
        }
        result = await api.getMessageDeliveryResponses(data.messageId);
        break;

      case 'getCurrentStatus':
        if (!data.messageReportResponse) {
          throw new Error('messageReportResponse is required for getCurrentStatus');
        }
        const status = api.getCurrentStatus(data.messageReportResponse);
        result = {
          success: true,
          statusCode: 200,
          data: { status },
          rawResponse: JSON.stringify({ status })
        };
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Return successful response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(result)
    };

  } catch (error: any) {
    // Return error response
    return {
      statusCode: error.message?.includes('API Error') ? 400 : 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred'
      })
    };
  }
};

// Export the API class and types for use in other functions if needed
export { EZTextingAPI, MessageData, APIResponse, ValidationResult };