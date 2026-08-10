import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Stage } from './stage.entity';
import { User } from './user.entity';
import { ProductionOrder } from './production-order.entity';
import { Material } from './material.entity';

@Entity('shift_reports')
export class ShiftReport {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'stage_id', type: 'int' })
  stage_id!: number;

  @Column({ type: 'varchar' })
  shift!: 'C1' | 'C2';

  @Column({ name: 'report_date', type: 'varchar' })
  report_date!: string;

  @Column({ name: 'checklist_thiet_bi', type: 'int', default: 0 })
  checklist_thiet_bi!: number;

  @Column({ name: 'checklist_ve_sinh', type: 'int', default: 0 })
  checklist_ve_sinh!: number;

  @Column({ name: 'checklist_pccc', type: 'int', default: 0 })
  checklist_pccc!: number;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  created_by!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at!: Date;

  @ManyToOne(() => Stage)
  @JoinColumn({ name: 'stage_id' })
  stage!: Stage;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator!: User | null;

  @OneToMany(() => ShiftReportLine, (l) => l.report)
  lines!: ShiftReportLine[];

  @OneToMany(() => Handover, (h) => h.report)
  handovers!: Handover[];
}

@Entity('shift_report_lines')
export class ShiftReportLine {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'report_id', type: 'int' })
  report_id!: number;

  @Column({ name: 'line_type', type: 'varchar' })
  line_type!: 'lenh' | 'nvl';

  @Column({ name: 'order_id', type: 'int', nullable: true })
  order_id!: number | null;

  @Column({ name: 'order2_id', type: 'int', nullable: true })
  order2_id!: number | null;

  @Column({ name: 'order_code_text', type: 'varchar', nullable: true })
  order_code_text!: string | null;

  @Column({ name: 'order2_code_text', type: 'varchar', nullable: true })
  order2_code_text!: string | null;

  @Column({ name: 'material_id', type: 'int', nullable: true })
  material_id!: number | null;

  @Column({ name: 'material_name', type: 'varchar', nullable: true })
  material_name!: string | null;

  @Column({ name: 'product_name', type: 'varchar', nullable: true })
  product_name!: string | null;

  @Column({ name: 'entry_date', type: 'varchar', nullable: true })
  entry_date!: string | null;

  @Column({ name: 'ton_dau', type: 'float', default: 0 })
  ton_dau!: number;

  @Column({ type: 'float', default: 0 })
  nhap!: number;

  @Column({ name: 'ton_cuoi', type: 'float', default: 0 })
  ton_cuoi!: number;

  @Column({ type: 'float', default: 0 })
  dat!: number;

  @Column({ name: 'hong_sx', type: 'float', default: 0 })
  hong_sx!: number;

  @Column({ name: 'hong_khac', type: 'float', default: 0 })
  hong_khac!: number;

  @Column({ name: 'workers_json', type: 'jsonb', default: [] })
  workers_json!: { id: number; full_name: string }[];

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order!: number;

  @ManyToOne(() => ShiftReport, (r) => r.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report!: ShiftReport;

  @ManyToOne(() => ProductionOrder, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order!: ProductionOrder | null;

  @ManyToOne(() => ProductionOrder, { nullable: true })
  @JoinColumn({ name: 'order2_id' })
  order2!: ProductionOrder | null;

  @ManyToOne(() => Material, { nullable: true })
  @JoinColumn({ name: 'material_id' })
  material!: Material | null;
}

@Entity('handovers')
export class Handover {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'report_id', type: 'int' })
  report_id!: number;

  @Column({ name: 'handover_type', type: 'varchar' })
  handover_type!: 'next_stage' | 'next_shift';

  @Column({ type: 'varchar', nullable: true })
  loai!: string | null;

  @Column({ name: 'order_code', type: 'varchar', nullable: true })
  order_code!: string | null;

  @Column({ type: 'float', default: 0 })
  quantity!: number;

  @ManyToOne(() => ShiftReport, (r) => r.handovers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report!: ShiftReport;
}
