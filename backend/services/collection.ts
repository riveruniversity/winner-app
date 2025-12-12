import { promises as fs } from 'fs';
import path from 'path';
import { DATA_DIR, UPLOADS_DIR, CollectionItem, CollectionName } from '../config.js';

export async function ensureDataDir(): Promise<void> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });

    const collections: CollectionName[] = ['lists', 'winners', 'prizes', 'history', 'settings', 'backups'];
    for (const collection of collections) {
      const filePath = path.join(DATA_DIR, `${collection}.json`);
      await fs.writeFile(filePath, '[]', 'utf8');
    }
    console.log('Data directory initialized');
  }

  // Ensure uploads directory exists
  try {
    await fs.access(UPLOADS_DIR);
  } catch {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    console.log('Uploads directory initialized');
  }
}

export async function readCollection(collection: string): Promise<CollectionItem[]> {
  try {
    const filePath = path.join(DATA_DIR, `${collection}.json`);
    const data = await fs.readFile(filePath, 'utf8');

    // Handle empty files
    if (!data || data.trim() === '') {
      console.log(`Collection ${collection} file is empty, returning empty array`);
      return [];
    }

    try {
      return JSON.parse(data);
    } catch (parseError) {
      console.error(`Invalid JSON in ${collection}.json, attempting recovery:`, parseError);

      // For settings collection, try to recover gracefully
      if (collection === 'settings') {
        console.log('Initializing empty settings collection due to corrupted file');
        return [];
      }

      // For other collections, throw error to prevent data loss
      throw new Error(`Corrupted JSON in ${collection}.json`);
    }
  } catch (error: any) {
    // If file doesn't exist, return empty array (this is ok for new collections)
    if (error.code === 'ENOENT') {
      console.log(`Collection ${collection} doesn't exist yet, will be created`);
      return [];
    }
    // For any other error (permissions, etc), throw it
    console.error(`Error reading ${collection}:`, error);
    throw new Error(`Failed to read collection ${collection}: ${error.message}`);
  }
}

export async function writeCollection(collection: string, data: CollectionItem[]): Promise<boolean> {
  try {
    const filePath = path.join(DATA_DIR, `${collection}.json`);

    // Ensure directory exists before writing
    await fs.mkdir(DATA_DIR, { recursive: true });

    // Write to a temporary file in the same directory (for atomic rename to work)
    const tempPath = path.join(DATA_DIR, `.${collection}.json.tmp`);

    try {
      // Write to temp file
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');

      // Atomic rename (works only if temp and target are on same filesystem)
      await fs.rename(tempPath, filePath);

      console.log(`Successfully wrote ${data.length} items to ${collection}.json`);
      return true;

    } catch (writeError: any) {
      // If anything fails, try to clean up temp file and use direct write
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }

      // Fall back to direct write (not atomic but better than failing)
      console.log(`Atomic write failed for ${collection}.json, using direct write. Error: ${writeError.message}`);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
      console.log(`Direct write succeeded for ${collection}.json`);
      return true;
    }

  } catch (error: any) {
    console.error(`Error writing ${collection}:`, error);
    if (error.code === 'EACCES') {
      console.error(`Permission denied writing to ${collection}.json. Check file/directory permissions.`);
    } else if (error.code === 'ENOENT') {
      console.error(`Failed to create directory or write file for ${collection}.json`);
    }
    return false;
  }
}
