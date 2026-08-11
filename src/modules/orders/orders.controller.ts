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
import { IsNull, Repository } from 'typeorm';
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
    @InjectRepository(Stage) private readonly stages: Repository<Stage>
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
  async list(
    @Query('parent_only') parentOnly?: string,
    @Query('supply_only') supplyOnly?: string,
    @Query('parent_id') parentId?: string,
    @Query('status') status?: string
  ) {
    const qb = this.orders
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.process', 'p')
      .leftJoinAndSelect('o.stage', 's')
      .orderBy('o.id', 'DESC');
    if (parentOnly === '1') qb.andWhere('o.parent_id IS NULL');
    if (supplyOnly === '1') qb.andWhere('o.parent_id IS NOT NULL');
    if (parentId != null && parentId !== '') {
      const parsedParentId = Number(parentId);
      if (!Number.isInteger(parsedParentId)) {
        throw new BadRequestException('Lệnh sản xuất không hợp lệ');
      }
      qb.andWhere('o.parent_id = :parentId', { parentId: parsedParentId });
    }
    if (status != null && status !== '') {
      if (!['active', 'inactive'].includes(status)) {
        throw new BadRequestException('Trạng thái không hợp lệ');
      }
      qb.andWhere('o.status = :status', { status });
    }
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
    }
  ) {
    const { code, process_id, product_name, quantity, entry_date } = body || {};
    if (!code || !process_id || !product_name || !entry_date) {
      throw new BadRequestException('Thiếu thông tin lệnh sản xuất');
    }
    try {
      const parent = await this.orders.save(
        this.orders.create({
          code: code.trim(),
          process_id,
          product_name: product_name.trim(),
          quantity: quantity ?? 0,
          entry_date,
          parent_id: null,
          stage_id: null,
          supply_type: null,
          supplier_name: null,
          status: 'active',
        })
      );
      return { ...(await this.getOrder(parent.id)), children: [] };
    } catch (e: unknown) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Post('supply')
  @Roles('quan_ly')
  async createSupply(
    @Body()
    body: {
      code?: string;
      parent_id?: number;
      stage_id?: number;
      product_name?: string;
      quantity?: number;
      entry_date?: string;
      supply_type?: 'nhap_lenh' | 'mua_ngoai';
      supplier_name?: string;
    }
  ) {
    const {
      code,
      parent_id,
      stage_id,
      product_name,
      quantity,
      entry_date,
      supply_type = 'nhap_lenh',
      supplier_name,
    } = body || {};
    if (!code || !parent_id || !stage_id || !product_name || !entry_date) {
      throw new BadRequestException('Thiếu thông tin lệnh cung cấp');
    }
    if (!['nhap_lenh', 'mua_ngoai'].includes(supply_type)) {
      throw new BadRequestException('Loại lệnh cung cấp không hợp lệ');
    }
    if (supply_type === 'mua_ngoai' && !supplier_name?.trim()) {
      throw new BadRequestException('Nhà cung cấp là bắt buộc khi mua ngoài');
    }

    const [parent, stage] = await Promise.all([
      this.orders.findOne({ where: { id: parent_id, parent_id: IsNull() } }),
      this.stages.findOne({ where: { id: stage_id } }),
    ]);
    if (!parent) throw new BadRequestException('Lệnh sản xuất không tồn tại');
    if (!stage || stage.type !== 'supply' || stage.active !== 1) {
      throw new BadRequestException('Khâu cung cấp không hợp lệ');
    }

    try {
      const row = await this.orders.save(
        this.orders.create({
          code: code.trim(),
          process_id: parent.process_id,
          product_name: product_name.trim(),
          quantity: quantity ?? 0,
          entry_date,
          parent_id: parent.id,
          stage_id: stage.id,
          supply_type,
          supplier_name: supply_type === 'mua_ngoai' ? supplier_name!.trim() : null,
          status: 'active',
        })
      );
      return this.getOrder(row.id);
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
      status?: 'active' | 'inactive';
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
    if (body.status != null) {
      if (!['active', 'inactive'].includes(body.status)) {
        throw new BadRequestException('Trạng thái không hợp lệ');
      }
      row.status = body.status;
    }
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
