import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedEventAttendeeTypes() {
  console.log('ℹ️  Seeding event attendee types...');

  // Trouver l'événement "Workshop Live Coding AUJOURD'HUI" par son code
  const event = await prisma.event.findFirst({
    where: { code: 'TODAY-2025-11-02' },
    include: { organization: true },
  });

  if (!event) {
    console.log('❌ Event "TODAY-2025-11-02" not found, skipping event attendee types seeding');
    return;
  }

  console.log(`📌 Event found: ${event.name} (${event.code})`);

  // Récupérer tous les types de participants de l'organisation
  const attendeeTypes = await prisma.attendeeType.findMany({
    where: {
      org_id: event.org_id,
      is_active: true,
    },
    orderBy: {
      sort_order: 'asc',
    },
  });

  if (attendeeTypes.length === 0) {
    console.log(' No attendee types found for this organization, skipping event attendee types seeding');
    return;
  }

  const createdEventAttendeeTypes = [];
  let sortOrder = 1;

  for (const attendeeType of attendeeTypes) {
    // Vérifier si l'association existe déjà
    const existing = await prisma.eventAttendeeType.findFirst({
      where: {
        event_id: event.id,
        attendee_type_id: attendeeType.id,
      },
    });

    if (existing) {
      console.log(`✅ Event attendee type already exists: ${attendeeType.name}`);
      createdEventAttendeeTypes.push(existing);
      sortOrder++;
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
        sort_order: sortOrder,
      },
    });

    console.log(`✅ ✓ Event Attendee Type: ${attendeeType.name} (capacity: ${capacity || 'unlimited'})`);
    createdEventAttendeeTypes.push(eventAttendeeType);
    sortOrder++;
  }

  console.log(`✅ Total event attendee types created/updated: ${createdEventAttendeeTypes.length}`);
  return createdEventAttendeeTypes;
}
