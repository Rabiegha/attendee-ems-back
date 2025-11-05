import { Module } from '@nestjs/common';
import { BadgeGenerationService } from './badge-generation.service';
import { BadgeGenerationController } from './badge-generation.controller';
import { PrismaModule } from '../../infra/db/prisma.module';
import { StorageModule } from '../../infra/storage/storage.module';
import { BadgeTemplatesModule } from '../badge-templates/badge-templates.module';

@Module({
  imports: [PrismaModule, StorageModule, BadgeTemplatesModule],
  controllers: [BadgeGenerationController],
  providers: [BadgeGenerationService],
  exports: [BadgeGenerationService],
})
export class BadgeGenerationModule {}
