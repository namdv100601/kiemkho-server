import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionOrder, Stage } from '../../entities';
import { OrdersController } from './orders.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProductionOrder, Stage])],
  controllers: [OrdersController],
})
export class OrdersModule {}
