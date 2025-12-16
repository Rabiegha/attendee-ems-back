import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedAttendeeTypes() {
  console.log('ℹ️  Seeding attendee types...');

  // Récupérer l'organisation Acme Corp
  const acmeOrg = await prisma.organization.findFirst({
    where: { slug: 'acme-corp' },
  });

  if (!acmeOrg) {
    console.log(' Organization Acme Corp not found, skipping attendee types seeding');
    return;
  }

  // Créer des types de participants
  const attendeeTypesData = [
    {
      org_id: acmeOrg.id,
      code: 'VIP',
      name: 'VIP',
      color_hex: '#FFD700',
      text_color_hex: '#000000',
      icon: 'star',
      is_active: true,
    },
    {
      org_id: acmeOrg.id,
      code: 'SPEAKER',
      name: 'Conférencier',
      color_hex: '#9C27B0',
      text_color_hex: '#FFFFFF',
      icon: 'microphone',
      is_active: true,
    },
    {
      org_id: acmeOrg.id,
      code: 'SPONSOR',
      name: 'Sponsor',
      color_hex: '#FF9800',
      text_color_hex: '#FFFFFF',
      icon: 'briefcase',
      is_active: true,
    },
    {
      org_id: acmeOrg.id,
      code: 'PRESS',
      name: 'Presse',
      color_hex: '#2196F3',
      text_color_hex: '#FFFFFF',
      icon: 'camera',
      is_active: true,
    },
    {
      org_id: acmeOrg.id,
      code: 'PARTICIPANT',
      name: 'Participant',
      color_hex: '#4CAF50',
      text_color_hex: '#FFFFFF',
      icon: 'user',
      is_active: true,
    },
    {
      org_id: acmeOrg.id,
      code: 'STAFF',
      name: 'Staff',
      color_hex: '#607D8B',
      text_color_hex: '#FFFFFF',
      icon: 'users',
      is_active: true,
    },
  ];

  const createdAttendeeTypes = [];
  for (const typeData of attendeeTypesData) {
    const existing = await prisma.attendeeType.findFirst({
      where: {
        org_id: typeData.org_id,
        code: typeData.code,
      },
    });

    if (existing) {
      console.log(`✅ Attendee type already exists: ${typeData.name}`);
      createdAttendeeTypes.push(existing);
      continue;
    }

    const attendeeType = await prisma.attendeeType.create({
      data: typeData,
    });

    console.log(`✅ ✓ Attendee Type: ${attendeeType.name} (${attendeeType.code})`);
    createdAttendeeTypes.push(attendeeType);
  }

  console.log(`✅ Total attendee types created/updated: ${createdAttendeeTypes.length}`);
  return createdAttendeeTypes;
}
