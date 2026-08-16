import {
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
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthUser } from '../../common/auth/auth.types';
import { ReportsService, type ReportLineInput } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth('JWT')
@Controller('api/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  list(
    @Query('stage_id') stage_id?: string,
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.reports.list({ stage_id, date, from, to });
  }

  @Get('monthly')
  @Roles('quan_ly', 'giam_doc', 'thong_ke')
  monthly(
    @Query('stage_id') stage_id?: string,
    @Query('month') month?: string,
    @Query('date') date?: string,
    @Query('shift') shift?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('product') product?: string,
    @Query('material') material?: string
  ) {
    return this.reports.monthly({ stage_id, month, date, shift, from, to, product, material });
  }

  private sendExcel(res: Response | undefined, buf: Buffer, filename: string) {
    res?.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return new StreamableFile(Buffer.from(buf));
  }

  @Get('export/monthly')
  @Roles('quan_ly', 'giam_doc', 'thong_ke')
  async exportMonthly(
    @Query('stage_id') stage_id?: string,
    @Query('month') month?: string,
    @Query('date') date?: string,
    @Query('shift') shift?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('product') product?: string,
    @Query('material') material?: string,
    @Res({ passthrough: true }) res?: Response
  ) {
    const { buf, filename } = await this.reports.exportMonthly({
      stage_id,
      month,
      date,
      shift,
      from,
      to,
      product,
      material,
    });
    return this.sendExcel(res, buf, filename);
  }

  /** Alias tương thích client/proxy cũ */
  @Get('export/monthly.xlsx')
  @Roles('quan_ly', 'giam_doc', 'thong_ke')
  async exportMonthlyXlsx(
    @Query('stage_id') stage_id?: string,
    @Query('month') month?: string,
    @Query('date') date?: string,
    @Query('shift') shift?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('product') product?: string,
    @Query('material') material?: string,
    @Res({ passthrough: true }) res?: Response
  ) {
    return this.exportMonthly(stage_id, month, date, shift, from, to, product, material, res);
  }

  @Get('export/daily')
  @Roles('quan_ly', 'giam_doc', 'thong_ke')
  async exportDaily(
    @Query('month') month?: string,
    @Query('stage_id') stage_id?: string,
    @Query('date') date?: string,
    @Res({ passthrough: true }) res?: Response
  ) {
    const { buf, filename } = await this.reports.exportDaily({ month, stage_id, date });
    return this.sendExcel(res, buf, filename);
  }

  /** Alias tương thích client/proxy cũ */
  @Get('export/daily.xlsx')
  @Roles('quan_ly', 'giam_doc', 'thong_ke')
  async exportDailyXlsx(
    @Query('month') month?: string,
    @Query('stage_id') stage_id?: string,
    @Query('date') date?: string,
    @Res({ passthrough: true }) res?: Response
  ) {
    return this.exportDaily(month, stage_id, date, res);
  }

  @Get('template/entry')
  async entryTemplate(@Res({ passthrough: true }) res: Response) {
    const buf = this.reports.entryTemplateBuffer();
    return this.sendExcel(res, buf, 'mau-nhap-lieu.xlsx');
  }

  @Get('template/entry.xlsx')
  async entryTemplateXlsx(@Res({ passthrough: true }) res: Response) {
    return this.entryTemplate(res);
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const row = await this.reports.getReportDetail(Number(id));
    if (!row) throw new NotFoundException('Không tìm thấy');
    return row;
  }

  @Post()
  @Roles('cong_nhan', 'quan_ly')
  create(
    @Body()
    body: {
      stage_id?: number;
      shift?: string;
      report_date?: string;
      checklist_thiet_bi?: boolean;
      checklist_ve_sinh?: boolean;
      checklist_pccc?: boolean;
      note?: string;
      lines?: ReportLineInput[];
      handovers?: { handover_type: string; loai?: string; order_code?: string; quantity?: number }[];
    },
    @CurrentUser() user: AuthUser
  ) {
    return this.reports.create(body, user.id);
  }

  @Put(':id')
  @Roles('cong_nhan', 'quan_ly')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      stage_id?: number;
      shift?: string;
      report_date?: string;
      checklist_thiet_bi?: boolean;
      checklist_ve_sinh?: boolean;
      checklist_pccc?: boolean;
      note?: string;
      lines?: ReportLineInput[];
      handovers?: { handover_type: string; loai?: string; order_code?: string; quantity?: number }[];
    }
  ) {
    return this.reports.update(Number(id), body);
  }

  @Delete(':id')
  @Roles('quan_ly')
  remove(@Param('id') id: string) {
    return this.reports.remove(Number(id));
  }

  @Post('import/excel')
  @Roles('cong_nhan', 'quan_ly')
  importExcel(@Body() body: { base64?: string }) {
    return this.reports.importExcel(body?.base64);
  }
}
