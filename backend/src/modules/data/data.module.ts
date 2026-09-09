import { Module } from '@nestjs/common';
import { DataController } from './data.controller.js';
import { DataService } from './data.service.js';

@Module({
  controllers: [DataController],
  providers: [DataService],
})
export class DataModule {}
