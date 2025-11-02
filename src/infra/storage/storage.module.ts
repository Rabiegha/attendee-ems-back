import { Module } from '@nestjs/common';
import { R2Service } from './r2.service';
import { StorageController } from './storage.controller';

@Module({
  controllers: [StorageController],
  providers: [R2Service],
  exports: [R2Service],
})
export class StorageModule {}
