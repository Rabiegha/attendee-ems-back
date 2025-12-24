import { Module } from '@nestjs/common';
import { AttendeesController } from './attendees.controller';
import { AttendeesService } from './attendees.service';
import { PrismaModule } from '../../infra/db/prisma.module';
import { RbacModule } from '../../authorization/rbac.module';

@Module({
  imports: [PrismaModule, RbacModule],
  controllers: [AttendeesController],
  providers: [AttendeesService],
  exports: [AttendeesService],
})
export class AttendeesModule {}
