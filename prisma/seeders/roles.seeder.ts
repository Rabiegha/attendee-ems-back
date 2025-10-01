import { prisma, SeedResult, logSuccess, logError } from './utils';

export interface RoleSeedData {
  code: string;
  name: string;
}

const rolesData: RoleSeedData[] = [
  {
    code: 'org_admin',
    name: 'Organization Administrator',
  },
  {
    code: 'user',
    name: 'Standard User',
  },
  // Vous pouvez ajouter d'autres rôles ici
];

export async function seedRoles(organizationId: string): Promise<SeedResult[]> {
  const results: SeedResult[] = [];
  
  try {
    for (const roleData of rolesData) {
      let role = await prisma.role.findFirst({
        where: { 
          org_id: organizationId,
          code: roleData.code
        }
      });
      
      if (!role) {
        role = await prisma.role.create({
          data: {
            org_id: organizationId,
            code: roleData.code,
            name: roleData.name,
          },
        });
      }

      results.push({
        success: true,
        message: `Role '${role.name}' created/updated`,
        data: role,
      });
      
      logSuccess(`Created role: ${role.name}`);
    }
    
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

// Fonction pour obtenir un rôle par code (utile pour les autres seeders)
export async function getRoleByCode(organizationId: string, code: string) {
  return await prisma.role.findFirst({
    where: {
      org_id: organizationId,
      code: code,
    },
  });
}

// Fonction pour obtenir tous les rôles d'une organisation
export async function getRolesByOrganization(organizationId: string) {
  return await prisma.role.findMany({
    where: {
      org_id: organizationId,
    },
  });
}
