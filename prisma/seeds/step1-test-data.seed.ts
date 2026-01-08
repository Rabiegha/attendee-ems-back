/**
 * STEP 1 - Test Data Seed
 * 
 * Crée des utilisateurs de test avec différents scénarios :
 * 1. User multi-tenant (membre de plusieurs orgs)
 * 2. User admin d'une org
 * 3. Support agent (accès limité)
 * 4. Root administrator
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🌱 Starting STEP 1 - Test Data Seed...\n');

  // Charger les organisations
  const orgs = await prisma.organization.findMany({
    take: 2,
    select: { id: true, name: true },
  });

  if (orgs.length < 2) {
    console.error('❌ Au moins 2 organisations sont nécessaires. Exécutez le seed principal d\'abord.');
    process.exit(1);
  }

  const org1 = orgs[0];
  const org2 = orgs[1];

  console.log(`📦 Organisation 1: ${org1.name} (${org1.id})`);
  console.log(`📦 Organisation 2: ${org2.name} (${org2.id})\n`);

  // Charger les rôles
  const roleAdminOrg1 = await prisma.role.findFirst({
    where: { org_id: org1.id, code: 'ADMIN' },
  });
  const roleManagerOrg1 = await prisma.role.findFirst({
    where: { org_id: org1.id, code: 'MANAGER' },
  });
  const roleAdminOrg2 = await prisma.role.findFirst({
    where: { org_id: org2.id, code: 'ADMIN' },
  });
  const roleStaffOrg2 = await prisma.role.findFirst({
    where: { org_id: org2.id, code: 'STAFF' },
  });
  const roleSupport = await prisma.role.findFirst({
    where: { org_id: null, code: 'SUPPORT' },
  });
  const roleRoot = await prisma.role.findFirst({
    where: { org_id: null, code: 'ROOT' },
  });

  if (!roleAdminOrg1 || !roleManagerOrg1 || !roleAdminOrg2 || !roleStaffOrg2 || !roleSupport || !roleRoot) {
    console.error('❌ Rôles manquants. Exécutez db:seed:step1 d\'abord.');
    process.exit(1);
  }

  const password = await bcrypt.hash('password123', 10);

  // ================================================================
  // 1. USER MULTI-TENANT (membre de 2 orgs avec rôles différents)
  // ================================================================
  console.log('👤 Création user multi-tenant...');
  
  const userMulti = await prisma.user.upsert({
    where: { email: 'multi@test.com' },
    update: {},
    create: {
      email: 'multi@test.com',
      password_hash: password,
      first_name: 'Multi',
      last_name: 'Tenant',
      is_active: true,
    },
  });

  // Membership Org1
  await prisma.orgUser.upsert({
    where: {
      user_id_org_id: {
        user_id: userMulti.id,
        org_id: org1.id,
      },
    },
    update: {},
    create: {
      user_id: userMulti.id,
      org_id: org1.id,
    },
  });

  // Rôle Manager dans Org1
  await prisma.tenantUserRole.upsert({
    where: {
      user_id_org_id: {
        user_id: userMulti.id,
        org_id: org1.id,
      },
    },
    update: {
      role_id: roleManagerOrg1.id,
    },
    create: {
      user_id: userMulti.id,
      org_id: org1.id,
      role_id: roleManagerOrg1.id,
    },
  });

  // Membership Org2
  await prisma.orgUser.upsert({
    where: {
      user_id_org_id: {
        user_id: userMulti.id,
        org_id: org2.id,
      },
    },
    update: {},
    create: {
      user_id: userMulti.id,
      org_id: org2.id,
    },
  });

  // Rôle Staff dans Org2
  await prisma.tenantUserRole.upsert({
    where: {
      user_id_org_id: {
        user_id: userMulti.id,
        org_id: org2.id,
      },
    },
    update: {
      role_id: roleStaffOrg2.id,
    },
    create: {
      user_id: userMulti.id,
      org_id: org2.id,
      role_id: roleStaffOrg2.id,
    },
  });

  console.log(`  ✅ ${userMulti.email} - Manager @ ${org1.name}, Staff @ ${org2.name}`);

  // ================================================================
  // 2. USER ADMIN ORG1 (admin d'une seule org)
  // ================================================================
  console.log('👤 Création admin org1...');
  
  const adminOrg1 = await prisma.user.upsert({
    where: { email: 'admin-org1@test.com' },
    update: {},
    create: {
      email: 'admin-org1@test.com',
      password_hash: password,
      first_name: 'Admin',
      last_name: 'Org1',
      is_active: true,
    },
  });

  await prisma.orgUser.upsert({
    where: {
      user_id_org_id: {
        user_id: adminOrg1.id,
        org_id: org1.id,
      },
    },
    update: {},
    create: {
      user_id: adminOrg1.id,
      org_id: org1.id,
    },
  });

  await prisma.tenantUserRole.upsert({
    where: {
      user_id_org_id: {
        user_id: adminOrg1.id,
        org_id: org1.id,
      },
    },
    update: {
      role_id: roleAdminOrg1.id,
    },
    create: {
      user_id: adminOrg1.id,
      org_id: org1.id,
      role_id: roleAdminOrg1.id,
    },
  });

  console.log(`  ✅ ${adminOrg1.email} - Admin @ ${org1.name}`);

  // ================================================================
  // 3. USER ADMIN ORG2
  // ================================================================
  console.log('👤 Création admin org2...');
  
  const adminOrg2 = await prisma.user.upsert({
    where: { email: 'admin-org2@test.com' },
    update: {},
    create: {
      email: 'admin-org2@test.com',
      password_hash: password,
      first_name: 'Admin',
      last_name: 'Org2',
      is_active: true,
    },
  });

  await prisma.orgUser.upsert({
    where: {
      user_id_org_id: {
        user_id: adminOrg2.id,
        org_id: org2.id,
      },
    },
    update: {},
    create: {
      user_id: adminOrg2.id,
      org_id: org2.id,
    },
  });

  await prisma.tenantUserRole.upsert({
    where: {
      user_id_org_id: {
        user_id: adminOrg2.id,
        org_id: org2.id,
      },
    },
    update: {
      role_id: roleAdminOrg2.id,
    },
    create: {
      user_id: adminOrg2.id,
      org_id: org2.id,
      role_id: roleAdminOrg2.id,
    },
  });

  console.log(`  ✅ ${adminOrg2.email} - Admin @ ${org2.name}`);

  // ================================================================
  // 4. SUPPORT AGENT (accès à org1 uniquement, scope=assigned)
  // ================================================================
  console.log('👤 Création support agent...');
  
  const support = await prisma.user.upsert({
    where: { email: 'support@test.com' },
    update: {},
    create: {
      email: 'support@test.com',
      password_hash: password,
      first_name: 'Support',
      last_name: 'Agent',
      is_active: true,
    },
  });

  // Rôle platform support
  await prisma.platformUserRole.upsert({
    where: {
      user_id: support.id,
    },
    update: {
      role_id: roleSupport.id,
      scope: 'assigned',
    },
    create: {
      user_id: support.id,
      role_id: roleSupport.id,
      scope: 'assigned',
    },
  });

  // Accès à org1 uniquement
  await prisma.platformUserOrgAccess.upsert({
    where: {
      user_id_org_id: {
        user_id: support.id,
        org_id: org1.id,
      },
    },
    update: {},
    create: {
      user_id: support.id,
      org_id: org1.id,
      reason: 'Support pour incidents org1',
    },
  });

  console.log(`  ✅ ${support.email} - Support (accès assigned à ${org1.name})`);

  // ================================================================
  // 5. ROOT ADMINISTRATOR (accès complet, scope=all)
  // ================================================================
  console.log('👤 Création root admin...');
  
  const root = await prisma.user.upsert({
    where: { email: 'root@test.com' },
    update: {},
    create: {
      email: 'root@test.com',
      password_hash: password,
      first_name: 'Root',
      last_name: 'Admin',
      is_active: true,
    },
  });

  await prisma.platformUserRole.upsert({
    where: {
      user_id: root.id,
    },
    update: {
      role_id: roleRoot.id,
      scope: 'all',
    },
    create: {
      user_id: root.id,
      role_id: roleRoot.id,
      scope: 'all',
    },
  });

  console.log(`  ✅ ${root.email} - Root (accès all orgs)\n`);

  // ================================================================
  // RÉSUMÉ
  // ================================================================
  console.log('📊 Résumé des données créées:\n');
  console.log('┌─────────────────────────┬──────────────────────────────────────┐');
  console.log('│ Email                   │ Rôles / Accès                        │');
  console.log('├─────────────────────────┼──────────────────────────────────────┤');
  console.log(`│ multi@test.com          │ Manager @ ${org1.name.padEnd(20)} │`);
  console.log(`│                         │ Staff @ ${org2.name.padEnd(22)} │`);
  console.log('├─────────────────────────┼──────────────────────────────────────┤');
  console.log(`│ admin-org1@test.com     │ Admin @ ${org1.name.padEnd(22)} │`);
  console.log('├─────────────────────────┼──────────────────────────────────────┤');
  console.log(`│ admin-org2@test.com     │ Admin @ ${org2.name.padEnd(22)} │`);
  console.log('├─────────────────────────┼──────────────────────────────────────┤');
  console.log(`│ support@test.com        │ Support (assigned: ${org1.name.padEnd(13)}) │`);
  console.log('├─────────────────────────┼──────────────────────────────────────┤');
  console.log('│ root@test.com           │ Root (all orgs)                      │');
  console.log('└─────────────────────────┴──────────────────────────────────────┘');
  console.log('\n🔑 Mot de passe pour tous les comptes : password123\n');

  console.log('✅ Test data seed completed successfully!\n');
}

main()
  .catch((e) => {
    console.error('❌ Test data seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
