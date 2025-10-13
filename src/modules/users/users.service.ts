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

  async create(createUserDto: CreateUserDto, orgId: string): Promise<User> {
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
}
