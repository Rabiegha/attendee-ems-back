import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthService } from '../../auth/auth.service';
import { User, Prisma } from '@prisma/client';
import { UserScope } from '../../common/utils/resolve-user-scope.util';
import { AuthorizationService } from '../../authz/authorization.service';

interface UserQueryContext {
  scope: UserScope;
  orgId?: string;
  userId?: string;
  isActive?: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private authz: AuthorizationService, // ← Injecter
  ) {}

  async create(createUserDto: CreateUserDto, orgId: string, creatorRoleLevel?: number): Promise<User> {
    // Check if user already exists in this organization
    const existingUser = await this.prisma.user.findFirst({
      where: { 
        email: createUserDto.email, 
        org_id: orgId 
      },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists in organization');
    }

    // Vérification hiérarchique : empêcher la création de rôles supérieurs ou égaux
    // Règle : Un utilisateur peut créer uniquement des utilisateurs de niveau INFÉRIEUR OU ÉGAL au sien
    // Niveau plus bas = plus de pouvoir (SUPER_ADMIN = 0, ADMIN = 1, MANAGER = 2, etc.)
    if (creatorRoleLevel !== undefined) {
      const targetRole = await this.prisma.role.findUnique({
        where: { id: createUserDto.role_id },
        select: { level: true, code: true, name: true }
      });

      if (!targetRole) {
        throw new BadRequestException('Target role not found');
      }

      // ATTENTION : Niveau plus BAS dans la DB = plus de pouvoir
      // SUPER_ADMIN = 1, ADMIN = 2, MANAGER = 3, VIEWER = 4, PARTNER = 5, HOSTESS = 6
      // Un MANAGER (level 3) peut créer : VIEWER (4), PARTNER (5), HOSTESS (6)
      // Un MANAGER ne peut PAS créer : SUPER_ADMIN (1), ADMIN (2), ou autre MANAGER (3)
      if (targetRole.level <= creatorRoleLevel) {
        throw new BadRequestException(
          `You cannot create users with role '${targetRole.name}' (level ${targetRole.level}). ` +
          `Your role level is ${creatorRoleLevel}. You can only assign roles of level strictly higher (number) than ${creatorRoleLevel}.`
        );
      }
    }

    const hashedPassword = await this.authService.hashPassword(createUserDto.password);

    return this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password_hash: hashedPassword,
        role_id: createUserDto.role_id,
        first_name: createUserDto.first_name,
        last_name: createUserDto.last_name,
        phone: createUserDto.phone,
        company: createUserDto.company,
        job_title: createUserDto.job_title,
        country: createUserDto.country,
        metadata: createUserDto.metadata,
        is_active: createUserDto.is_active,
        org_id: orgId,
      },
    });
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    ctx?: UserQueryContext,
  ): Promise<{ users: any[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const whereClause: Prisma.UserWhereInput = {};

    // Appliquer le scope
    if (ctx) {
      if (ctx.scope === 'own') {
        // Scope 'own': uniquement son propre profil
        whereClause.id = ctx.userId!;
      } else if (ctx.scope === 'org') {
        // Scope 'org': tous les users de son org
        whereClause.org_id = ctx.orgId!;
      }
      // Scope 'any': pas de filtre (cross-tenant)

      // Filtrer par statut actif/inactif si spécifié
      if (ctx.isActive !== undefined) {
        whereClause.is_active = ctx.isActive;
        console.log('✅ Applying isActive filter:', ctx.isActive);
      } else {
        console.log('⚠️ No isActive filter applied');
      }
    }

    if (search) {
      whereClause.email = {
        contains: search,
        mode: 'insensitive',
      };
    }

    console.log('🔍 Final whereClause:', JSON.stringify(whereClause, null, 2));

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: whereClause,
        include: {
          role: true,
        },
        take: limit,
        skip,
        orderBy: {
          created_at: 'desc',
        },
      }),
      this.prisma.user.count({
        where: whereClause,
      }),
    ]);

    return { users, total, page, limit };
  }

  async findById(id: string, orgId: string): Promise<any> {
    return this.prisma.user.findFirst({
      where: { 
        id, 
        org_id: orgId 
      },
      include: {
        role: true,
        organization: true, // Inclure l'organisation
      },
    });
  }

  async findOne(id: string, orgId: string): Promise<any> {
    return this.findById(id, orgId);
  }

  async findByEmail(email: string, orgId: string): Promise<any> {
    return this.prisma.user.findFirst({
      where: { 
        email, 
        org_id: orgId 
      },
      include: {
        role: true,
      },
    });
  }

  async update(
    id: string, 
    updateData: Partial<CreateUserDto>, 
    orgId: string, 
    updaterUserId: string,
    updaterRoleLevel?: number
  ): Promise<User> {
    // Vérifier que l'utilisateur à modifier existe dans l'organisation
    const targetUser = await this.prisma.user.findFirst({
      where: { id, org_id: orgId },
      include: { role: true }
    });

    if (!targetUser) {
      throw new BadRequestException('User not found in organization');
    }

    // Empêcher un utilisateur de modifier son propre rôle
    if (targetUser.id === updaterUserId && updateData.role_id) {
      throw new BadRequestException('You cannot modify your own role');
    }

    // Vérification hiérarchique pour modification de rôle
    // Règle : Un utilisateur peut modifier uniquement les rôles STRICTEMENT INFÉRIEURS au sien
    if (updateData.role_id && updaterRoleLevel !== undefined) {
      const targetCurrentRole = targetUser.role;
      const newRole = await this.prisma.role.findUnique({
        where: { id: updateData.role_id },
        select: { level: true, code: true, name: true }
      });

      if (!newRole) {
        throw new BadRequestException('Target role not found');
      }

      // ATTENTION : Niveau plus BAS dans la DB = plus de pouvoir
      // SUPER_ADMIN = 1, ADMIN = 2, MANAGER = 3, VIEWER = 4, PARTNER = 5, HOSTESS = 6
      // Vérifier que l'utilisateur cible a un niveau INFÉRIEUR (level plus élevé numériquement)
      // Un MANAGER (level 3) peut modifier uniquement : VIEWER (4), PARTNER (5), HOSTESS (6)
      // Un MANAGER ne peut PAS modifier : SUPER_ADMIN (1), ADMIN (2), ou autre MANAGER (3)
      if (targetCurrentRole.level <= updaterRoleLevel) {
        throw new BadRequestException(
          `You cannot modify users with role '${targetCurrentRole.name}' (level ${targetCurrentRole.level}). ` +
          `Your role level is ${updaterRoleLevel}. You can only modify users with role level strictly higher (number) than ${updaterRoleLevel}.`
        );
      }

      // Vérifier que le nouveau rôle assigné est aussi de niveau INFÉRIEUR (level plus élevé numériquement)
      if (newRole.level <= updaterRoleLevel) {
        throw new BadRequestException(
          `You cannot assign role '${newRole.name}' (level ${newRole.level}). ` +
          `Your role level is ${updaterRoleLevel}. You can only assign roles of level strictly higher (number) than ${updaterRoleLevel}.`
        );
      }
    }

    // Préparer les données de mise à jour
    const dataToUpdate: any = {
      ...updateData,
    };

    // Si un nouveau mot de passe est fourni, le hasher
    if (updateData.password) {
      dataToUpdate.password_hash = await this.authService.hashPassword(updateData.password);
      delete dataToUpdate.password;
    }

    return this.prisma.user.update({
      where: { id },
      data: dataToUpdate,
      include: { role: true }
    });
  }

  async bulkDelete(ids: string[], orgId?: string): Promise<number> {
    const whereClause: Prisma.UserWhereInput = {
      id: { in: ids },
    };

    // Ajouter le filtre d'organisation si spécifié
    if (orgId) {
      whereClause.org_id = orgId;
    }

    const result = await this.prisma.user.deleteMany({
      where: whereClause,
    });

    return result.count;
  }

  async bulkExport(ids: string[], format: 'csv' | 'xlsx', orgId?: string): Promise<{
    buffer: Buffer;
    filename: string;
    mimeType: string;
  }> {
    const whereClause: Prisma.UserWhereInput = {
      id: { in: ids },
    };

    // Ajouter le filtre d'organisation si spécifié
    if (orgId) {
      whereClause.org_id = orgId;
    }

    const users = await this.prisma.user.findMany({
      where: whereClause,
      include: {
        role: true,
      },
      orderBy: { created_at: 'desc' },
    });

    if (format === 'csv') {
      const csvHeader = 'ID,Email,Prénom,Nom,Rôle,Statut,Date de création\n';
      const csvRows = users.map(user => 
        [
          user.id,
          user.email,
          user.first_name || '',
          user.last_name || '',
          user.role?.name || '',
          user.is_active ? 'Actif' : 'Inactif',
          user.created_at.toISOString().split('T')[0]
        ].map(field => `"${field}"`).join(',')
      ).join('\n');

      const csvContent = csvHeader + csvRows;
      const buffer = Buffer.from(csvContent, 'utf-8');

      return {
        buffer,
        filename: `attendees_export_${new Date().toISOString().split('T')[0]}.csv`,
        mimeType: 'text/csv',
      };
    }

    // TODO: Implémenter l'export Excel si nécessaire
    throw new BadRequestException('Format Excel non encore supporté');
  }

  async assignRole(
    managerId: string,
    targetUserId: string,
    roleId: string,
    orgId: string,
  ) {
    // 1. Vérifier permission RBAC
    await this.authz.assert('user.role.assign', {
      userId: managerId,
      currentOrgId: orgId,
      // ... autres champs AuthContext
    });

    // 2. Vérifier hiérarchie ⭐ NOUVEAU
    await this.authz.assertDecision(
      await this.authz.canManageUser(managerId, targetUserId, orgId)
    );

    await this.authz.assertDecision(
      await this.authz.canAssignRole(managerId, roleId, orgId)
    );

    // 3. Assigner le rôle
    return this.prisma.tenantUserRole.update({
      where: {
        user_id_org_id: { user_id: targetUserId, org_id: orgId },
      },
      data: { role_id: roleId },
    });
  }
}
