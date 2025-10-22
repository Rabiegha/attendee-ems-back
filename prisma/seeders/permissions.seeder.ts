import { prisma, SeedResult, logSuccess, logError } from './utils';

export interface PermissionSeedData {
  code: string;
  name: string;
  description?: string;
}

/**
 * Liste complète des permissions du système EMS
 * Organisées par catégorie pour faciliter la maintenance
 */
const permissionsData: PermissionSeedData[] = [
  // ==================== ORGANIZATIONS ====================
  { 
    code: 'organizations.read:own', 
    name: 'Read own organization', 
    description: 'View own organization information' 
  },
  { 
    code: 'organizations.read:any', 
    name: 'Read any organization', 
    description: 'View any organization information (SUPER_ADMIN only)' 
  },
  { 
    code: 'organizations.create', 
    name: 'Create organization', 
    description: 'Create new organizations (SUPER_ADMIN only)' 
  },
  { 
    code: 'organizations.update', 
    name: 'Update organization', 
    description: 'Update organization settings' 
  },
  
  // ==================== USERS ====================
  { 
    code: 'users.read:own', 
    name: 'Read own profile', 
    description: 'View own user profile' 
  },
  { 
    code: 'users.read:any', 
    name: 'Read users', 
    description: 'View all users in organization' 
  },
  { 
    code: 'users.create', 
    name: 'Create users', 
    description: 'Create new users in organization' 
  },
  { 
    code: 'users.update', 
    name: 'Update users', 
    description: 'Update user information' 
  },
  { 
    code: 'users.delete', 
    name: 'Delete users', 
    description: 'Delete users from organization' 
  },
  
  // ==================== EVENTS ====================
  { 
    code: 'events.read:own', 
    name: 'Read assigned events', 
    description: 'View events assigned to user (PARTNER, HOSTESS)' 
  },
  { 
    code: 'events.read:any', 
    name: 'Read all events', 
    description: 'View all events in organization' 
  },
  { 
    code: 'events.create', 
    name: 'Create events', 
    description: 'Create new events' 
  },
  { 
    code: 'events.update', 
    name: 'Update events', 
    description: 'Update event information' 
  },
  { 
    code: 'events.delete', 
    name: 'Delete events', 
    description: 'Delete events' 
  },
  { 
    code: 'events.publish', 
    name: 'Publish events', 
    description: 'Publish events and make them public' 
  },
  
  // ==================== ATTENDEES ====================
  { 
    code: 'attendees.read', 
    name: 'Read attendees', 
    description: 'View attendee information' 
  },
  { 
    code: 'attendees.create', 
    name: 'Create attendees', 
    description: 'Add new attendees' 
  },
  { 
    code: 'attendees.update', 
    name: 'Update attendees', 
    description: 'Update attendee information' 
  },
  { 
    code: 'attendees.delete', 
    name: 'Delete attendees', 
    description: 'Delete attendees' 
  },
  { 
    code: 'attendees.checkin', 
    name: 'Check-in attendees', 
    description: 'Perform check-in for attendees at events' 
  },
  { 
    code: 'attendees.export', 
    name: 'Export attendees', 
    description: 'Export attendee data' 
  },
  
  // ==================== ROLES & PERMISSIONS ====================
  { 
    code: 'roles.read', 
    name: 'Read roles', 
    description: 'View role information' 
  },
  { 
    code: 'roles.manage', 
    name: 'Manage roles & permissions', 
    description: 'Access role management page and modify role permissions (ADMIN+ only)' 
  },
  { 
    code: 'roles.assign', 
    name: 'Assign roles', 
    description: 'Assign roles to users (ADMIN cannot change own role)' 
  },
  
  // ==================== INVITATIONS ====================
  { 
    code: 'invitations.create', 
    name: 'Send invitations', 
    description: 'Invite new users to organization' 
  },
  { 
    code: 'invitations.read', 
    name: 'Read invitations', 
    description: 'View pending invitations' 
  },
  { 
    code: 'invitations.cancel', 
    name: 'Cancel invitations', 
    description: 'Cancel pending invitations' 
  },
  
  // ==================== ANALYTICS & REPORTS ====================
  { 
    code: 'analytics.view', 
    name: 'View analytics', 
    description: 'Access analytics and reports' 
  },
  { 
    code: 'reports.export', 
    name: 'Export reports', 
    description: 'Export reports and data' 
  },
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

/**
 * Mapping des permissions par rôle
 * 
 * RÈGLES:
 * - SUPER_ADMIN: Développeurs uniquement, accès cross-tenant, TOUTES les permissions
 * - ADMIN: Toutes les permissions dans son organisation, SAUF ne peut pas modifier son propre rôle
 * - MANAGER: Gestion événements et participants, PAS de gestion des rôles/permissions
 * - VIEWER: Lecture seule
 * - PARTNER: Événements assignés uniquement
 * - HOSTESS: Check-in événements assignés uniquement
 */
export const rolePermissionMapping: Record<string, string[]> = {
  // ==================== SUPER_ADMIN ====================
  // Accès total système, toutes organisations
  'SUPER_ADMIN': [
    // Organizations
    'organizations.read:own',
    'organizations.read:any',
    'organizations.create',
    'organizations.update',
    
    // Users
    'users.read:own',
    'users.read:any',
    'users.create',
    'users.update',
    'users.delete',
    
    // Events
    'events.read:own',
    'events.read:any',
    'events.create',
    'events.update',
    'events.delete',
    'events.publish',
    
    // Attendees
    'attendees.read',
    'attendees.create',
    'attendees.update',
    'attendees.delete',
    'attendees.checkin',
    'attendees.export',
    
    // Roles
    'roles.read',
    'roles.manage',  // Accès à la page de gestion des permissions
    'roles.assign',  // Peut modifier TOUS les rôles (y compris ADMIN)
    
    // Invitations
    'invitations.create',
    'invitations.read',
    'invitations.cancel',
    
    // Analytics
    'analytics.view',
    'reports.export',
  ],
  
  // ==================== ADMIN ====================
  // Toutes permissions dans l'organisation, SAUF modification propre rôle
  'ADMIN': [
    // Organizations
    'organizations.read:own',
    'organizations.update',
    
    // Users
    'users.read:own',
    'users.read:any',
    'users.create',        // Créer un user = envoyer une invitation (invitations.create incluse)
    'users.update',
    'users.delete',
    
    // Events
    'events.read:any',
    'events.create',
    'events.update',
    'events.delete',
    'events.publish',
    
    // Attendees
    'attendees.read',
    'attendees.create',
    'attendees.update',
    'attendees.delete',
    'attendees.checkin',
    'attendees.export',
    
    // Roles
    'roles.read',
    'roles.manage',  // Accès à la page de gestion des permissions
    'roles.assign',  // Peut assigner rôles SAUF son propre rôle (guard côté backend)
    
    // Invitations (lié à users.create - création d'user passe par invitation)
    'invitations.create',  // ⚠️ Obligatoire pour users.create (logique métier)
    'invitations.read',
    'invitations.cancel',
    
    // Analytics
    'analytics.view',
    'reports.export',
  ],
  
  // ==================== MANAGER ====================
  // Opérationnel : peut créer/modifier mais PAS supprimer. Peut inviter des users avec rôles ≤ MANAGER
  'MANAGER': [
    // Organizations
    'organizations.read:own',
    
    // Users - Peut créer, modifier, voir mais PAS supprimer
    'users.read:own',
    'users.read:any',
    'users.create',        // Créer un user = envoyer une invitation (invitations.create incluse)
    'users.update',
    
    // Events - Peut créer, modifier mais PAS supprimer
    'events.read:any',
    'events.create',
    'events.update',
    'events.publish',
    
    // Attendees - Lecture et check-in uniquement (PAS de modification/suppression)
    'attendees.read',
    'attendees.create',
    'attendees.checkin',
    'attendees.export',
    
    // Roles - Peut voir et assigner des rôles (≤ MANAGER seulement, guard backend)
    'roles.read',
    'roles.assign',
    
    // Invitations (lié à users.create - création d'user passe par invitation)
    'invitations.create',  // ⚠️ Obligatoire pour users.create (logique métier)
    'invitations.read',
    
    // Analytics
    'analytics.view',
    'reports.export',
  ],
  
  // ==================== VIEWER ====================
  // Lecture seule complète : voit tout, ne fait rien
  'VIEWER': [
    // Organizations
    'organizations.read:own',
    
    // Users - Voir tous les users
    'users.read:own',
    'users.read:any',
    
    // Events - Voir tous les événements
    'events.read:any',
    
    // Attendees - Voir tous les participants
    'attendees.read',
    
    // Roles - Voir les rôles
    'roles.read',
    
    // Invitations - Voir les invitations
    'invitations.read',
    
    // Analytics
    'analytics.view',
    'reports.export',
  ],
  
  // ==================== PARTNER ====================
  // Événements assignés uniquement + Analytics de ses events
  'PARTNER': [
    // Users
    'users.read:own',
    
    // Events - uniquement assignés (logique applicative)
    'events.read:own',
    
    // Attendees - uniquement pour ses événements
    'attendees.read',
    
    // Analytics de ses événements
    'analytics.view',
  ],
  
  // ==================== HOSTESS ====================
  // Check-in pour événements assignés uniquement
  'HOSTESS': [
    // Users
    'users.read:own',
    
    // Events - uniquement assignés (logique applicative)
    'events.read:own',
    
    // Attendees - check-in uniquement
    'attendees.read',
    'attendees.checkin',
  ],
};

// Fonction pour assigner toutes les permissions selon le mapping des rôles
// IMPORTANT: Cette fonction assigne les permissions à TOUS les rôles (templates + org-specific)
export async function assignAllRolePermissions(): Promise<SeedResult[]> {
  const results: SeedResult[] = [];
  
  try {
    // Récupérer tous les rôles (incluant les templates système ET les rôles par organisation)
    const allRoles = await prisma.role.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        org_id: true,
        is_system_role: true,
      }
    });

    logSuccess(`\n📋 Found ${allRoles.length} total roles to assign permissions to`);
    logSuccess(`  - System templates: ${allRoles.filter(r => r.is_system_role).length}`);
    logSuccess(`  - Org-specific roles: ${allRoles.filter(r => !r.is_system_role).length}`);

    for (const role of allRoles) {
      const permissionCodes = rolePermissionMapping[role.code];
      
      if (!permissionCodes) {
        results.push({
          success: false,
          message: `No permission mapping found for role code '${role.code}'`,
        });
        continue;
      }
      
      const roleResults = await assignPermissionsToRole(role.id, permissionCodes);
      results.push(...roleResults);
      
      const roleType = role.is_system_role ? '(system template)' : `(org: ${role.org_id?.substring(0, 8)}...)`;
      logSuccess(`✓ Assigned ${permissionCodes.length} permissions to '${role.name}' ${roleType}`);
    }
    
    logSuccess(`\n✅ Total permission assignments: ${results.filter(r => r.success).length}`);
    
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
