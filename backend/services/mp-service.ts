import { createMPInstance, type MPInstance, type ErrorDetails } from 'mp-js-api';

// Create singleton MP instance
let mpInstance: MPInstance | null = null;

export function getMPInstance(): MPInstance | null {
  if (!process.env.MP_USERNAME || !process.env.MP_PASSWORD) {
    console.warn('MinistryPlatform credentials not configured');
    return null;
  }

  if (!mpInstance) {
    try {
      console.log('Creating new MP instance...');
      mpInstance = createMPInstance({
        auth: {
          username: process.env.MP_USERNAME,
          password: process.env.MP_PASSWORD
        }
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to create MP instance:', errorMessage);
      mpInstance = null;
      throw new Error(`Failed to initialize MinistryPlatform: ${errorMessage}`);
    }
  }

  return mpInstance;
}

/**
 * Async batch update for contacts with missing idCard values.
 * Fire-and-forget pattern - does not block the caller.
 */
export async function updateMissingIdCards(
  mp: MPInstance,
  records: Array<{ contactID: number; idCard: string }>
): Promise<void> {
  try {
    console.log(`Updating ${records.length} contacts with generated idCard values...`);
    const result = await mp.updateContacts(records);

    if ('error' in result) {
      console.error('Failed to update idCard values in MP:', result.error.message);
    } else {
      console.log(`Successfully updated ${records.length} idCard values in MP`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error updating idCard values in MP:', errorMessage);
  }
}

export type { MPInstance, ErrorDetails };
