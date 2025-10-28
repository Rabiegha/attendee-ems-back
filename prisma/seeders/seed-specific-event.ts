import { disconnectPrisma, logSuccess, logError, logInfo } from './utils';
import { seedAttendeeTypes } from './attendee-types.seeder';
import { seedEventAttendeeTypes } from './event-attendee-types.seeder';
import { seedRegistrationsForEvent } from './registrations.seeder';

/**
 * Script pour remplir les données pour l'événement spécifique
 * Event ID: 8639f5cc-a4b5-4790-89a5-ffcb96f82c81
 */
async function seedSpecificEvent() {
  console.log('🌱 Starting seed for specific event (8639f5cc-a4b5-4790-89a5-ffcb96f82c81)...');
  
  try {
    // 1. Seed Attendee Types (si pas déjà créés)
    logInfo('Seeding attendee types...');
    const attendeeTypes = await seedAttendeeTypes();
    
    // 2. Seed Event Attendee Types
    logInfo('Seeding event attendee types...');
    const eventAttendeeTypes = await seedEventAttendeeTypes();
    
    // 3. Seed Registrations
    logInfo('Seeding registrations...');
    const result = await seedRegistrationsForEvent();
    
    // Summary
    console.log('');
    logSuccess('🎉 Specific event seed completed successfully!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`- Attendee Types: ${attendeeTypes?.length || 0} created/updated`);
    console.log(`- Event Attendee Types: ${eventAttendeeTypes?.length || 0} created/updated`);
    console.log(`- Registrations: ${result?.registrationsCount || 0} created`);
    console.log('');
    
    if (result?.event) {
      console.log(`✅ Event: ${result.event.name} (${result.event.code})`);
      console.log(`📅 Date: ${result.event.start_at.toLocaleDateString('fr-FR')}`);
    }
    
  } catch (error) {
    logError('Seed process failed', error);
    throw error;
  }
}

// Run the seeder when this file is executed directly
if (require.main === module) {
  seedSpecificEvent()
    .catch((e) => {
      logError('❌ Seed failed with unhandled error', e);
      process.exit(1);
    })
    .finally(async () => {
      await disconnectPrisma();
    });
}

export default seedSpecificEvent;
export { seedSpecificEvent };
