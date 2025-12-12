export interface TextingResult {
  success: boolean;
  statusCode: number;
  data: any;
  rawResponse: string;
}

export interface SendMessageData {
  message: string;
  phoneNumbers: string[];
  options?: Record<string, any>;
}

export interface MessageReportData {
  messageId: string;
}

function getCredentials(): { username: string; password: string } {
  const username = process.env.EZ_TEXTING_USERNAME;
  const password = process.env.EZ_TEXTING_PASSWORD;

  if (!username || !password) {
    throw new Error('Texting credentials not configured');
  }

  return { username, password };
}

function createAuthHeader(username: string, password: string): string {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

export async function sendMessage(data: SendMessageData): Promise<TextingResult> {
  const { username, password } = getCredentials();
  const authHeader = createAuthHeader(username, password);

  if (!data.message || !data.phoneNumbers) {
    throw new Error('Message and phoneNumbers are required');
  }

  const requestBody = {
    message: data.message,
    toNumbers: data.phoneNumbers,
    ...data.options
  };

  console.log(`Sending SMS to ${data.phoneNumbers.length} recipient(s)`);

  const response = await fetch('https://a.eztexting.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  const responseText = await response.text();
  let responseData: any;
  try {
    responseData = JSON.parse(responseText);
  } catch {
    responseData = responseText;
  }

  if (response.ok) {
    console.log(`SMS sent successfully: ${responseData.id}`);
  } else {
    console.error(`SMS failed: ${response.status}`, responseData);
  }

  return {
    success: response.ok,
    statusCode: response.status,
    data: responseData,
    rawResponse: responseText
  };
}

export async function getMessageReport(data: MessageReportData): Promise<TextingResult> {
  const { username, password } = getCredentials();
  const authHeader = createAuthHeader(username, password);

  if (!data.messageId) {
    throw new Error('messageId is required');
  }

  const response = await fetch(`https://a.eztexting.com/v1/message-reports/${data.messageId}`, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    }
  });

  const responseText = await response.text();
  let responseData: any;
  try {
    responseData = JSON.parse(responseText);
  } catch {
    responseData = responseText;
  }

  return {
    success: response.ok,
    statusCode: response.status,
    data: responseData,
    rawResponse: responseText
  };
}
