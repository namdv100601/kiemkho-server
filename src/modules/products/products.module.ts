import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../../entities';
import { ProductsController } from './products.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  controllers: [ProductsController],
})
export class ProductsModule {}
