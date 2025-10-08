// This file now delegates to the modular seeder system
// All seeding logic has been moved to prisma/seeders/ for better organization

import runAllSeeders from './seeders/index';

// Execute the seeder when this file is run
runAllSeeders()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
