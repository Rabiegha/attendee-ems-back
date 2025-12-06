const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@attendee.fr';
  const password = 'admin123';
  const orgName = 'Choyou';
  const orgSlug = 'choyou';

  console.log(`Creating organization: ${orgName}...`);
  
  // 1. Create or update Organization
  const org = await prisma.organization.upsert({
    where: { slug: orgSlug },
    update: {},
    create: {
      name: orgName,
      slug: orgSlug,
    },
  });

  console.log(`Organization created with ID: ${org.id}`);

  // 2. Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // 3. Ensure ADMIN role exists for this org
  let adminRole = await prisma.role.findFirst({
    where: { 
      code: 'ADMIN',
      org_id: org.id 
    }
  });

  if (!adminRole) {
      console.log('Creating ADMIN role for organization...');
      adminRole = await prisma.role.create({
          data: {
              code: 'ADMIN',
              name: 'Administrator',
              description: 'Full management of organization',
              level: 1,
              is_system_role: false,
              org_id: org.id
          }
      });
  }

  // 4. Create User
  console.log(`Creating user: ${email}...`);
  
  const existingUser = await prisma.user.findUnique({
    where: { 
        email_org_id: {
            email: email,
            org_id: org.id
        }
    },
  });

  if (existingUser) {
    console.log('User already exists. Updating password...');
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        password_hash: hashedPassword,
        is_active: true,
      },
    });
  } else {
    await prisma.user.create({
      data: {
        email,
        password_hash: hashedPassword,
        first_name: 'Admin',
        last_name: 'Choyou',
        org_id: org.id,
        role_id: adminRole.id,
        is_active: true,
      },
    });
  }

  console.log('✅ Admin user created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
