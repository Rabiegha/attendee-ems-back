import { customAlphabet } from 'nanoid';

/**
 * Generate a unique public token for events
 * Uses URL-safe characters (alphanumeric, no special chars)
 * Length: 16 characters
 */
export function generatePublicToken(): string {
  // Use only alphanumeric characters (no special chars for URL safety)
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const nanoid = customAlphabet(alphabet, 16);
  return nanoid();
}
