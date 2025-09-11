import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { User } from './users.model';
import { Role } from '../roles/roles.model';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthService } from '../../auth/auth.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private authService: AuthService,
  ) {}

  async create(createUserDto: CreateUserDto, orgId: string): Promise<User> {
    // Check if user already exists in this organization
    const existingUser = await this.userModel.findOne({
      where: { email: createUserDto.email, org_id: orgId },
    });

    if (existingUser) {
      throw new BadRequestException('User with this email already exists in organization');
    }

    const hashedPassword = await this.authService.hashPassword(createUserDto.password);

    return this.userModel.create({
      ...createUserDto,
      org_id: orgId,
      password_hash: hashedPassword,
    });
  }

  async findAll(
    orgId: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<{ users: User[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;
    const whereClause: any = { org_id: orgId };

    if (search) {
      whereClause.email = { [Op.iLike]: `%${search}%` };
    }

    const { rows: users, count: total } = await this.userModel.findAndCountAll({
      where: whereClause,
      include: [Role],
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });

    return { users, total, page, limit };
  }

  async findById(id: string, orgId: string): Promise<User> {
    return this.userModel.findOne({
      where: { id, org_id: orgId },
      include: [Role],
    });
  }

  async findByEmail(email: string, orgId: string): Promise<User> {
    return this.userModel.findOne({
      where: { email, org_id: orgId },
      include: [Role],
    });
  }
}
