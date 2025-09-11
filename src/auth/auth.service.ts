import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import * as bcrypt from 'bcrypt';
import { User } from '../modules/users/users.model';
import { Role } from '../modules/roles/roles.model';
import { Permission } from '../modules/permissions/permissions.model';
import { RolePermission } from '../modules/role-permissions/role-permissions.model';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userModel.findOne({
      where: { email, is_active: true },
      include: [
        {
          model: Role,
          include: [
            {
              model: RolePermission,
              include: [Permission],
            },
          ],
        },
      ],
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async validateUserById(userId: string): Promise<any> {
    const user = await this.userModel.findOne({
      where: { id: userId, is_active: true },
      include: [
        {
          model: Role,
          include: [
            {
              model: RolePermission,
              include: [Permission],
            },
          ],
        },
      ],
    });

    return user;
  }

  async login(user: any) {
    const permissions = user.role?.rolePermissions?.map(
      (rp: any) => rp.permission.code,
    ) || [];

    const payload = {
      sub: user.id,
      org_id: user.org_id,
      role: user.role?.code,
      permissions,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }
}
