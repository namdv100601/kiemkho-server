import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stage, StageWorker, Worker } from '../../entities';
import { WorkersController } from './workers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Worker, StageWorker, Stage])],
  controllers: [WorkersController],
})
export class WorkersModule {}
