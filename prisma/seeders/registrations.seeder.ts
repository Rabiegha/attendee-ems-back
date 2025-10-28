import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedRegistrationsForEvent() {
  console.log('ℹ️  Seeding registrations for specific event...');

  // ID de l'événement spécifique
  const eventId = '8639f5cc-a4b5-4790-89a5-ffcb96f82c81';

  // Vérifier que l'événement existe
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      organization: true,
      eventAttendeeTypes: {
        include: {
          attendeeType: true,
        },
      },
    },
  });

  if (!event) {
    console.log(`⚠️  Event with ID ${eventId} not found, skipping registrations seeding`);
    return;
  }

  console.log(`📌 Event found: ${event.name} (${event.code})`);

  if (event.eventAttendeeTypes.length === 0) {
    console.log('⚠️  No event attendee types found for this event. Please run event-attendee-types seeder first.');
    return;
  }

  // Récupérer ou créer des attendees pour cet événement
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
    {
      email: 'sarah.dubois@example.com',
      first_name: 'Sarah',
      last_name: 'Dubois',
      phone: '+33612345679',
      company: 'DesignStudio',
      job_title: 'UX Designer',
      country: 'France',
    },
    {
      email: 'nicolas.blanc@example.com',
      first_name: 'Nicolas',
      last_name: 'Blanc',
      phone: '+33623456780',
      company: 'MediaCorp',
      job_title: 'Journaliste',
      country: 'France',
    },
    {
      email: 'laura.roux@example.com',
      first_name: 'Laura',
      last_name: 'Roux',
      phone: '+33634567891',
      company: 'EventPro',
      job_title: 'Event Manager',
      country: 'France',
    },
    {
      email: 'david.mercier@example.com',
      first_name: 'David',
      last_name: 'Mercier',
      phone: '+33645678902',
      company: 'TechSponsor',
      job_title: 'Marketing Director',
      country: 'France',
    },
    {
      email: 'chloe.girard@example.com',
      first_name: 'Chloé',
      last_name: 'Girard',
      phone: '+33656789013',
      company: 'InnovCorp',
      job_title: 'Innovation Lead',
      country: 'France',
    },
    {
      email: 'alexandre.faure@example.com',
      first_name: 'Alexandre',
      last_name: 'Faure',
      phone: '+33667890124',
      company: 'StartupHub',
      job_title: 'CEO',
      country: 'France',
    },
    {
      email: 'melissa.andre@example.com',
      first_name: 'Mélissa',
      last_name: 'André',
      phone: '+33678901235',
      company: 'TechNews',
      job_title: 'Rédactrice en chef',
      country: 'France',
    },
    {
      email: 'julien.lambert@example.com',
      first_name: 'Julien',
      last_name: 'Lambert',
      phone: '+33689012346',
      company: 'SecureIT',
      job_title: 'CISO',
      country: 'France',
    },
    {
      email: 'clara.fontaine@example.com',
      first_name: 'Clara',
      last_name: 'Fontaine',
      phone: '+33690123457',
      company: 'AILab',
      job_title: 'Research Scientist',
      country: 'France',
    },
    {
      email: 'mathieu.chevalier@example.com',
      first_name: 'Mathieu',
      last_name: 'Chevalier',
      phone: '+33601234568',
      company: 'CloudTech',
      job_title: 'Solutions Architect',
      country: 'France',
    },
  ];

  // Créer ou récupérer les attendees
  const attendees = [];
  for (const attendeeData of attendeesData) {
    let attendee = await prisma.attendee.findFirst({
      where: {
        org_id: event.org_id,
        email: attendeeData.email,
      },
    });

    if (!attendee) {
      attendee = await prisma.attendee.create({
        data: {
          org_id: event.org_id,
          ...attendeeData,
          labels: [],
          is_active: true,
        },
      });
      console.log(`✅ ✓ Created Attendee: ${attendee.first_name} ${attendee.last_name}`);
    }

    attendees.push(attendee);
  }

  // Créer des registrations avec différents types
  const registrationStatuses = ['awaiting', 'approved', 'refused', 'cancelled'] as const;
  const attendanceModes = ['onsite', 'online', 'hybrid'] as const;
  
  let totalRegistrations = 0;
  const eventAttendeeTypesArray = event.eventAttendeeTypes;

  // Distribuer les attendees entre les différents types
  for (let i = 0; i < attendees.length; i++) {
    const attendee = attendees[i];
    
    // Vérifier si l'inscription existe déjà
    const existing = await prisma.registration.findFirst({
      where: {
        org_id: event.org_id,
        event_id: event.id,
        attendee_id: attendee.id,
      },
    });

    if (existing) {
      console.log(`⏭️  Registration already exists for: ${attendee.email}`);
      continue;
    }

    // Assigner un type de participant de manière cyclique
    const eventAttendeeType = eventAttendeeTypesArray[i % eventAttendeeTypesArray.length];

    // Statut aléatoire (avec plus de approved que les autres)
    const statusWeights = [0.10, 0.80, 0.05, 0.05]; // awaiting: 10%, approved: 80%, refused: 5%, cancelled: 5%
    const random = Math.random();
    let status: typeof registrationStatuses[number];
    if (random < statusWeights[0]) status = 'awaiting';
    else if (random < statusWeights[0] + statusWeights[1]) status = 'approved';
    else if (random < statusWeights[0] + statusWeights[1] + statusWeights[2]) status = 'refused';
    else status = 'cancelled';

    // Mode de participation aléatoire
    const attendanceMode = attendanceModes[Math.floor(Math.random() * attendanceModes.length)];

    const registration = await prisma.registration.create({
      data: {
        org_id: event.org_id,
        event_id: event.id,
        attendee_id: attendee.id,
        status,
        attendance_type: attendanceMode,
        event_attendee_type_id: eventAttendeeType.id,
        answers: {
          firstName: attendee.first_name,
          lastName: attendee.last_name,
          email: attendee.email,
          company: attendee.company,
          jobTitle: attendee.job_title,
        },
        confirmed_at: status === 'approved' ? new Date() : null,
      },
    });

    console.log(
      `✅ ✓ Registration: ${attendee.first_name} ${attendee.last_name} - Type: ${eventAttendeeType.attendeeType.name} - Status: ${status}`
    );
    totalRegistrations++;
  }

  console.log(`✅ Total registrations created for event ${event.name}: ${totalRegistrations}`);
  return { event, registrationsCount: totalRegistrations };
}
