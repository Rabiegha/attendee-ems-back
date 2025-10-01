#!/usr/bin/env ts-node

/**
 * Script utilitaire pour exécuter des seeders spécifiques
 * 
 * Usage:
 * ts-node scripts/seed-specific.ts organizations
 * ts-node scripts/seed-specific.ts users acme-corp
 * ts-node scripts/seed-specific.ts minimal
 */

import { 
  seedOnlyOrganizations, 
  seedForSpecificOrganization, 
  seedTestUsers, 
  seedMinimal 
} from '../prisma/seeders/examples';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const param = args[1];

  if (!command) {
    console.log('❌ Please specify a seeder command');
    console.log('');
    console.log('Available commands:');
    console.log('  organizations          - Seed only organizations');
    console.log('  users [org-slug]       - Seed users for specific org (default: acme-corp)');
    console.log('  org [org-slug]         - Seed all data for specific org');
    console.log('  minimal                - Minimal seed (org + admin only)');
    process.exit(1);
  }

  try {
    switch (command) {
      case 'organizations':
      case 'orgs':
        await seedOnlyOrganizations();
        break;

      case 'users':
        await seedTestUsers(param || 'acme-corp');
        break;

      case 'org':
      case 'organization':
        if (!param) {
          console.log('❌ Please specify organization slug');
          process.exit(1);
        }
        await seedForSpecificOrganization(param);
        break;

      case 'minimal':
      case 'min':
        await seedMinimal();
        break;

      default:
        console.log(`❌ Unknown command: ${command}`);
        process.exit(1);
    }

    console.log('✅ Seeder completed successfully!');
  } catch (error) {
    console.error('❌ Seeder failed:', error);
    process.exit(1);
  }
}

main();
