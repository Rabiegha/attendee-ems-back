import { prisma, SeedResult, logSuccess, logError } from './utils';

export interface PermissionSeedData {
  code: string;
  name: string;
}

const permissionsData: PermissionSeedData[] = [
  { code: 'users.create', name: 'Create new users' },
  { code: 'users.read', name: 'View user information' },
  { code: 'users.update', name: 'Update user information' },
  { code: 'users.delete', name: 'Delete users' },
  { code: 'organizations.read', name: 'View organization information' },
  { code: 'organizations.update', name: 'Update organization settings' },
  { code: 'roles.read', name: 'View roles and permissions' },
  { code: 'permissions.read', name: 'View permission definitions' },
  // Vous pouvez ajouter d'autres permissions ici
];

export async function seedPermissions(orgId: string): Promise<SeedResult[]> {
  const results: SeedResult[] = [];
  
  try {
    for (const permData of permissionsData) {
      let permission = await prisma.permission.findUnique({
        where: { 
          org_id_code: {
            org_id: orgId,
            code: permData.code
          }
        }
      });
      
      if (!permission) {
        permission = await prisma.permission.create({
          data: {
            org_id: orgId,
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

// Fonction pour obtenir une permission par code et org_id
export async function getPermissionByCode(orgId: string, code: string) {
  return await prisma.permission.findUnique({
    where: {
      org_id_code: {
        org_id: orgId,
        code: code,
      },
    },
  });
}

// Fonction pour obtenir toutes les permissions d'une organisation
export async function getAllPermissions(orgId: string) {
  return await prisma.permission.findMany({
    where: {
      org_id: orgId,
    },
  });
}

// Fonction pour assigner des permissions à un rôle
export async function assignPermissionsToRole(
  orgId: string,
  roleId: string,
  permissionCodes: string[]
): Promise<SeedResult[]> {
  const results: SeedResult[] = [];
  
  try {
    for (const permissionCode of permissionCodes) {
      const permission = await getPermissionByCode(orgId, permissionCode);
      
      if (!permission) {
        results.push({
          success: false,
          message: `Permission '${permissionCode}' not found`,
        });
        continue;
      }

      const existing = await prisma.rolePermission.findUnique({
        where: {
          org_id_role_id_permission_id: {
            org_id: orgId,
            role_id: roleId,
            permission_id: permission.id,
          }
        }
      });
      
      if (!existing) {
        await prisma.rolePermission.create({
          data: {
            org_id: orgId,
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
