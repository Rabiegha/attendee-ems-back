import { Module } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { RegistrationsController } from './registrations.controller';
import { PrismaModule } from '../../infra/db/prisma.module';
import { CaslModule } from '../../authorization/casl.module';
import { BadgeGenerationModule } from '../badge-generation/badge-generation.module';

@Module({
  imports: [PrismaModule, CaslModule, BadgeGenerationModule],
  providers: [RegistrationsService],
  controllers: [RegistrationsController],
  exports: [RegistrationsService],
})
export class RegistrationsModule {}
