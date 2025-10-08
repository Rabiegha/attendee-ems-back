import { prisma, SeedResult, logSuccess, logError } from './utils';

export interface RoleSeedData {
  code: string;
  name: string;
  description?: string;
}

const rolesData: RoleSeedData[] = [
  {
    code: 'SUPER_ADMIN',
    name: 'Super Administrator',
    description: 'Full system access across all organizations',
  },
  {
    code: 'ADMIN',
    name: 'Administrator',
    description: 'Full access within organization',
  },
  {
    code: 'MANAGER',
    name: 'Manager',
    description: 'Management access within organization',
  },
  {
    code: 'VIEWER',
    name: 'Viewer',
    description: 'Read-only access to events and attendees',
  },
  {
    code: 'PARTNER',
    name: 'Partner',
    description: 'Access to assigned events as partner',
  },
  {
    code: 'HOSTESS',
    name: 'Hostess',
    description: 'Access to assigned events as hostess',
  },
];

export async function seedRoles(): Promise<SeedResult[]> {
  const results: SeedResult[] = [];
  
  try {
    for (const roleData of rolesData) {
      const role = await prisma.role.upsert({
        where: { 
          code: roleData.code
        },
        update: {
          name: roleData.name,
          description: roleData.description,
        },
        create: {
          code: roleData.code,
          name: roleData.name,
          description: roleData.description,
        },
      });

      results.push({
        success: true,
        message: `Role '${role.name}' created/updated`,
        data: role,
      });
      
      logSuccess(`Upserted role: ${role.name}`);
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

// Fonction pour obtenir un rôle par code
export async function getRoleByCode(code: string) {
  return await prisma.role.findUnique({
    where: {
      code: code,
    },
  });
}

// Fonction pour obtenir tous les rôles
export async function getAllRoles() {
  return await prisma.role.findMany();
}
