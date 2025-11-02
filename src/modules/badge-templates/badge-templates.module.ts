import { Module } from '@nestjs/common';
import { BadgeTemplatesService } from './badge-templates.service';
import { BadgeTemplatesController } from './badge-templates.controller';
import { PrismaModule } from '../../infra/db/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BadgeTemplatesController],
  providers: [BadgeTemplatesService],
  exports: [BadgeTemplatesService],
})
export class BadgeTemplatesModule {}
