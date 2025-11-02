import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { Organization } from '@prisma/client';

// Définition des rôles par défaut (sauf SUPER_ADMIN qui reste global)
const DEFAULT_ROLES = [
  {
    code: 'ADMIN',
    name: 'Administrator',
    description: 'Full management of organization',
    level: 1,
    is_system_role: false,
  },
  {
    code: 'MANAGER',
    name: 'Manager',
    description: 'Event and attendee management',
    level: 2,
    is_system_role: false,
  },
  {
    code: 'PARTNER',
    name: 'Partner',
    description: 'Access to assigned events only',
    level: 3,
    is_system_role: false,
  },
  {
    code: 'VIEWER',
    name: 'Viewer',
    description: 'Read-only access',
    level: 4,
    is_system_role: false,
  },
  {
    code: 'HOSTESS',
    name: 'Hostess',
    description: 'Check-in for assigned events',
    level: 5,
    is_system_role: false,
  },
];

// Mapping des permissions par rôle
const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  ADMIN: [
    // Organizations
    'organizations.read:org',
    'organizations.update:org',
    
    // Users
    'users.read:org',
    'users.create:org',
    'users.update:org',
    'users.delete:org',
    
    // Roles
    'roles.read:org',
    'roles.create:org',
    'roles.update:org',
    'roles.delete:org',
    
    // Events
    'events.read:org',
    'events.create:org',
    'events.update:org',
    'events.delete:org',
    'events.publish:org',
    
    // Attendees
    'attendees.read:org',
    'attendees.create:org',
    'attendees.update:org',
    'attendees.delete:org',
    'attendees.export:org',
    'attendees.import:org',
    
    // Registrations
    'registrations.read:org',
    'registrations.create:org',
    'registrations.update:org',
    'registrations.delete:org',
    'registrations.checkin:org',
    
    // Badges
    'badges.read:org',
    'badges.create:org',
    'badges.update:org',
    'badges.delete:org',
    'badges.print:org',
  ],
  
  MANAGER: [
    // Organizations (lecture seule)
    'organizations.read:org',
    
    // Users (lecture seule)
    'users.read:org',
    
    // Events
    'events.read:org',
    'events.create:org',
    'events.update:org',
    'events.publish:org',
    
    // Attendees
    'attendees.read:org',
    'attendees.create:org',
    'attendees.update:org',
    'attendees.export:org',
    'attendees.import:org',
    
    // Registrations
    'registrations.read:org',
    'registrations.create:org',
    'registrations.update:org',
    'registrations.checkin:org',
    
    // Badges
    'badges.read:org',
    'badges.create:org',
    'badges.update:org',
    'badges.print:org',
  ],
  
  PARTNER: [
    // Events (lecture seule, assigned seulement)
    'events.read:assigned',
    
    // Attendees (assigned events)
    'attendees.read:assigned',
    'attendees.create:assigned',
    'attendees.update:assigned',
    
    // Registrations (assigned events)
    'registrations.read:assigned',
    'registrations.create:assigned',
    'registrations.update:assigned',
    'registrations.checkin:assigned',
    
    // Badges (assigned events)
    'badges.read:assigned',
    'badges.print:assigned',
  ],
  
  VIEWER: [
    // Events (lecture seule)
    'events.read:org',
    
    // Attendees (lecture seule)
    'attendees.read:org',
    
    // Registrations (lecture seule)
    'registrations.read:org',
    
    // Badges (lecture seule)
    'badges.read:org',
  ],
  
  HOSTESS: [
    // Events (lecture seule, assigned seulement)
    'events.read:assigned',
    
    // Attendees (lecture seule, assigned events)
    'attendees.read:assigned',
    
    // Registrations (check-in uniquement, assigned events)
    'registrations.read:assigned',
    'registrations.checkin:assigned',
    
    // Badges (lecture et impression, assigned events)
    'badges.read:assigned',
    'badges.print:assigned',
  ],
};

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Initialise les rôles et permissions par défaut pour une nouvelle organisation
   */
  private async initializeOrganizationRolesAndPermissions(orgId: string): Promise<void> {
    // 1. Créer les rôles par défaut
    const createdRoles: Record<string, string> = {}; // code -> roleId
    
    for (const roleData of DEFAULT_ROLES) {
      const role = await this.prisma.role.create({
        data: {
          code: roleData.code,
          name: roleData.name,
          description: roleData.description,
          level: roleData.level,
          is_system_role: roleData.is_system_role,
          org_id: orgId,
        },
      });
      
      createdRoles[roleData.code] = role.id;
    }
    
    // 2. Assigner les permissions à chaque rôle
    for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSIONS_MAP)) {
      const roleId = createdRoles[roleCode];
      if (!roleId) continue;
      
      for (const permissionCode of permissionCodes) {
        // Parser le code de permission (ex: "events.read:org")
        const [code, scope] = permissionCode.split(':');
        
        // Trouver la permission correspondante
        const permission = await this.prisma.permission.findFirst({
          where: {
            code: code,
            scope: (scope || 'org') as 'any' | 'org' | 'assigned' | 'own' | 'none',
          },
        });
        
        if (permission) {
          // Créer le lien role-permission
          await this.prisma.rolePermission.create({
            data: {
              role_id: roleId,
              permission_id: permission.id,
            },
          });
        }
      }
    }
  }

  async create(createOrganizationDto: CreateOrganizationDto): Promise<Organization> {
    try {
      // Créer l'organisation
      const organization = await this.prisma.organization.create({
        data: createOrganizationDto,
      });
      
      // Initialiser les rôles et permissions
      await this.initializeOrganizationRolesAndPermissions(organization.id);
      
      return organization;
    } catch (error) {
      // Gestion spécifique des erreurs de contrainte unique
      if (error.code === 'P2002' && error.meta?.target?.includes('slug')) {
        throw new ConflictException(
          `Une organisation avec le nom "${createOrganizationDto.name}" existe déjà. Veuillez choisir un nom différent.`
        );
      }
      // Re-lancer l'erreur si ce n'est pas une erreur de slug dupliqué
      throw error;
    }
  }

  async findById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({
      where: { id },
    });
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({
      where: { slug },
    });
  }

  async findAll(): Promise<Organization[]> {
    return this.prisma.organization.findMany();
  }

  async getOrganizationUsers(orgId: string) {
    const users = await this.prisma.user.findMany({
      where: { org_id: orgId },
      include: {
        role: true,
      },
    });
    
    return { users };
  }
}
