import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Process, Stage, XaProductNorm } from '../../entities';
import { XaProductNormsController } from './xa-product-norms.controller';

@Module({
  imports: [TypeOrmModule.forFeature([XaProductNorm, Process, Stage])],
  controllers: [XaProductNormsController],
})
export class XaProductNormsModule {}
