import { User } from './user.entity';
import { Stage } from './stage.entity';
import { Process, ProcessStage } from './process.entity';
import { ProductionOrder } from './production-order.entity';
import { Material } from './material.entity';
import { Product } from './product.entity';
import { Unit } from './unit.entity';
import { Worker, StageWorker } from './worker.entity';
import { Norm } from './norm.entity';
import { ShiftReport, ShiftReportLine, Handover } from './shift-report.entity';
import { EntryTemplate } from './entry-template.entity';
import { StageWorkOrder } from './stage-work-order.entity';
import { SongProductNorm } from './song-product-norm.entity';
import { XaProductNorm } from './xa-product-norm.entity';
import { StageFormProductNorm } from './stage-form-product-norm.entity';

export const entities = [
  User,
  Stage,
  Process,
  ProcessStage,
  ProductionOrder,
  Material,
  Product,
  Unit,
  Worker,
  StageWorker,
  Norm,
  ShiftReport,
  ShiftReportLine,
  Handover,
  EntryTemplate,
  StageWorkOrder,
  SongProductNorm,
  XaProductNorm,
  StageFormProductNorm,
];

export {
  User,
  Stage,
  Process,
  ProcessStage,
  ProductionOrder,
  Material,
  Product,
  Unit,
  Worker,
  StageWorker,
  Norm,
  ShiftReport,
  ShiftReportLine,
  Handover,
  EntryTemplate,
  StageWorkOrder,
  SongProductNorm,
  XaProductNorm,
  StageFormProductNorm,
};
