import path from 'path';
import { fileURLToPath } from 'url';

// Directory setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.join(__dirname, '..');
export const DIST_DIR = path.join(ROOT_DIR, 'dist');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

export const PORT = parseInt(process.env.PORT || '3001', 10);

// Type definitions
export interface CollectionItem {
  [key: string]: any;
}

export type CollectionName = 'lists' | 'winners' | 'prizes' | 'history' | 'settings' | 'backups' | 'templates' | 'archive';

interface KeyFields {
  lists: 'listId';
  winners: 'winnerId';
  prizes: 'prizeId';
  history: 'historyId';
  settings: 'key';
  backups: 'backupId';
  archive: 'listId';
  [key: string]: string;
}

// Allowed collections whitelist
const ALLOWED_COLLECTIONS = new Set<string>([
  'lists', 'winners', 'prizes', 'history', 'settings', 'backups', 'templates', 'archive'
]);

export function isValidCollection(collection: string): boolean {
  return ALLOWED_COLLECTIONS.has(collection);
}

export function getKeyField(collection: string): string {
  const keyFields: KeyFields = {
    lists: 'listId',
    winners: 'winnerId',
    prizes: 'prizeId',
    history: 'historyId',
    settings: 'key',
    backups: 'backupId',
    templates: 'templateId',
    archive: 'listId'
  };
  return keyFields[collection] || 'id';
}
