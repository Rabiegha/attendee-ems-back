import { Module } from '@nestjs/common';
import { AttendeeTypesService } from './attendee-types.service';
import { AttendeeTypesController } from './attendee-types.controller';
import { PrismaService } from '../../infra/db/prisma.service';

@Module({
  controllers: [AttendeeTypesController],
  providers: [AttendeeTypesService, PrismaService],
  exports: [AttendeeTypesService],
})
export class AttendeeTypesModule {}
