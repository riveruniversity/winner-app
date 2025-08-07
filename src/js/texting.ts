import { APIResponse } from "../../functions/ez-texting";


export async function sendSingleText(data: any) {

  const body = {
    action: 'sendMessage',
    data: data
  };

  return post(body);
}


async function test_sendSingleText(data: any) {

  const body = {
    action: 'sendMessage',
    data: {
      message: 'Hello from Netlify!',
      phoneNumbers: ['8134507575'],
      options: {
        companyName: 'My Company'
      }
    }
  };

  return post(body);
}




async function post(body: Record<string, any>): Promise<APIResponse> {

  // Example client-side usage
  const response = await fetch('/.netlify/functions/ez-texting', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });


  return response.json() as Promise<APIResponse>;
}