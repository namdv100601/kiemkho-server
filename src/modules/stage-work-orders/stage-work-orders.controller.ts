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
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { normalizeStagePayload } from '../../common/stage-order-payloads';
import { Stage } from '../../entities';
import { StageWorkOrder } from '../../entities/stage-work-order.entity';
import {
  exportFileName,
  exportStageOrderDocx,
  sampleStageOrder,
} from '../../utils/exportStageOrder';
import { exportSongOrderXlsx, songExcelFileName } from '../../utils/exportSongOrderExcel';
import { exportXaOrderXlsx, xaExcelFileName } from '../../utils/exportXaOrderExcel';

const STAGE_CODES = ['xa', 'song', 'in', 'kcs', 'boi', 'be'] as const;
type StageCode = (typeof STAGE_CODES)[number];

const DEFAULTS = {
  nguoi_lap: '',
  giam_doc: 'Nguyễn Khánh Vi',
};

const TEMPLATES_DIR = join(process.cwd(), 'templates', 'stage-orders');

type ManifestStage = {
  code: string;
  name: string;
  title: string;
  file: string;
  template?: string;
  source: string;
  excel_file?: string;
  excel_source?: string;
  formats?: ('word' | 'excel')[];
};

@ApiTags('stage-work-orders')
@ApiBearerAuth('JWT')
@Controller('api/stage-work-orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StageWorkOrdersController {
  constructor(
    @InjectRepository(StageWorkOrder)
    private readonly orders: Repository<StageWorkOrder>,
    @InjectRepository(Stage)
    private readonly stageRepo: Repository<Stage>
  ) {}

  private assertStage(code?: string): StageCode {
    if (!code || !STAGE_CODES.includes(code as StageCode)) {
      throw new BadRequestException('Mã khâu không hợp lệ');
    }
    return code as StageCode;
  }

  private normalize(body: Partial<StageWorkOrder>, stageCode: StageCode) {
    const so_lenh = body.so_lenh?.trim();
    const ten_san_pham = body.ten_san_pham?.trim();
    const ngay_dua_lenh = body.ngay_dua_lenh?.trim();
    if (!so_lenh || !ten_san_pham || !ngay_dua_lenh) {
      throw new BadRequestException('Thiếu số lệnh / lệnh SX, tên sản phẩm hoặc ngày lệnh');
    }
    const payload =
      stageCode === 'xa'
        ? body.payload && typeof body.payload === 'object'
          ? body.payload
          : null
        : normalizeStagePayload(stageCode, body.payload);
    return {
      stage_code: stageCode,
      ten_san_pham,
      kich_thuoc_xa: body.kich_thuoc_xa?.trim() || null,
      dinh_luong_xuat: body.dinh_luong_xuat?.trim() || null,
      khoi_luong: body.khoi_luong?.trim() || null,
      so_lenh,
      ngay_dua_lenh,
      ngay_hoan_thanh: body.ngay_hoan_thanh?.trim() || null,
      ghi_chu: body.ghi_chu?.trim() || null,
      nguoi_lap: body.nguoi_lap?.trim() || DEFAULTS.nguoi_lap || null,
      giam_doc: body.giam_doc?.trim() || DEFAULTS.giam_doc,
      payload,
    };
  }

  private readManifest(): { stages: ManifestStage[] } {
    const manifestPath = join(TEMPLATES_DIR, 'manifest.json');
    return JSON.parse(readFileSync(manifestPath, 'utf8'));
  }

  private findManifestStage(code: string): ManifestStage {
    const stageCode = this.assertStage(code);
    const item = this.readManifest().stages.find((s) => s.code === stageCode);
    if (!item) throw new NotFoundException('Không tìm thấy biểu mẫu');
    return item;
  }

  @Get('templates')
  async templates() {
    const manifest = this.readManifest();
    const linkedStages = await this.stageRepo.find({ order: { sort_order: 'ASC' } });
    const stages = await Promise.all(
      manifest.stages.map(async (stage) => {
        const recent = await this.orders.find({
          where: { stage_code: stage.code },
          order: { id: 'DESC' },
          take: 10,
          select: ['id', 'so_lenh', 'ten_san_pham', 'ngay_dua_lenh'],
        });
        const order_count = await this.orders.count({ where: { stage_code: stage.code } });
        const linked = linkedStages.filter((s) => s.form_code === stage.code);
        const formats = stage.formats?.length
          ? stage.formats
          : stage.excel_file
            ? (['word', 'excel'] as const)
            : (['word'] as const);
        return {
          ...stage,
          formats: [...formats],
          has_excel: Boolean(stage.excel_file),
          order_count,
          fillable: true,
          recent_orders: recent,
          linked_stages: linked.map((s) => ({ id: s.id, name: s.name, type: s.type })),
        };
      })
    );
    return { stages };
  }

  @Get('templates/:code/file')
  async templateFile(@Param('code') code: string, @Res({ passthrough: true }) res: Response) {
    const stage = this.findManifestStage(code);
    const path = join(TEMPLATES_DIR, stage.file);
    if (!existsSync(path)) throw new NotFoundException('File biểu mẫu không tồn tại');
    const buf = readFileSync(path);
    res.setHeader('Content-Type', 'application/msword');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${stage.file.replace(/[^\w.-]+/g, '_')}"`
    );
    return new StreamableFile(buf);
  }

  @Get('templates/:code/excel-file')
  async templateExcelFile(@Param('code') code: string, @Res({ passthrough: true }) res: Response) {
    const stage = this.findManifestStage(code);
    if (!stage.excel_file) throw new NotFoundException('Khâu này chưa có mẫu Excel');
    const path = join(TEMPLATES_DIR, stage.excel_file);
    if (!existsSync(path)) throw new NotFoundException('File Excel biểu mẫu không tồn tại');
    const buf = readFileSync(path);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${stage.excel_file.replace(/[^\w.-]+/g, '_')}"`
    );
    return new StreamableFile(buf);
  }

  @Get('templates/:code/preview')
  async templatePreview(@Param('code') code: string, @Res({ passthrough: true }) res: Response) {
    const stage = this.findManifestStage(code);
    const sample = sampleStageOrder(stage.code);
    const buf = await exportStageOrderDocx(sample);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Xem-truoc-${exportFileName(sample)}"`
    );
    return new StreamableFile(Buffer.from(buf));
  }

  @Get('templates/:code/preview-excel')
  async templatePreviewExcel(
    @Param('code') code: string,
    @Res({ passthrough: true }) res: Response
  ) {
    const stage = this.findManifestStage(code);
    if (!stage.excel_file) throw new NotFoundException('Khâu này chưa có mẫu Excel');
    if (stage.code !== 'song' && stage.code !== 'xa') {
      throw new BadRequestException('Chưa hỗ trợ xem trước Excel cho khâu này');
    }
    const sample = sampleStageOrder(stage.code);
    const buf =
      stage.code === 'xa' ? await exportXaOrderXlsx(sample) : await exportSongOrderXlsx(sample);
    const filename =
      stage.code === 'xa' ? xaExcelFileName(sample) : songExcelFileName(sample);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Xem-truoc-${filename}"`
    );
    return new StreamableFile(buf);
  }

  @Get()
  async list(@Query('stage') stage?: string) {
    const stageCode = this.assertStage(stage || 'xa');
    return this.orders.find({
      where: { stage_code: stageCode },
      order: { id: 'DESC' },
    });
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const row = await this.orders.findOne({ where: { id: Number(id) } });
    if (!row) throw new NotFoundException('Không tìm thấy lệnh');
    return row;
  }

  @Post()
  @Roles('quan_ly')
  async create(@Body() body: Partial<StageWorkOrder> & { stage_code?: string }) {
    const stageCode = this.assertStage(body.stage_code || 'xa');
    const data = this.normalize(body, stageCode);
    const exists = await this.orders.findOne({
      where: { stage_code: stageCode, so_lenh: data.so_lenh },
    });
    if (exists) throw new BadRequestException('Số lệnh đã tồn tại trong khâu này');
    return this.orders.save(this.orders.create(data));
  }

  @Put(':id')
  @Roles('quan_ly')
  async update(@Param('id') id: string, @Body() body: Partial<StageWorkOrder>) {
    const row = await this.orders.findOne({ where: { id: Number(id) } });
    if (!row) throw new NotFoundException('Không tìm thấy lệnh');
    const data = this.normalize({ ...row, ...body }, row.stage_code as StageCode);
    const other = await this.orders.findOne({
      where: { stage_code: row.stage_code, so_lenh: data.so_lenh },
    });
    if (other && other.id !== row.id) {
      throw new BadRequestException('Số lệnh đã tồn tại trong khâu này');
    }
    Object.assign(row, data);
    return this.orders.save(row);
  }

  @Delete(':id')
  @Roles('quan_ly')
  async remove(@Param('id') id: string) {
    await this.orders.delete(Number(id));
    return { ok: true };
  }

  @Get(':id/export')
  async export(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const row = await this.orders.findOne({ where: { id: Number(id) } });
    if (!row) throw new NotFoundException('Không tìm thấy lệnh');
    const buf = await exportStageOrderDocx(row);
    const filename = exportFileName(row);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(Buffer.from(buf));
  }

  @Get(':id/export-excel')
  async exportExcel(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const row = await this.orders.findOne({ where: { id: Number(id) } });
    if (!row) throw new NotFoundException('Không tìm thấy lệnh');
    if (row.stage_code === 'song') {
      const buf = await exportSongOrderXlsx(row);
      const filename = songExcelFileName(row);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return new StreamableFile(buf);
    }
    if (row.stage_code === 'xa') {
      const buf = await exportXaOrderXlsx(row);
      const filename = xaExcelFileName(row);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return new StreamableFile(buf);
    }
    throw new BadRequestException('Chưa hỗ trợ xuất Excel cho khâu này');
  }
}
