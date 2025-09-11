import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ConfigService } from '../../config/config.service';
import { createSequelizeConfig } from './sequelize.config';
import { Organization } from '../../modules/organizations/organizations.model';
import { User } from '../../modules/users/users.model';
import { Role } from '../../modules/roles/roles.model';
import { Permission } from '../../modules/permissions/permissions.model';
import { RolePermission } from '../../modules/role-permissions/role-permissions.model';

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        ...createSequelizeConfig(configService),
        models: [Organization, User, Role, Permission, RolePermission],
      }),
    }),
  ],
})
export class DatabaseModule {}
