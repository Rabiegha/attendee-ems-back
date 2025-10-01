import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create demo organization
  const orgId = uuidv4();
  const organization = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      id: orgId,
      name: 'Acme Corp',
      slug: 'acme-corp',
      timezone: 'UTC',
    },
  });

  console.log('✅ Created organization:', organization.name);

  // Create roles
  let adminRole = await prisma.role.findFirst({
    where: { 
      org_id: organization.id,
      code: 'org_admin'
    }
  });
  
  if (!adminRole) {
    adminRole = await prisma.role.create({
      data: {
        org_id: organization.id,
        code: 'org_admin',
        name: 'Organization Administrator',
      },
    });
  }

  let userRole = await prisma.role.findFirst({
    where: { 
      org_id: organization.id,
      code: 'user'
    }
  });
  
  if (!userRole) {
    userRole = await prisma.role.create({
      data: {
        org_id: organization.id,
        code: 'user',
        name: 'Standard User',
      },
    });
  }

  console.log('✅ Created roles');

  // Create permissions
  const permissions = [
    { code: 'users.create', name: 'Create Users' },
    { code: 'users.read', name: 'Read Users' },
    { code: 'users.update', name: 'Update Users' },
    { code: 'users.delete', name: 'Delete Users' },
    { code: 'organizations.read', name: 'Read Organizations' },
    { code: 'organizations.update', name: 'Update Organizations' },
    { code: 'roles.read', name: 'Read Roles' },
    { code: 'permissions.read', name: 'Read Permissions' },
  ];

  const createdPermissions = [];
  for (const perm of permissions) {
    let permission = await prisma.permission.findFirst({
      where: { 
        org_id: organization.id,
        code: perm.code
      }
    });
    
    if (!permission) {
      permission = await prisma.permission.create({
        data: {
          org_id: organization.id,
          code: perm.code,
          name: perm.name,
        },
      });
    }
    createdPermissions.push(permission);
  }

  console.log('✅ Created permissions');

  // Assign all permissions to admin role
  for (const permission of createdPermissions) {
    const existing = await prisma.rolePermission.findFirst({
      where: {
        org_id: organization.id,
        role_id: adminRole.id,
        permission_id: permission.id,
      }
    });
    
    if (!existing) {
      await prisma.rolePermission.create({
        data: {
          org_id: organization.id,
          role_id: adminRole.id,
          permission_id: permission.id,
        },
      });
    }
  }

  // Assign basic permissions to user role
  const userPermissions = createdPermissions.filter(p => 
    p.code.includes('.read') || p.code === 'users.update'
  );
  
  for (const permission of userPermissions) {
    const existing = await prisma.rolePermission.findFirst({
      where: {
        org_id: organization.id,
        role_id: userRole.id,
        permission_id: permission.id,
      }
    });
    
    if (!existing) {
      await prisma.rolePermission.create({
        data: {
          org_id: organization.id,
          role_id: userRole.id,
          permission_id: permission.id,
        },
      });
    }
  }

  console.log('✅ Assigned permissions to roles');

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  let adminUser = await prisma.user.findFirst({
    where: {
      org_id: organization.id,
      email: 'admin@acme-corp.com'
    }
  });
  
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        org_id: organization.id,
        email: 'admin@acme-corp.com',
        password_hash: hashedPassword,
        role_id: adminRole.id,
        is_active: true,
      },
    });
  }

  console.log('✅ Created admin user:', adminUser.email);
  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('Demo credentials:');
  console.log('Email: admin@acme-corp.com');
  console.log('Password: admin123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
