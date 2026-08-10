import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Handover,
  Norm,
  ProductionOrder,
  ShiftReport,
  ShiftReportLine,
  Stage,
  Worker,
} from '../../entities';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShiftReport,
      ShiftReportLine,
      Handover,
      Stage,
      Norm,
      ProductionOrder,
      Worker,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
