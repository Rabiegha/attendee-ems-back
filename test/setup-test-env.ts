/**
 * Setup test environment
 * Charge les variables d'environnement depuis .env.test
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Charger .env.test
const envPath = resolve(__dirname, '../.env.test');
console.log(`Loading test environment from: ${envPath}`);
config({ path: envPath });

// Vérifier que DATABASE_URL est bien défini
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined in .env.test');
}

console.log(`Test DATABASE_URL: ${process.env.DATABASE_URL}`);
