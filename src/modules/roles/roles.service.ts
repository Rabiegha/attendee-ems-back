import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Role } from './roles.model';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role)
    private roleModel: typeof Role,
  ) {}

  async findAll(orgId: string): Promise<Role[]> {
    return this.roleModel.findAll({
      where: { org_id: orgId },
    });
  }

  async findById(id: string, orgId: string): Promise<Role> {
    return this.roleModel.findOne({
      where: { id, org_id: orgId },
    });
  }

  async findByCode(code: string, orgId: string): Promise<Role> {
    return this.roleModel.findOne({
      where: { code, org_id: orgId },
    });
  }
}
