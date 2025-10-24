import { Module } from '@nestjs/common';
import { PublicService } from './public.service';
import { PublicController } from './public.controller';
import { PrismaModule } from '../../infra/db/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [PublicService],
  controllers: [PublicController],
})
export class PublicModule {}
