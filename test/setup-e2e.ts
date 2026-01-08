import { config } from 'dotenv';
import { resolve } from 'path';

// Charge .env.test pour les tests E2E
config({ path: resolve(__dirname, '../.env.test') });
