/**
 * Script pour créer des EmailSettings par défaut pour tous les événements qui n'en ont pas
 * Usage: npx ts-node scripts/create-missing-email-settings.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Recherche des événements sans EmailSettings...');

  // Récupérer tous les événements
  const allEvents = await prisma.event.findMany({
    select: {
      id: true,
      org_id: true,
      name: true,
    },
  });

  console.log(`📊 Total d'événements: ${allEvents.length}`);

  // Récupérer tous les événements qui ont déjà des EmailSettings
  const eventsWithEmailSettings = await prisma.emailSetting.findMany({
    select: {
      event_id: true,
    },
  });

  const eventIdsWithSettings = new Set(eventsWithEmailSettings.map(es => es.event_id));

  // Filtrer les événements qui n'ont pas d'EmailSettings
  const eventsWithoutSettings = allEvents.filter(event => !eventIdsWithSettings.has(event.id));

  console.log(`📝 Événements sans EmailSettings: ${eventsWithoutSettings.length}`);

  if (eventsWithoutSettings.length === 0) {
    console.log('✅ Tous les événements ont déjà des EmailSettings');
    return;
  }

  console.log('🔨 Création des EmailSettings manquants...');

  let created = 0;
  let errors = 0;

  for (const event of eventsWithoutSettings) {
    try {
      await prisma.emailSetting.create({
        data: {
          org_id: event.org_id,
          event_id: event.id,
          require_email_verification: false,
          confirmation_enabled: false,
          approval_enabled: false,
          reminder_enabled: false,
        },
      });
      created++;
      console.log(`  ✓ EmailSettings créé pour: ${event.name} (${event.id})`);
    } catch (error) {
      errors++;
      console.error(`  ✗ Erreur pour ${event.name} (${event.id}):`, error.message);
    }
  }

  console.log('\n📊 Résumé:');
  console.log(`  - EmailSettings créés: ${created}`);
  console.log(`  - Erreurs: ${errors}`);
  console.log('✅ Migration terminée!');
}

main()
  .catch((error) => {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
