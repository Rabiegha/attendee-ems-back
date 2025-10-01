import { prisma, SeedResult, logSuccess, logError } from './utils';

export interface PermissionSeedData {
  code: string;
  name: string;
}

const permissionsData: PermissionSeedData[] = [
  { code: 'users.create', name: 'Create Users' },
  { code: 'users.read', name: 'Read Users' },
  { code: 'users.update', name: 'Update Users' },
  { code: 'users.delete', name: 'Delete Users' },
  { code: 'organizations.read', name: 'Read Organizations' },
  { code: 'organizations.update', name: 'Update Organizations' },
  { code: 'roles.read', name: 'Read Roles' },
  { code: 'permissions.read', name: 'Read Permissions' },
  // Vous pouvez ajouter d'autres permissions ici
];

export async function seedPermissions(organizationId: string): Promise<SeedResult[]> {
  const results: SeedResult[] = [];
  
  try {
    for (const permData of permissionsData) {
      let permission = await prisma.permission.findFirst({
        where: { 
          org_id: organizationId,
          code: permData.code
        }
      });
      
      if (!permission) {
        permission = await prisma.permission.create({
          data: {
            org_id: organizationId,
            code: permData.code,
            name: permData.name,
          },
        });
      }

      results.push({
        success: true,
        message: `Permission '${permission.name}' created/updated`,
        data: permission,
      });
      
      logSuccess(`Created permission: ${permission.name}`);
    }
    
    return results;
  } catch (error) {
    const errorResult = {
      success: false,
      message: 'Failed to seed permissions',
    };
    
    logError('Failed to seed permissions', error);
    results.push(errorResult);
    return results;
  }
}

// Fonction pour obtenir une permission par code
export async function getPermissionByCode(organizationId: string, code: string) {
  return await prisma.permission.findFirst({
    where: {
      org_id: organizationId,
      code: code,
    },
  });
}

// Fonction pour obtenir toutes les permissions d'une organisation
export async function getPermissionsByOrganization(organizationId: string) {
  return await prisma.permission.findMany({
    where: {
      org_id: organizationId,
    },
  });
}

// Fonction pour assigner des permissions à un rôle
export async function assignPermissionsToRole(
  organizationId: string,
  roleId: string,
  permissionCodes: string[]
): Promise<SeedResult[]> {
  const results: SeedResult[] = [];
  
  try {
    for (const permissionCode of permissionCodes) {
      const permission = await getPermissionByCode(organizationId, permissionCode);
      
      if (!permission) {
        results.push({
          success: false,
          message: `Permission '${permissionCode}' not found`,
        });
        continue;
      }

      const existing = await prisma.rolePermission.findFirst({
        where: {
          org_id: organizationId,
          role_id: roleId,
          permission_id: permission.id,
        }
      });
      
      if (!existing) {
        await prisma.rolePermission.create({
          data: {
            org_id: organizationId,
            role_id: roleId,
            permission_id: permission.id,
          },
        });
        
        results.push({
          success: true,
          message: `Permission '${permission.name}' assigned to role`,
        });
        
        logSuccess(`Assigned permission '${permission.name}' to role`);
      }
    }
    
    return results;
  } catch (error) {
    const errorResult = {
      success: false,
      message: 'Failed to assign permissions to role',
    };
    
    logError('Failed to assign permissions to role', error);
    results.push(errorResult);
    return results;
  }
}
