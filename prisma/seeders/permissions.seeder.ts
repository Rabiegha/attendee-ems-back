import { prisma, SeedResult, logSuccess, logError } from './utils';

export interface PermissionSeedData {
  code: string;
  scope: 'any' | 'org' | 'assigned' | 'own' | 'none';
  name: string;
  description?: string;
}

/**
 * Liste complète des permissions du système EMS
 * Organisées par catégorie pour faciliter la maintenance
 */
const permissionsData: PermissionSeedData[] = [
  // ==================== ORGANIZATIONS ====================
  // Phase 4: Organizations avec scopes explicites
  { 
    code: 'organizations.read',
    scope: 'any',
    name: 'Read all organizations (cross-tenant)', 
    description: 'View all organizations (SUPER_ADMIN)' 
  },
  { 
    code: 'organizations.read',
    scope: 'org',
    name: 'Read own organization', 
    description: 'View own organization information' 
  },
  { 
    code: 'organizations.create',
    scope: 'any',
    name: 'Create organization', 
    description: 'Create new organizations (SUPER_ADMIN only)' 
  },
  { 
    code: 'organizations.update',
    scope: 'any',
    name: 'Update organizations (cross-tenant)', 
    description: 'Update any organization settings (SUPER_ADMIN)' 
  },
  { 
    code: 'organizations.update',
    scope: 'org',
    name: 'Update organization', 
    description: 'Update own organization settings' 
  },
  
  // ==================== USERS ====================
  // Phase 4: Users avec scopes explicites
  { 
    code: 'users.read',
    scope: 'any',
    name: 'Read all users (cross-tenant)', 
    description: 'View users across all organizations (SUPER_ADMIN)' 
  },
  { 
    code: 'users.read',
    scope: 'org',
    name: 'Read users', 
    description: 'View users in own organization' 
  },
  { 
    code: 'users.read',
    scope: 'own',
    name: 'Read own profile', 
    description: 'View only own user profile' 
  },
  { 
    code: 'users.create',
    scope: 'any',
    name: 'Create users (cross-tenant)', 
    description: 'Create users in any organization (SUPER_ADMIN)' 
  },
  { 
    code: 'users.create',
    scope: 'org',
    name: 'Create users', 
    description: 'Create new users in organization' 
  },
  { 
    code: 'users.update',
    scope: 'any',
    name: 'Update users (cross-tenant)', 
    description: 'Update users in any organization (SUPER_ADMIN)' 
  },
  { 
    code: 'users.update',
    scope: 'org',
    name: 'Update users', 
    description: 'Update user information in organization' 
  },
  { 
    code: 'users.delete',
    scope: 'any',
    name: 'Delete users (cross-tenant)', 
    description: 'Delete users from any organization (SUPER_ADMIN)' 
  },
  { 
    code: 'users.delete',
    scope: 'org',
    name: 'Delete users', 
    description: 'Delete users from organization' 
  },
  
  // ==================== EVENTS ====================
  // Phase 1: Events avec scopes explicites (code SANS scope, scope séparé)
  { 
    code: 'events.read', 
    scope: 'any',
    name: 'Read all events (cross-tenant)', 
    description: 'View all events across all organizations (SUPER_ADMIN)' 
  },
  { 
    code: 'events.read', 
    scope: 'org',
    name: 'Read organization events', 
    description: 'View all events in own organization (ADMIN, MANAGER, VIEWER)' 
  },
  { 
    code: 'events.read', 
    scope: 'assigned',
    name: 'Read assigned events', 
    description: 'View only events assigned via EventAccess (PARTNER, HOSTESS)' 
  },
  { 
    code: 'events.create', 
    scope: 'any',
    name: 'Create events (cross-tenant)', 
    description: 'Create events in any organization (SUPER_ADMIN)' 
  },
  { 
    code: 'events.create', 
    scope: 'org',
    name: 'Create events', 
    description: 'Create new events in organization' 
  },
  { 
    code: 'events.update', 
    scope: 'any',
    name: 'Update events (cross-tenant)', 
    description: 'Update events in any organization (SUPER_ADMIN)' 
  },
  { 
    code: 'events.update', 
    scope: 'org',
    name: 'Update events', 
    description: 'Update event information in organization' 
  },
  { 
    code: 'events.delete', 
    scope: 'any',
    name: 'Delete events (cross-tenant)', 
    description: 'Delete events in any organization (SUPER_ADMIN)' 
  },
  { 
    code: 'events.delete', 
    scope: 'org',
    name: 'Delete events', 
    description: 'Delete events in organization' 
  },
  { 
    code: 'events.publish', 
    scope: 'any',
    name: 'Publish events (cross-tenant)', 
    description: 'Publish events in any organization (SUPER_ADMIN)' 
  },
  { 
    code: 'events.publish', 
    scope: 'org',
    name: 'Publish events', 
    description: 'Publish events and make them public' 
  },
  
  // ==================== ATTENDEES ====================
  // Phase 2: Attendees avec scopes explicites (code SANS scope, scope séparé)
  { 
    code: 'attendees.read',
    scope: 'any',
    name: 'Read all attendees (cross-tenant)', 
    description: 'View all attendees across all organizations (SUPER_ADMIN)' 
  },
  { 
    code: 'attendees.read',
    scope: 'org',
    name: 'Read organization attendees', 
    description: 'View all attendees in own organization' 
  },
  { 
    code: 'attendees.create',
    scope: 'any',
    name: 'Create attendees (cross-tenant)', 
    description: 'Create attendees in any organization (SUPER_ADMIN)' 
  },
  { 
    code: 'attendees.create',
    scope: 'org',
    name: 'Create attendees', 
    description: 'Add new attendees in organization' 
  },
  { 
    code: 'attendees.update',
    scope: 'any',
    name: 'Update attendees (cross-tenant)', 
    description: 'Update attendees in any organization (SUPER_ADMIN)' 
  },
  { 
    code: 'attendees.update',
    scope: 'org',
    name: 'Update attendees', 
    description: 'Update attendee information in organization' 
  },
  { 
    code: 'attendees.delete',
    scope: 'any',
    name: 'Delete attendees (cross-tenant)', 
    description: 'Delete attendees in any organization (SUPER_ADMIN)' 
  },
  { 
    code: 'attendees.delete',
    scope: 'org',
    name: 'Delete attendees', 
    description: 'Delete attendees in organization' 
  },
  { 
    code: 'attendees.restore',
    scope: 'any',
    name: 'Restore attendees (cross-tenant)', 
    description: 'Restore soft-deleted attendees in any organization (SUPER_ADMIN)' 
  },
  { 
    code: 'attendees.restore',
    scope: 'org',
    name: 'Restore attendees', 
    description: 'Restore soft-deleted attendees in organization' 
  },
  { 
    code: 'attendees.permanent-delete',
    scope: 'any',
    name: 'Permanently delete attendees (cross-tenant)', 
    description: 'Permanently delete attendees and all relations in any organization (SUPER_ADMIN)' 
  },
  { 
    code: 'attendees.permanent-delete',
    scope: 'org',
    name: 'Permanently delete attendees', 
    description: 'Permanently delete attendees and all relations in organization' 
  },
  { 
    code: 'attendees.checkin',
    scope: 'any',
    name: 'Check-in attendees (cross-tenant)', 
    description: 'Check-in attendees in any organization (SUPER_ADMIN)' 
  },
  { 
    code: 'attendees.checkin',
    scope: 'org',
    name: 'Check-in attendees', 
    description: 'Perform check-in for attendees at events' 
  },
  { 
    code: 'attendees.export',
    scope: 'any',
    name: 'Export attendees (cross-tenant)', 
    description: 'Export attendees from any organization (SUPER_ADMIN)' 
  },
  { 
    code: 'attendees.export',
    scope: 'org',
    name: 'Export attendees', 
    description: 'Export attendee data from organization' 
  },
  
  // ==================== REGISTRATIONS ====================
  // Phase 3: Registrations avec scopes explicites (code SANS scope, scope séparé)
  { 
    code: 'registrations.read',
    scope: 'any',
    name: 'Read all registrations (cross-tenant)', 
    description: 'View registrations across all organizations (SUPER_ADMIN)' 
  },
  { 
    code: 'registrations.read',
    scope: 'org',
    name: 'Read organization registrations', 
    description: 'View registrations in own organization' 
  },
  { 
    code: 'registrations.create',
    scope: 'any',
    name: 'Create registrations (cross-tenant)', 
    description: 'Create registrations in any organization (SUPER_ADMIN)' 
  },
  { 
    code: 'registrations.create',
    scope: 'org',
    name: 'Create registrations', 
    description: 'Create new event registrations in organization' 
  },
  { 
    code: 'registrations.update',
    scope: 'any',
    name: 'Update registrations (cross-tenant)', 
    description: 'Update registrations in any organization (SUPER_ADMIN)' 
  },
  { 
    code: 'registrations.update',
    scope: 'org',
    name: 'Update registrations', 
    description: 'Update registration status and information in organization' 
  },
  { 
    code: 'registrations.delete',
    scope: 'any',
    name: 'Delete registrations (cross-tenant)', 
    description: 'Delete registrations in any organization (SUPER_ADMIN)' 
  },
  { 
    code: 'registrations.delete',
    scope: 'org',
    name: 'Delete registrations', 
    description: 'Delete event registrations in organization' 
  },
  { 
    code: 'registrations.import',
    scope: 'any',
    name: 'Import registrations (cross-tenant)', 
    description: 'Bulk import registrations in any organization (SUPER_ADMIN)' 
  },
  { 
    code: 'registrations.import',
    scope: 'org',
    name: 'Import registrations', 
    description: 'Bulk import registrations from files in organization' 
  },
  
  // ==================== ROLES & PERMISSIONS ====================
  { 
    code: 'roles.read',
    scope: 'none',
    name: 'Read roles', 
    description: 'View role information' 
  },
  { 
    code: 'roles.manage',
    scope: 'none',
    name: 'Manage roles & permissions', 
    description: 'Access role management page and modify role permissions (ADMIN+ only)' 
  },
  { 
    code: 'roles.assign',
    scope: 'none',
    name: 'Assign roles', 
    description: 'Assign roles to users (ADMIN cannot change own role)' 
  },
  
  // ==================== INVITATIONS ====================
  { 
    code: 'invitations.create',
    scope: 'none',
    name: 'Send invitations', 
    description: 'Invite new users to organization' 
  },
  { 
    code: 'invitations.read',
    scope: 'none',
    name: 'Read invitations', 
    description: 'View pending invitations' 
  },
  { 
    code: 'invitations.cancel',
    scope: 'none',
    name: 'Cancel invitations', 
    description: 'Cancel pending invitations' 
  },
  
  // ==================== ANALYTICS & REPORTS ====================
  { 
    code: 'analytics.view',
    scope: 'none',
    name: 'View analytics', 
    description: 'Access analytics and reports' 
  },
  { 
    code: 'reports.export',
    scope: 'none',
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
          code_scope: {
            code: permData.code,
            scope: permData.scope,
          }
        },
        update: {
          name: permData.name,
          description: permData.description,
        },
        create: {
          code: permData.code,
          scope: permData.scope,
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

// Fonction pour obtenir une permission par code et scope
export async function getPermissionByCodeAndScope(code: string, scope: 'any' | 'org' | 'assigned' | 'own' | 'none') {
  return await prisma.permission.findUnique({
    where: {
      code_scope: {
        code,
        scope,
      },
    },
  });
}

// Fonction pour obtenir toutes les permissions d'un code (tous scopes)
export async function getPermissionsByCode(code: string) {
  return await prisma.permission.findMany({
    where: {
      code,
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
    // Organizations - SUPER_ADMIN a accès cross-tenant COMPLET
    'organizations.read:any',
    'organizations.create:any',
    'organizations.update:any',
    
    // Users - SUPER_ADMIN a accès cross-tenant COMPLET
    'users.read:any',
    'users.create:any',
    'users.update:any',
    'users.delete:any',
    
    // Events - SUPER_ADMIN a accès cross-tenant COMPLET (toutes actions, toutes orgs)
    'events.read:any',
    'events.create:any',
    'events.update:any',
    'events.delete:any',
    'events.publish:any',
    
    // Attendees - SUPER_ADMIN a accès cross-tenant COMPLET
    'attendees.read:any',
    'attendees.create:any',
    'attendees.update:any',
    'attendees.delete:any',
    'attendees.restore:any',
    'attendees.permanent-delete:any',
    'attendees.checkin:any',
    'attendees.export:any',
    
    // Registrations - SUPER_ADMIN a accès cross-tenant COMPLET
    'registrations.read:any',
    'registrations.create:any',
    'registrations.update:any',
    'registrations.import:any',
    
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
    // Organizations - ADMIN voit et gère son org
    'organizations.read:org',
    'organizations.update:org',
    
    // Users - ADMIN gère les users de son org
    'users.read:org',
    'users.create:org',
    'users.update:org',
    'users.delete:org',
    
    // Events - ADMIN voit toute son org
    'events.read:org',
    'events.create:org',
    'events.update:org',
    'events.delete:org',
    'events.publish:org',
    
    // Attendees - ADMIN voit toute son org
    'attendees.read:org',
    'attendees.create:org',
    'attendees.update:org',
    'attendees.delete:org',
    'attendees.restore:org',
    'attendees.permanent-delete:org',
    'attendees.checkin:org',
    'attendees.export:org',
    
    // Registrations - ADMIN voit toute son org
    'registrations.read:org',
    'registrations.create:org',
    'registrations.update:org',
    'registrations.import:org',
    
    // Roles
    'roles.read',
    'roles.manage',  // Accès à la page de gestion des permissions
    'roles.assign',  // Peut assigner rôles SAUF son propre rôle (guard côté backend)
    
    // Invitations (lié à users.create - création d'user passe par invitation)
    'invitations.create',  // Obligatoire pour users.create (logique métier)
    'invitations.read',
    'invitations.cancel',
    
    // Analytics
    'analytics.view',
    'reports.export',
  ],
  
  // ==================== MANAGER ====================
  // Opérationnel : peut créer/modifier mais PAS supprimer
  'MANAGER': [
    // Organizations - MANAGER voit son org
    'organizations.read:org',
    
    // Users - MANAGER peut créer et modifier users
    'users.read:org',
    'users.create:org',
    'users.update:org',
    
    // Events - MANAGER voit toute son org, peut créer/modifier
    'events.read:org',
    'events.create:org',
    'events.update:org',
    'events.publish:org',
    
    // Attendees - MANAGER peut lire, créer et check-in
    'attendees.read:org',
    'attendees.create:org',
    'attendees.checkin:org',
    'attendees.export:org',
    
    // Registrations - MANAGER peut lire, créer et importer
    'registrations.read:org',
    'registrations.create:org',
    'registrations.import:org',
    
    // Roles - Peut voir et assigner des rôles (≤ MANAGER seulement, guard backend)
    'roles.read',
    'roles.assign',
    
    // Invitations (lié à users.create - création d'user passe par invitation)
    'invitations.create',  // Obligatoire pour users.create (logique métier)
    'invitations.read',
    
    // Analytics
    'analytics.view',
    'reports.export',
  ],
  
  // ==================== VIEWER ====================
  // Lecture seule complète : voit tout, ne fait rien
  'VIEWER': [
    // Organizations - VIEWER voit son org
    'organizations.read:org',
    
    // Users - VIEWER voit uniquement son propre profil
    'users.read:own',
    
    // Events - VIEWER voit toute son org
    'events.read:org',
    
    // Attendees - VIEWER voit toute son org
    'attendees.read:org',
    
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
    // Users - PARTNER voit uniquement son propre profil
    'users.read:own',
    
    // Events - PARTNER voit uniquement les events assignés
    'events.read:assigned',
    
    // Attendees - PARTNER voit toute l'org
    'attendees.read:org',
    
    // Registrations - PARTNER peut lire les registrations de l'org
    'registrations.read:org',
    
    // Analytics de ses événements
    'analytics.view',
  ],
  
  // ==================== HOSTESS ====================
  // Check-in pour événements assignés uniquement
  'HOSTESS': [
    // Users - HOSTESS voit uniquement son propre profil
    'users.read:own',
    
    // Events - HOSTESS voit uniquement les events assignés
    'events.read:assigned',
    
    // Attendees - HOSTESS peut lire et check-in
    'attendees.read:org',
    'attendees.checkin:org',
    
    // Registrations - HOSTESS peut lire uniquement
    'registrations.read:org',
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
// Gère le format legacy "code:scope" et le nouveau format avec scope séparé
export async function assignPermissionsToRole(
  roleId: string,
  permissionCodes: string[]
): Promise<SeedResult[]> {
  const results: SeedResult[] = [];
  
  try {
    for (const permissionCode of permissionCodes) {
      // Parser le code pour extraire code et scope
      // Format: "events.read:any" ou "events.create" (sans scope)
      let code: string;
      let scope: 'any' | 'org' | 'assigned' | 'own' | 'none' = 'none';
      
      if (permissionCode.includes(':')) {
        const parts = permissionCode.split(':');
        code = parts[0];
        const scopePart = parts[1];
        
        // Mapper les scopes
        if (scopePart === 'any') scope = 'any';
        else if (scopePart === 'org') scope = 'org';
        else if (scopePart === 'assigned') scope = 'assigned';
        else if (scopePart === 'own') scope = 'own';
        else scope = 'none';
      } else {
        code = permissionCode;
        scope = 'none';
      }
      
      // Chercher la permission avec code + scope
      const permission = await getPermissionByCodeAndScope(code, scope);
      
      if (!permission) {
        results.push({
          success: false,
          message: `Permission '${permissionCode}' (code: ${code}, scope: ${scope}) not found`,
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
