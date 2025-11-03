import { Module, forwardRef } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { PrismaModule } from '../../infra/db/prisma.module';
import { CaslModule } from '../../rbac/casl.module';
import { RegistrationsService } from '../registrations/registrations.service';
import { TagsModule } from '../tags/tags.module';
import { BadgeGenerationModule } from '../badge-generation/badge-generation.module';

@Module({
  imports: [PrismaModule, CaslModule, forwardRef(() => TagsModule), BadgeGenerationModule],
  providers: [EventsService, RegistrationsService],
  controllers: [EventsController],
  exports: [EventsService],
})
export class EventsModule {}
