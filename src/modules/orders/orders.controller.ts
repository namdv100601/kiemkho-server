import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { ProductionOrder, Stage } from '../../entities';

@ApiTags('orders')
@ApiBearerAuth('JWT')
@Controller('api/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(
    @InjectRepository(ProductionOrder) private readonly orders: Repository<ProductionOrder>,
    @InjectRepository(Stage) private readonly stages: Repository<Stage>,
    private readonly dataSource: DataSource
  ) {}

  private async getOrder(id: number) {
    const row = await this.orders
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.process', 'p')
      .leftJoinAndSelect('o.stage', 's')
      .where('o.id = :id', { id })
      .getOne();
    if (!row) return null;
    const { process, stage, ...rest } = row;
    return {
      ...rest,
      process_name: process?.name,
      stage_name: stage?.name ?? null,
    };
  }

  @Get()
  async list(@Query('parent_only') parentOnly?: string) {
    const qb = this.orders
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.process', 'p')
      .leftJoinAndSelect('o.stage', 's')
      .orderBy('o.id', 'DESC');
    if (parentOnly === '1') qb.andWhere('o.parent_id IS NULL');
    const rows = await qb.getMany();
    return rows.map((o) => {
      const { process, stage, ...rest } = o;
      return {
        ...rest,
        process_name: process?.name,
        stage_name: stage?.name ?? null,
      };
    });
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const row = await this.getOrder(Number(id));
    if (!row) throw new NotFoundException('Không tìm thấy');
    const children = await this.orders
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.stage', 's')
      .where('o.parent_id = :id', { id: Number(id) })
      .getMany();
    return {
      ...row,
      children: children.map((c) => {
        const { stage, ...rest } = c;
        return { ...rest, stage_name: stage?.name ?? null };
      }),
    };
  }

  @Post()
  @Roles('quan_ly')
  async create(
    @Body()
    body: {
      code?: string;
      process_id?: number;
      product_name?: string;
      quantity?: number;
      entry_date?: string;
      create_supply_orders?: boolean;
    }
  ) {
    const { code, process_id, product_name, quantity, entry_date, create_supply_orders } =
      body || {};
    if (!code || !process_id || !product_name || !entry_date) {
      throw new BadRequestException('Thiếu thông tin lệnh sản xuất');
    }
    try {
      const id = await this.dataSource.transaction(async (manager) => {
        const parent = await manager.save(
          manager.create(ProductionOrder, {
            code,
            process_id,
            product_name,
            quantity: quantity ?? 0,
            entry_date,
            parent_id: null,
            stage_id: null,
            status: 'active',
          })
        );
        if (create_supply_orders) {
          const supplies = await manager.find(Stage, {
            where: { type: 'supply', active: 1 },
          });
          for (const s of supplies) {
            await manager.save(
              manager.create(ProductionOrder, {
                code: `${code}-${s.name}`,
                process_id,
                product_name,
                quantity: quantity ?? 0,
                entry_date,
                parent_id: parent.id,
                stage_id: s.id,
                status: 'active',
              })
            );
          }
        }
        return parent.id;
      });
      const children = await this.orders.find({ where: { parent_id: id } });
      return { ...(await this.getOrder(id)), children };
    } catch (e: unknown) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Put(':id')
  @Roles('quan_ly')
  async update(
    @Param('id') idParam: string,
    @Body()
    body: {
      code?: string;
      process_id?: number;
      product_name?: string;
      quantity?: number;
      entry_date?: string;
      status?: string;
    }
  ) {
    const id = Number(idParam);
    const row = await this.orders.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Không tìm thấy');
    if (body.code != null) row.code = body.code;
    if (body.process_id != null) row.process_id = body.process_id;
    if (body.product_name != null) row.product_name = body.product_name;
    if (body.quantity != null) row.quantity = body.quantity;
    if (body.entry_date != null) row.entry_date = body.entry_date;
    if (body.status != null) row.status = body.status;
    await this.orders.save(row);
    return this.getOrder(id);
  }

  @Delete(':id')
  @Roles('quan_ly')
  async remove(@Param('id') id: string) {
    await this.orders.delete(Number(id));
    return { ok: true };
  }
}
