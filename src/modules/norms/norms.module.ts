import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Norm } from '../../entities';
import { NormsController } from './norms.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Norm])],
  controllers: [NormsController],
})
export class NormsModule {}
