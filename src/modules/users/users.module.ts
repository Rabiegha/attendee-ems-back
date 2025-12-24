import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../../auth/auth.module';
import { RbacModule } from '../../authorization/rbac.module';

@Module({
  imports: [
    AuthModule,
    RbacModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
