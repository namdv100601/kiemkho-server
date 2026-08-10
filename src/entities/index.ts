import { User } from './user.entity';
import { Stage } from './stage.entity';
import { Process, ProcessStage } from './process.entity';
import { ProductionOrder } from './production-order.entity';
import { Material } from './material.entity';
import { Worker, StageWorker } from './worker.entity';
import { Norm } from './norm.entity';
import { ShiftReport, ShiftReportLine, Handover } from './shift-report.entity';
import { EntryTemplate } from './entry-template.entity';

export const entities = [
  User,
  Stage,
  Process,
  ProcessStage,
  ProductionOrder,
  Material,
  Worker,
  StageWorker,
  Norm,
  ShiftReport,
  ShiftReportLine,
  Handover,
  EntryTemplate,
];

export {
  User,
  Stage,
  Process,
  ProcessStage,
  ProductionOrder,
  Material,
  Worker,
  StageWorker,
  Norm,
  ShiftReport,
  ShiftReportLine,
  Handover,
  EntryTemplate,
};
