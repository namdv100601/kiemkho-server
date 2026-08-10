import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Process, ProcessStage, Stage } from '../../entities';
import { ProcessesController } from './processes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Process, ProcessStage, Stage])],
  controllers: [ProcessesController],
})
export class ProcessesModule {}
