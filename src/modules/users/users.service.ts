import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../infra/db/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthService } from '../../auth/auth.service';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
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

      // ⚠️ ATTENTION : Niveau plus BAS dans la DB = plus de pouvoir
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
    orgId: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<{ users: any[]; total: number; page: number; limit: number }> {
    const skip = (page - 1) * limit;
    const whereClause: any = { org_id: orgId };

    if (search) {
      whereClause.email = {
        contains: search,
        mode: 'insensitive',
      };
    }

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

      // ⚠️ ATTENTION : Niveau plus BAS dans la DB = plus de pouvoir
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
}
