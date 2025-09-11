import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { Permission } from './permissions.model';
import { RbacModule } from '../../rbac/rbac.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Permission]),
    RbacModule,
  ],
  controllers: [PermissionsController],
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
