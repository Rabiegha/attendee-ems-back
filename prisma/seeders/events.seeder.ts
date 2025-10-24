import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedEvents() {
  console.log('ℹ️  Seeding events...');

  // Récupérer l'organisation Acme Corp
  const acmeOrg = await prisma.organization.findFirst({
    where: { slug: 'acme-corp' },
  });

  if (!acmeOrg) {
    console.log('⚠️  Organization Acme Corp not found, skipping events seeding');
    return;
  }

  // Créer quelques événements de test
  const events = [
    {
      org_id: acmeOrg.id,
      code: 'TECH-SUMMIT-2025',
      name: 'Tech Summit 2025',
      description: 'Conférence annuelle sur les technologies émergentes et l\'innovation.',
      start_at: new Date('2025-11-15T09:00:00Z'),
      end_at: new Date('2025-11-15T18:00:00Z'),
      timezone: 'Europe/Paris',
      status: 'published' as const,
      capacity: 500,
      location_type: 'hybrid' as const,
      address_formatted: 'Palais des Congrès, 2 Place de la Porte Maillot, 75017 Paris, France',
      address_street: '2 Place de la Porte Maillot',
      address_city: 'Paris',
      address_region: 'Île-de-France',
      address_postal_code: '75017',
      address_country: 'France',
      latitude: 48.8784,
      longitude: 2.2834,
    },
    {
      org_id: acmeOrg.id,
      code: 'WORKSHOP-AI-101',
      name: 'Workshop IA pour débutants',
      description: 'Formation intensive sur l\'intelligence artificielle et le machine learning.',
      start_at: new Date('2025-12-01T14:00:00Z'),
      end_at: new Date('2025-12-01T17:00:00Z'),
      timezone: 'Europe/Paris',
      status: 'published' as const,
      capacity: 50,
      location_type: 'physical' as const,
      address_formatted: 'Station F, 5 Parvis Alan Turing, 75013 Paris, France',
      address_street: '5 Parvis Alan Turing',
      address_city: 'Paris',
      address_region: 'Île-de-France',
      address_postal_code: '75013',
      address_country: 'France',
      latitude: 48.8323,
      longitude: 2.3730,
    },
    {
      org_id: acmeOrg.id,
      code: 'WEBINAR-CLOUD-2025',
      name: 'Webinar Cloud Architecture',
      description: 'Webinar en ligne sur les meilleures pratiques d\'architecture cloud.',
      start_at: new Date('2025-10-30T16:00:00Z'),
      end_at: new Date('2025-10-30T17:30:00Z'),
      timezone: 'Europe/Paris',
      status: 'published' as const,
      capacity: 1000,
      location_type: 'online' as const,
    },
    {
      org_id: acmeOrg.id,
      code: 'DRAFT-EVENT-2026',
      name: 'Future Conference 2026',
      description: 'Événement en cours de préparation pour 2026.',
      start_at: new Date('2026-03-20T10:00:00Z'),
      end_at: new Date('2026-03-20T18:00:00Z'),
      timezone: 'Europe/Paris',
      status: 'draft' as const,
      capacity: 300,
      location_type: 'physical' as const,
    },
  ];

  const createdEvents = [];
  for (const eventData of events) {
    const existingEvent = await prisma.event.findFirst({
      where: {
        org_id: eventData.org_id,
        code: eventData.code,
      },
    });

    if (existingEvent) {
      console.log(`✅ Event already exists: ${eventData.name}`);
      createdEvents.push(existingEvent);
      continue;
    }

    const event = await prisma.event.create({
      data: {
        ...eventData,
        // Créer automatiquement EventSetting avec public_token
        settings: {
          create: {
            public_token: `${eventData.code.toLowerCase()}-${Math.random().toString(36).substring(2, 10)}`,
            registration_auto_approve: true,
            allow_checkin_out: true,
            has_event_reminder: false,
            auto_transition_to_active: true,
            auto_transition_to_completed: true,
            registration_fields: [
              { id: 'firstName', name: 'firstName', label: 'Prénom', type: 'text', required: true },
              { id: 'lastName', name: 'lastName', label: 'Nom', type: 'text', required: true },
              { id: 'email', name: 'email', label: 'Email', type: 'email', required: true },
              { id: 'company', name: 'company', label: 'Entreprise', type: 'text', required: false },
              { id: 'jobTitle', name: 'jobTitle', label: 'Fonction', type: 'text', required: false },
            ],
          },
        },
      },
      include: {
        settings: true,
      },
    });

    console.log(`✅ ✓ Event: ${event.name} (${event.code})`);
    createdEvents.push(event);
  }

  console.log(`✅ Total events created/updated: ${createdEvents.length}`);
  return createdEvents;
}

