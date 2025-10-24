import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { PrismaModule } from '../../infra/db/prisma.module';
import { CaslModule } from '../../rbac/casl.module';

@Module({
  imports: [PrismaModule, CaslModule],
  providers: [EventsService],
  controllers: [EventsController],
  exports: [EventsService],
})
export class EventsModule {}
