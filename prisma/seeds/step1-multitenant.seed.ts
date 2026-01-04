/**
 * STEP 1 - Multi-tenant Seed
 * 
 * Ce seed est IDEMPOTENT : il peut être exécuté plusieurs fois sans créer de doublons
 * 
 * Responsabilités:
 * 1. Créer les rôles platform (support, root) si nécessaire
 * 2. Créer les rôles tenant par défaut pour chaque organisation (Admin, Manager, Staff, Viewer)
 * 3. Ces rôles seront marqués pour la propagation future (is_locked, managed_by_template)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ================================================================
// 1. RÔLES PLATFORM (globaux, org_id = null)
// ================================================================

const PLATFORM_ROLES = [
  {
    code: 'ROOT',
    name: 'Root Administrator',
    description: 'Super administrateur avec accès complet à toutes les organisations',
    level: 0,
    rank: 1,
    role_type: 'root',
    is_platform: true,
    is_root: true,
    is_system_role: true,
    is_locked: true,
    managed_by_template: false,
  },
  {
    code: 'SUPPORT',
    name: 'Support Agent',
    description: 'Agent support avec accès limité aux organisations assignées',
    level: 10,
    rank: 10,
    role_type: 'support',
    is_platform: true,
    is_root: false,
    is_system_role: true,
    is_locked: true,
    managed_by_template: false,
  },
];

// ================================================================
// 2. RÔLES TENANT (par organisation, org_id != null)
// ================================================================

const TENANT_ROLE_TEMPLATES = [
  {
    code: 'ADMIN',
    name: 'Administrator',
    description: 'Administrateur de l\'organisation avec tous les droits',
    level: 1,
    rank: 1,
    role_type: 'admin',
    is_platform: false,
    is_root: false,
    is_system_role: true,
    is_locked: true,
    managed_by_template: true,
  },
  {
    code: 'MANAGER',
    name: 'Manager',
    description: 'Gestionnaire d\'événements avec droits étendus',
    level: 2,
    rank: 2,
    role_type: 'manager',
    is_platform: false,
    is_root: false,
    is_system_role: true,
    is_locked: true,
    managed_by_template: true,
  },
  {
    code: 'STAFF',
    name: 'Staff',
    description: 'Membre de l\'équipe avec droits limités',
    level: 3,
    rank: 3,
    role_type: 'staff',
    is_platform: false,
    is_root: false,
    is_system_role: true,
    is_locked: false,
    managed_by_template: true,
  },
  {
    code: 'VIEWER',
    name: 'Viewer',
    description: 'Observateur avec droits de lecture uniquement',
    level: 4,
    rank: 4,
    role_type: 'viewer',
    is_platform: false,
    is_root: false,
    is_system_role: true,
    is_locked: false,
    managed_by_template: true,
  },
];

// ================================================================
// FONCTIONS UTILITAIRES
// ================================================================

/**
 * Crée ou met à jour les rôles platform (idempotent)
 */
async function seedPlatformRoles() {
  console.log('🔄 Seeding platform roles...');
  
  for (const roleData of PLATFORM_ROLES) {
    const role = await prisma.role.upsert({
      where: {
        org_id_code: {
          org_id: null,
          code: roleData.code,
        },
      },
      update: {
        name: roleData.name,
        description: roleData.description,
        level: roleData.level,
        rank: roleData.rank,
        role_type: roleData.role_type,
        is_platform: roleData.is_platform,
        is_root: roleData.is_root,
        is_system_role: roleData.is_system_role,
        is_locked: roleData.is_locked,
        managed_by_template: roleData.managed_by_template,
      },
      create: {
        org_id: null,
        code: roleData.code,
        name: roleData.name,
        description: roleData.description,
        level: roleData.level,
        rank: roleData.rank,
        role_type: roleData.role_type,
        is_platform: roleData.is_platform,
        is_root: roleData.is_root,
        is_system_role: roleData.is_system_role,
        is_locked: roleData.is_locked,
        managed_by_template: roleData.managed_by_template,
      },
    });
    
    console.log(`  ✅ Platform role: ${role.code} (${role.id})`);
  }
}

/**
 * Crée ou met à jour les rôles tenant pour une organisation (idempotent)
 */
async function seedTenantRolesForOrg(orgId: string, orgName: string) {
  console.log(`🔄 Seeding tenant roles for org: ${orgName} (${orgId})...`);
  
  for (const roleData of TENANT_ROLE_TEMPLATES) {
    const role = await prisma.role.upsert({
      where: {
        org_id_code: {
          org_id: orgId,
          code: roleData.code,
        },
      },
      update: {
        name: roleData.name,
        description: roleData.description,
        level: roleData.level,
        rank: roleData.rank,
        role_type: roleData.role_type,
        is_platform: roleData.is_platform,
        is_root: roleData.is_root,
        is_system_role: roleData.is_system_role,
        is_locked: roleData.is_locked,
        managed_by_template: roleData.managed_by_template,
      },
      create: {
        org_id: orgId,
        code: roleData.code,
        name: roleData.name,
        description: roleData.description,
        level: roleData.level,
        rank: roleData.rank,
        role_type: roleData.role_type,
        is_platform: roleData.is_platform,
        is_root: roleData.is_root,
        is_system_role: roleData.is_system_role,
        is_locked: roleData.is_locked,
        managed_by_template: roleData.managed_by_template,
      },
    });
    
    console.log(`  ✅ Tenant role: ${role.code} (${role.id})`);
  }
}

/**
 * Seed tous les rôles tenant pour toutes les organisations existantes
 */
async function seedAllTenantRoles() {
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true },
  });
  
  console.log(`\n📦 Found ${organizations.length} organization(s)\n`);
  
  for (const org of organizations) {
    await seedTenantRolesForOrg(org.id, org.name);
  }
}

// ================================================================
// HOOK: Auto-créer les rôles tenant lors de la création d'une org
// ================================================================

/**
 * Cette fonction doit être appelée automatiquement lors de la création d'une nouvelle organisation
 * Pour l'instant, elle est documentée ici pour référence
 * 
 * Dans votre service de création d'organisation, ajoutez:
 * 
 * ```typescript
 * async createOrganization(data: CreateOrganizationDto) {
 *   const org = await prisma.organization.create({ data });
 *   
 *   // Auto-créer les rôles tenant
 *   await seedTenantRolesForOrg(org.id, org.name);
 *   
 *   return org;
 * }
 * ```
 */

// ================================================================
// MAIN
// ================================================================

async function main() {
  console.log('\n🌱 Starting STEP 1 - Multi-tenant seed (idempotent)...\n');
  
  try {
    // 1. Seed platform roles
    await seedPlatformRoles();
    
    console.log('\n');
    
    // 2. Seed tenant roles for all existing organizations
    await seedAllTenantRoles();
    
    console.log('\n✅ Seed completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Seed failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// ================================================================
// EXPORTS POUR RÉUTILISATION
// ================================================================

export { seedPlatformRoles, seedTenantRolesForOrg, seedAllTenantRoles };
