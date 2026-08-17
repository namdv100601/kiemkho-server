import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Process, Stage, StageFormProductNorm } from '../../entities';
import { StageFormProductNormsController } from './stage-form-product-norms.controller';

@Module({
  imports: [TypeOrmModule.forFeature([StageFormProductNorm, Process, Stage])],
  controllers: [StageFormProductNormsController],
})
export class StageFormProductNormsModule {}
