import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedAttendeePermissions() {
  console.log('🌱 Seeding attendee permissions...');

  const permissions = [
    {
      code: 'attendee.create',
      name: 'Create Attendees',
      description: 'Can create or upsert attendees',
    },
    {
      code: 'attendee.read',
      name: 'Read Attendees',
      description: 'Can view attendee information',
    },
    {
      code: 'attendee.update',
      name: 'Update Attendees',
      description: 'Can update attendee information',
    },
    {
      code: 'attendee.delete',
      name: 'Delete Attendees',
      description: 'Can delete attendees (soft or hard)',
    },
  ];

  for (const permission of permissions) {
    const existing = await prisma.permission.findUnique({
      where: { code: permission.code },
    });

    if (!existing) {
      await prisma.permission.create({
        data: permission,
      });
      console.log(`✅ Created permission: ${permission.code}`);
    } else {
      console.log(`⏭️  Permission already exists: ${permission.code}`);
    }
  }

  console.log('✅ Attendee permissions seeded successfully');
}

// Run if called directly
if (require.main === module) {
  seedAttendeePermissions()
    .catch((e) => {
      console.error('❌ Error seeding attendee permissions:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
