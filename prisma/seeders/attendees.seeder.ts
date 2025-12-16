import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedAttendeesAndRegistrations() {
  console.log('ℹ️  Seeding attendees and registrations...');

  // Récupérer l'organisation Acme Corp
  const acmeOrg = await prisma.organization.findFirst({
    where: { slug: 'acme-corp' },
  });

  if (!acmeOrg) {
    console.log(' Organization Acme Corp not found, skipping attendees/registrations seeding');
    return;
  }

  // Récupérer les événements publiés
  const events = await prisma.event.findMany({
    where: {
      org_id: acmeOrg.id,
      status: 'published',
    },
    include: {
      settings: true,
      eventAttendeeTypes: true, // Inclure les types de participants de l'événement
    },
  });

  if (events.length === 0) {
    console.log(' No published events found, skipping attendees/registrations seeding');
    return;
  }

  // Créer des attendees de test
  const attendeesData = [
    {
      email: 'marie.dupont@example.com',
      first_name: 'Marie',
      last_name: 'Dupont',
      phone: '+33612345678',
      company: 'TechCorp',
      job_title: 'Développeuse Senior',
      country: 'France',
    },
    {
      email: 'pierre.martin@example.com',
      first_name: 'Pierre',
      last_name: 'Martin',
      phone: '+33623456789',
      company: 'InnoLab',
      job_title: 'CTO',
      country: 'France',
    },
    {
      email: 'sophie.bernard@example.com',
      first_name: 'Sophie',
      last_name: 'Bernard',
      phone: '+33634567890',
      company: 'DataCo',
      job_title: 'Data Scientist',
      country: 'France',
    },
    {
      email: 'lucas.petit@example.com',
      first_name: 'Lucas',
      last_name: 'Petit',
      phone: '+33645678901',
      company: 'CloudSys',
      job_title: 'DevOps Engineer',
      country: 'France',
    },
    {
      email: 'emma.rousseau@example.com',
      first_name: 'Emma',
      last_name: 'Rousseau',
      phone: '+33656789012',
      company: 'AI Solutions',
      job_title: 'ML Engineer',
      country: 'France',
    },
    {
      email: 'thomas.moreau@example.com',
      first_name: 'Thomas',
      last_name: 'Moreau',
      phone: '+33667890123',
      company: 'WebTech',
      job_title: 'Full Stack Developer',
      country: 'France',
    },
    {
      email: 'julie.simon@example.com',
      first_name: 'Julie',
      last_name: 'Simon',
      phone: '+33678901234',
      company: 'StartupLab',
      job_title: 'Product Manager',
      country: 'France',
    },
    {
      email: 'antoine.laurent@example.com',
      first_name: 'Antoine',
      last_name: 'Laurent',
      phone: '+33689012345',
      company: 'SecureNet',
      job_title: 'Security Analyst',
      country: 'France',
    },
    {
      email: 'camille.lefebvre@example.com',
      first_name: 'Camille',
      last_name: 'Lefebvre',
      phone: '+33690123456',
      company: 'MobileDev',
      job_title: 'Mobile Developer',
      country: 'France',
    },
    {
      email: 'maxime.garcia@example.com',
      first_name: 'Maxime',
      last_name: 'Garcia',
      phone: '+33601234567',
      company: 'GameStudio',
      job_title: 'Game Developer',
      country: 'France',
    },
  ];

  const createdAttendees = [];
  for (const attendeeData of attendeesData) {
    // Vérifier si l'attendee existe déjà
    const existing = await prisma.attendee.findFirst({
      where: {
        org_id: acmeOrg.id,
        email: attendeeData.email,
      },
    });

    if (existing) {
      console.log(`✅ Attendee already exists: ${attendeeData.email}`);
      createdAttendees.push(existing);
      continue;
    }

    const attendee = await prisma.attendee.create({
      data: {
        org_id: acmeOrg.id,
        ...attendeeData,
        labels: [],
        is_active: true,
      },
    });

    console.log(`✅ ✓ Attendee: ${attendee.first_name} ${attendee.last_name} (${attendee.email})`);
    createdAttendees.push(attendee);
  }

  // Créer des registrations pour chaque événement
  let totalRegistrations = 0;
  const registrationStatuses = ['awaiting', 'approved', 'refused', 'cancelled'] as const;

  for (const event of events) {
    // Nombre aléatoire d'inscriptions par événement (30-70% de la capacité ou 5-15 si pas de capacité)
    const targetCount = event.capacity
      ? Math.floor(event.capacity * (0.3 + Math.random() * 0.4))
      : Math.floor(5 + Math.random() * 10);

    const attendeesToRegister = createdAttendees
      .sort(() => Math.random() - 0.5) // Shuffle
      .slice(0, Math.min(targetCount, createdAttendees.length));

    for (const attendee of attendeesToRegister) {
      // Vérifier si l'inscription existe déjà
      const existing = await prisma.registration.findFirst({
        where: {
          org_id: acmeOrg.id,
          event_id: event.id,
          attendee_id: attendee.id,
        },
      });

      if (existing) {
        continue;
      }

      // Statut aléatoire (avec plus de approved que les autres)
      const statusWeights = [0.15, 0.75, 0.05, 0.05]; // awaiting: 15%, approved: 75%, refused: 5%, cancelled: 5%
      const random = Math.random();
      let status: typeof registrationStatuses[number];
      if (random < statusWeights[0]) status = 'awaiting';
      else if (random < statusWeights[0] + statusWeights[1]) status = 'approved';
      else if (random < statusWeights[0] + statusWeights[1] + statusWeights[2]) status = 'refused';
      else status = 'cancelled';

      // Générer des données snapshot avec des variations pour tester l'affichage
      // Le but est d'avoir des données légèrement différentes pour le même attendee selon l'événement
      const eventYear = event.start_at ? new Date(event.start_at).getFullYear() : new Date().getFullYear();
      
      // Variations simulées
      const snapshotCompany = Math.random() > 0.5 
        ? `${attendee.company} (${eventYear})` 
        : `${attendee.company}`;
        
      const snapshotJobTitle = Math.random() > 0.3
        ? `${attendee.job_title} - ${event.name.substring(0, 10)}...`
        : attendee.job_title;

      // Assigner un type de participant aléatoire si disponible
      let eventAttendeeTypeId = null;
      if (event.eventAttendeeTypes && event.eventAttendeeTypes.length > 0) {
        const randomType = event.eventAttendeeTypes[Math.floor(Math.random() * event.eventAttendeeTypes.length)];
        eventAttendeeTypeId = randomType.id;
      }

      await prisma.registration.create({
        data: {
          org_id: acmeOrg.id,
          event_id: event.id,
          attendee_id: attendee.id,
          event_attendee_type_id: eventAttendeeTypeId,
          status,
          attendance_mode: 'onsite' as const,
          // Remplissage des données snapshot
          snapshot_first_name: attendee.first_name,
          snapshot_last_name: attendee.last_name,
          snapshot_email: attendee.email,
          snapshot_phone: attendee.phone,
          snapshot_company: snapshotCompany,
          snapshot_job_title: snapshotJobTitle,
          answers: {
            firstName: attendee.first_name,
            lastName: attendee.last_name,
            email: attendee.email,
            company: snapshotCompany,
            jobTitle: snapshotJobTitle,
            expectations: 'Learning new things',
          },
          confirmed_at: status === 'approved' ? new Date() : null,
        },
      });

      totalRegistrations++;
    }

    console.log(`✅ Created ${attendeesToRegister.length} registrations for event: ${event.name}`);
  }

  console.log(`✅ Total attendees created/updated: ${createdAttendees.length}`);
  console.log(`✅ Total registrations created: ${totalRegistrations}`);

  return { attendees: createdAttendees, registrationsCount: totalRegistrations };
}

