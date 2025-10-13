import { prisma, SeedResult, logSuccess, logError } from './utils';

export interface PermissionSeedData {
  code: string;
  name: string;
  description?: string;
}

const permissionsData: PermissionSeedData[] = [
  // Organization permissions
  { code: 'organizations.read', name: 'Read organization', description: 'View organization information' },
  { code: 'organizations.read:any', name: 'Read any organization', description: 'View any organization information' },
  { code: 'organizations.read:own', name: 'Read own organization', description: 'View own organization information' },
  { code: 'organizations.create', name: 'Create organization', description: 'Create new organizations' },
  
  // User permissions
  { code: 'users.create', name: 'Create users', description: 'Create users in organization' },
  { code: 'users.read', name: 'Read users', description: 'View user information in organization' },
  { code: 'users.read:own', name: 'Read own user info', description: 'View own user information' },
  { code: 'users.read:any', name: 'Read any user info', description: 'View any user information in organization' },
  
  // Event permissions
  { code: 'event:read:any', name: 'Read any event', description: 'View event information' },
  { code: 'event:create', name: 'Create event', description: 'Create new events' },
  { code: 'event:update', name: 'Update event', description: 'Update event information' },
  { code: 'event:assign-partner', name: 'Assign partner to event', description: 'Assign partners to events' },
  { code: 'event:assign-host', name: 'Assign host to event', description: 'Assign hostesses to events' },
  
  // Attendee permissions
  { code: 'attendee:read', name: 'Read attendees', description: 'View attendee information' },
  { code: 'attendee:create', name: 'Create attendee', description: 'Create new attendees' },
  
  // Role permissions
  { code: 'roles.read', name: 'Read roles', description: 'View role information' },
  { code: 'roles.assign', name: 'Assign roles', description: 'Assign roles to users' },
  
  // Permission permissions
  { code: 'permissions.read', name: 'Read permissions', description: 'View permission definitions' },
];

export async function seedPermissions(): Promise<SeedResult[]> {
  const results: SeedResult[] = [];
  
  try {
    for (const permData of permissionsData) {
      const permission = await prisma.permission.upsert({
        where: { 
          code: permData.code
        },
        update: {
          name: permData.name,
          description: permData.description,
        },
        create: {
          code: permData.code,
          name: permData.name,
          description: permData.description,
        },
      });

      results.push({
        success: true,
        message: `Permission '${permission.name}' created/updated`,
        data: permission,
      });
      
      logSuccess(`Upserted permission: ${permission.name}`);
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
export async function getPermissionByCode(code: string) {
  return await prisma.permission.findUnique({
    where: {
      code: code,
    },
  });
}

// Fonction pour obtenir toutes les permissions
export async function getAllPermissions() {
  return await prisma.permission.findMany();
}

// Mapping des permissions par rôle selon les spécifications
export const rolePermissionMapping: Record<string, string[]> = {
  'SUPER_ADMIN': [
    'organizations.read:any', 'organizations.create',
    'users.create', 'users.read:any',
    'event:read:any', 'event:create', 'event:update', 'event:assign-partner', 'event:assign-host',
    'attendee:read', 'attendee:create',
    'roles.read', 'roles.assign',
    'permissions.read'
  ],
  'ADMIN': [
    'users.create', 'users.read:any',
    'event:read:any', 'event:create', 'event:update', 'event:assign-partner', 'event:assign-host',
    'attendee:read', 'attendee:create',
    'roles.read', 'roles.assign',
    'permissions.read'
  ],
  'MANAGER': [
    'users.read:any',
    'event:read:any', 'event:create', 'event:update', 'event:assign-partner', 'event:assign-host',
    'attendee:read', 'attendee:create',
    'roles.read', 'roles.assign',
    'permissions.read'
  ],
  'VIEWER': [
    'event:read:any',
    'attendee:read'
  ],
  'PARTNER': [
    'event:read:any'
  ],
  'HOSTESS': [
    'event:read:any'
  ]
};

// Fonction pour assigner toutes les permissions selon le mapping des rôles
export async function assignAllRolePermissions(): Promise<SeedResult[]> {
  const results: SeedResult[] = [];
  
  try {
    for (const [roleCode, permissionCodes] of Object.entries(rolePermissionMapping)) {
      const role = await prisma.role.findUnique({
        where: { code: roleCode }
      });
      
      if (!role) {
        results.push({
          success: false,
          message: `Role '${roleCode}' not found`,
        });
        continue;
      }
      
      const roleResults = await assignPermissionsToRole(role.id, permissionCodes);
      results.push(...roleResults);
      
      logSuccess(`Assigned ${permissionCodes.length} permissions to role '${role.name}'`);
    }
    
    return results;
  } catch (error) {
    const errorResult = {
      success: false,
      message: 'Failed to assign role permissions',
    };
    
    logError('Failed to assign role permissions', error);
    results.push(errorResult);
    return results;
  }
}

// Fonction pour assigner des permissions à un rôle
export async function assignPermissionsToRole(
  roleId: string,
  permissionCodes: string[]
): Promise<SeedResult[]> {
  const results: SeedResult[] = [];
  
  try {
    for (const permissionCode of permissionCodes) {
      const permission = await getPermissionByCode(permissionCode);
      
      if (!permission) {
        results.push({
          success: false,
          message: `Permission '${permissionCode}' not found`,
        });
        continue;
      }

      const rolePermission = await prisma.rolePermission.upsert({
        where: {
          role_id_permission_id: {
            role_id: roleId,
            permission_id: permission.id,
          }
        },
        update: {},
        create: {
          role_id: roleId,
          permission_id: permission.id,
        },
      });
      
      results.push({
        success: true,
        message: `Permission '${permission.name}' assigned to role`,
      });
      
      logSuccess(`Upserted permission assignment '${permission.name}' to role`);
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
