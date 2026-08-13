import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stage } from '../../entities';
import { StageWorkOrder } from '../../entities/stage-work-order.entity';
import { StageWorkOrdersController } from './stage-work-orders.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StageWorkOrder, Stage])],
  controllers: [StageWorkOrdersController],
})
export class StageWorkOrdersModule {}
