import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntryTemplate } from '../../entities';
import { TemplatesController } from './templates.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EntryTemplate])],
  controllers: [TemplatesController],
})
export class TemplatesModule {}
