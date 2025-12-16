import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedEventAttendeeTypes() {
  console.log('ℹ️  Seeding event attendee types...');

  // Trouver l'organisation Acme Corp
  const acmeOrg = await prisma.organization.findFirst({
    where: { slug: 'acme-corp' },
  });

  if (!acmeOrg) {
    console.log(' Organization Acme Corp not found, skipping event attendee types seeding');
    return;
  }

  // Trouver tous les événements de l'organisation
  const events = await prisma.event.findMany({
    where: { org_id: acmeOrg.id },
    include: { organization: true },
  });

  if (events.length === 0) {
    console.log(' No events found for Acme Corp, skipping event attendee types seeding');
    return;
  }

  console.log(`📌 Found ${events.length} events for Acme Corp`);

  // Récupérer tous les types de participants de l'organisation
  const attendeeTypes = await prisma.attendeeType.findMany({
    where: {
      org_id: acmeOrg.id,
      is_active: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  if (attendeeTypes.length === 0) {
    console.log(' No attendee types found for this organization, skipping event attendee types seeding');
    return;
  }

  const createdEventAttendeeTypes = [];

  for (const event of events) {
    console.log(`Processing event: ${event.name} (${event.code})`);
    
    // Sélectionner aléatoirement quelques types pour cet événement (entre 2 et tous)
    const shuffledTypes = [...attendeeTypes].sort(() => 0.5 - Math.random());
    const selectedTypes = shuffledTypes.slice(0, Math.max(2, Math.floor(Math.random() * attendeeTypes.length) + 1));

    for (const attendeeType of selectedTypes) {
      // Vérifier si l'association existe déjà
      const existing = await prisma.eventAttendeeType.findFirst({
        where: {
          event_id: event.id,
          attendee_type_id: attendeeType.id,
        },
      });

      if (existing) {
        // console.log(`✅ Event attendee type already exists: ${attendeeType.name}`);
        createdEventAttendeeTypes.push(existing);
        continue;
      }

      // Définir une capacité selon le type
      let capacity: number | null = null;
      switch (attendeeType.code) {
        case 'VIP':
          capacity = 50;
          break;
        case 'SPEAKER':
          capacity = 20;
          break;
        case 'SPONSOR':
          capacity = 30;
          break;
        case 'PRESS':
          capacity = 25;
          break;
        case 'STAFF':
          capacity = 40;
          break;
        case 'PARTICIPANT':
          capacity = 500;
          break;
        default:
          capacity = null;
      }

      const eventAttendeeType = await prisma.eventAttendeeType.create({
        data: {
          event_id: event.id,
          org_id: event.org_id,
          attendee_type_id: attendeeType.id,
          capacity,
        },
      });

      // console.log(`✅ ✓ Event Attendee Type: ${attendeeType.name} (capacity: ${capacity || 'unlimited'})`);
      createdEventAttendeeTypes.push(eventAttendeeType);
    }
  }

  console.log(`✅ Total event attendee types created/updated: ${createdEventAttendeeTypes.length}`);
  return createdEventAttendeeTypes;
}
