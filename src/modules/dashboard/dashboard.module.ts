import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Process, ProductionOrder, ShiftReport, Stage } from '../../entities';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Stage, Process, ProductionOrder, ShiftReport])],
  controllers: [DashboardController],
})
export class DashboardModule {}
