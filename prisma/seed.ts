// Prisma automatic seed - detects environment and uses appropriate seed strategy
// - PRODUCTION: Minimal seed via SQL (seed-production.sql)
// - DEVELOPMENT: Full seed via TypeScript seeders

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

async function runSeed() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  console.log(`🌱 Prisma seed triggered - Environment: ${nodeEnv}`);
  
  // In production, don't auto-seed - let deploy.sh handle it with seed-production.sql
  if (nodeEnv === 'production') {
    console.log('⚠️  Production environment detected - Skipping automatic Prisma seed');
    console.log('💡 Use deploy.sh or manual SQL execution to seed production database');
    return;
  }
  
  // In development, run the full TypeScript seeders
  console.log('🚀 Running development seeders...');
  const runAllSeeders = (await import('./seeders/index')).default;
  await runAllSeeders();
}

// Execute the seeder when this file is run
runSeed()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
