const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Rôles à créer pour chaque organisation (sauf SUPER_ADMIN qui est global)
const roleTemplates = [
  {
    code: 'ADMIN',
    name: 'Administrator',
    description: 'Full management of organization',
    level: 1,
  },
  {
    code: 'MANAGER',
    name: 'Manager',
    description: 'Event and attendee management',
    level: 2,
  },
  {
    code: 'PARTNER',
    name: 'Partner',
    description: 'Access to assigned events only',
    level: 3,
  },
  {
    code: 'VIEWER',
    name: 'Viewer',
    description: 'Read-only access',
    level: 4,
  },
  {
    code: 'HOSTESS',
    name: 'Hostess',
    description: 'Check-in for assigned events',
    level: 5,
  },
];

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

  console.log(`✓ Organization created with ID: ${org.id}`);

  // 2. Create all roles for this organization
  console.log('\nCreating roles for organization...');
  const roles = {};
  
  for (const roleTemplate of roleTemplates) {
    const role = await prisma.role.upsert({
      where: {
        org_id_code: {
          org_id: org.id,
          code: roleTemplate.code,
        }
      },
      update: {
        name: roleTemplate.name,
        description: roleTemplate.description,
        level: roleTemplate.level,
      },
      create: {
        code: roleTemplate.code,
        name: roleTemplate.name,
        description: roleTemplate.description,
        level: roleTemplate.level,
        is_system_role: false,
        org_id: org.id,
      },
    });
    
    roles[roleTemplate.code] = role;
    console.log(`  ✓ Role created: ${role.name} (${role.code})`);
  }

  // 3. Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // 4. Create Admin User
  console.log(`\nCreating admin user: ${email}...`);
  
  const existingUser = await prisma.user.findUnique({
    where: { 
      email_org_id: {
        email: email,
        org_id: org.id
      }
    },
  });

  if (existingUser) {
    console.log('User already exists. Updating password and role...');
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        password_hash: hashedPassword,
        role_id: roles.ADMIN.id,
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
        role_id: roles.ADMIN.id,
        is_active: true,
      },
    });
  }

  console.log('\n✅ Setup completed successfully!');
  console.log('\n📋 Summary:');
  console.log(`   Organization: ${orgName}`);
  console.log(`   Roles created: ${Object.keys(roles).length}`);
  console.log(`   Admin email: ${email}`);
  console.log(`   Admin password: ${password}`);
  console.log('\n⚠️  Remember to change the admin password after first login!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
