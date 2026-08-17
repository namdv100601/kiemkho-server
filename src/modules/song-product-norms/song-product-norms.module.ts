import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Process, SongProductNorm, Stage } from '../../entities';
import { SongProductNormsController } from './song-product-norms.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SongProductNorm, Process, Stage])],
  controllers: [SongProductNormsController],
})
export class SongProductNormsModule {}
