import { prisma, SeedResult, logSuccess, logError } from './utils';

// Simple console log helpers si logInfo n'existe pas dans utils
const logInfo = (message: string) => console.log(message);

export interface RoleSeedData {
  code: string;
  name: string;
  description?: string;
  level: number;  // Hiérarchie du rôle
  is_system_role: boolean;  // true = template global, false = rôle organisation
}

/**
 * Rôles système (templates) - servent de base pour créer les rôles des organisations
 * org_id = NULL pour indiquer que ce sont des templates
 * 
 * Hiérarchie des rôles (level):
 * - 0: SUPER_ADMIN (accès global, réservé aux développeurs)
 * - 1: ADMIN (gestion complète de l'organisation)
 * - 2: MANAGER (gestion des événements et participants)
 * - 3: PARTNER (accès aux événements assignés)
 * - 4: VIEWER (lecture seule)
 * - 5: HOSTESS (check-in uniquement)
 * 
 * Règle: Un utilisateur ne peut créer/modifier que des rôles de niveau égal ou supérieur au sien
 * 
 * Chaque organisation peut ensuite:
 * 1. Utiliser ces templates pour créer ses propres rôles
 * 2. Personnaliser les permissions de chaque rôle
 * 3. Créer des rôles complètement personnalisés
 * 
 * Exemple: Un "MANAGER" dans l'org X peut avoir des permissions différentes
 *          du "MANAGER" dans l'org Y
 */
const systemRolesTemplates: RoleSeedData[] = [
  {
    code: 'SUPER_ADMIN',
    name: 'Super Administrator',
    description: 'System role - Full access across all organizations. Reserved for developers.',
    level: 0,
    is_system_role: true,
  },
  {
    code: 'ADMIN',
    name: 'Administrator',
    description: 'Full management of organization',
    level: 1,
    is_system_role: true,
  },
  {
    code: 'MANAGER',
    name: 'Manager',
    description: 'Event and attendee management',
    level: 2,
    is_system_role: true,
  },
  {
    code: 'PARTNER',
    name: 'Partner',
    description: 'Access to assigned events only',
    level: 3,
    is_system_role: true,
  },
  {
    code: 'VIEWER',
    name: 'Viewer',
    description: 'Read-only access',
    level: 4,
    is_system_role: true,
  },
  {
    code: 'HOSTESS',
    name: 'Hostess',
    description: 'Check-in for assigned events',
    level: 5,
    is_system_role: true,
  },
];

/**
 * Crée les rôles système (templates globaux)
 * Ces rôles ont org_id = NULL et is_system_role = true
 */
async function seedSystemRoleTemplates(): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  for (const roleData of systemRolesTemplates) {
    // Chercher si le rôle système existe déjà
    const existingRole = await prisma.role.findFirst({
      where: {
        code: roleData.code,
        org_id: null,
      }
    });

    let role;
    if (existingRole) {
      // Mise à jour
      role = await prisma.role.update({
        where: { id: existingRole.id },
        data: {
          name: roleData.name,
          description: roleData.description,
          level: roleData.level,
          is_system_role: roleData.is_system_role,
        },
      });
    } else {
      // Création
      role = await prisma.role.create({
        data: {
          code: roleData.code,
          name: roleData.name,
          description: roleData.description,
          level: roleData.level,
          is_system_role: roleData.is_system_role,
          org_id: null,
        },
      });
    }

    results.push({
      success: true,
      message: `System role template '${role.name}' created/updated`,
      data: role,
    });
    
    logSuccess(`✓ System role template: ${role.name} (${role.code})`);
  }

  return results;
}

/**
 * Clone les templates de rôles système pour une organisation spécifique
 * Chaque organisation obtient une copie personnalisable de tous les rôles (sauf SUPER_ADMIN)
 */
async function seedOrganizationRoles(orgId: string): Promise<SeedResult[]> {
  const results: SeedResult[] = [];

  // Récupérer les templates système (sauf SUPER_ADMIN qui reste global)
  const roleTemplatesToClone = systemRolesTemplates.filter(
    r => r.code !== 'SUPER_ADMIN'
  );

  for (const roleTemplate of roleTemplatesToClone) {
    // Chercher si le rôle existe déjà pour cette organisation
    const existingRole = await prisma.role.findFirst({
      where: {
        code: roleTemplate.code,
        org_id: orgId,
      }
    });

    let orgRole;
    if (existingRole) {
      // Mise à jour
      orgRole = await prisma.role.update({
        where: { id: existingRole.id },
        data: {
          name: roleTemplate.name,
          description: roleTemplate.description,
          level: roleTemplate.level,
          is_system_role: false,
        },
      });
    } else {
      // Création
      orgRole = await prisma.role.create({
        data: {
          code: roleTemplate.code,
          name: roleTemplate.name,
          description: roleTemplate.description,
          level: roleTemplate.level,
          is_system_role: false,
          org_id: orgId,
        },
      });
    }

    results.push({
      success: true,
      message: `Organization role '${orgRole.name}' created/updated for org ${orgId}`,
      data: orgRole,
    });
    
    logSuccess(`  ↳ Org role: ${orgRole.name} (${orgRole.code})`);
  }

  return results;
}

export async function seedRoles(): Promise<SeedResult[]> {
  const results: SeedResult[] = [];
  
  try {
    // Étape 1: Créer les templates système
    logInfo('\n📋 Creating system role templates...');
    const systemRolesResults = await seedSystemRoleTemplates();
    results.push(...systemRolesResults);

    // Étape 2: Récupérer toutes les organisations
    const organizations = await prisma.organization.findMany({
      select: { id: true, name: true },
    });

    logInfo(`\n🏢 Creating organization-specific roles for ${organizations.length} organizations...`);

    // Étape 3: Cloner les rôles pour chaque organisation
    for (const org of organizations) {
      logInfo(`\n  Organization: ${org.name}`);
      const orgRolesResults = await seedOrganizationRoles(org.id);
      results.push(...orgRolesResults);
    }

    logSuccess(`\n✅ Total roles created: ${results.length}`);
    
    return results;
  } catch (error) {
    const errorResult = {
      success: false,
      message: 'Failed to seed roles',
    };
    
    logError('Failed to seed roles', error);
    results.push(errorResult);
    return results;
  }
}

// Fonction pour obtenir un rôle par code (system template uniquement - org_id = NULL)
export async function getRoleByCode(code: string) {
  return await prisma.role.findFirst({
    where: {
      code: code,
      org_id: null,
    },
  });
}

// Fonction pour obtenir un rôle d'une organisation spécifique
export async function getRoleByOrgAndCode(orgId: string | null, code: string) {
  return await prisma.role.findFirst({
    where: {
      code: code,
      org_id: orgId,
    },
  });
}

// Fonction pour obtenir tous les rôles
export async function getAllRoles() {
  return await prisma.role.findMany();
}
