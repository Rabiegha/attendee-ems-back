import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { PrismaModule } from '../../infra/db/prisma.module';
import { CaslModule } from '../../rbac/casl.module';
import { RegistrationsService } from '../registrations/registrations.service';

@Module({
  imports: [PrismaModule, CaslModule],
  providers: [EventsService, RegistrationsService],
  controllers: [EventsController],
  exports: [EventsService],
})
export class EventsModule {}
