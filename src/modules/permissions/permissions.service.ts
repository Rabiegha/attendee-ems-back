import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Permission } from './permissions.model';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectModel(Permission)
    private permissionModel: typeof Permission,
  ) {}

  async findAll(orgId: string): Promise<Permission[]> {
    return this.permissionModel.findAll({
      where: { org_id: orgId },
    });
  }

  async findById(id: string, orgId: string): Promise<Permission> {
    return this.permissionModel.findOne({
      where: { id, org_id: orgId },
    });
  }

  async findByCode(code: string, orgId: string): Promise<Permission> {
    return this.permissionModel.findOne({
      where: { code, org_id: orgId },
    });
  }
}
