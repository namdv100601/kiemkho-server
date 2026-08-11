import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  EntryTemplate,
  Handover,
  Material,
  Process,
  ProcessStage,
  Product,
  ProductionOrder,
  ShiftReport,
  ShiftReportLine,
  Stage,
  StageWorker,
  User,
  Worker,
} from '../entities';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Stage,
      Process,
      ProcessStage,
      Worker,
      StageWorker,
      Material,
      Product,
      ProductionOrder,
      EntryTemplate,
      ShiftReport,
      ShiftReportLine,
      Handover,
    ]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
