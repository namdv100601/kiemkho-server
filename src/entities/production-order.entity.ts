import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Process } from './process.entity';
import { Stage } from './stage.entity';

@Entity('production_orders')
export class ProductionOrder {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', unique: true })
  code!: string;

  @Column({ name: 'process_id', type: 'int', nullable: true })
  process_id!: number | null;

  @Column({ name: 'product_name', type: 'varchar' })
  product_name!: string;

  @Column({ type: 'float', default: 0 })
  quantity!: number;

  @Column({ name: 'entry_date', type: 'varchar' })
  entry_date!: string;

  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parent_id!: number | null;

  @Column({ name: 'parent_ids', type: 'int', array: true, nullable: true })
  parent_ids!: number[] | null;

  @Column({ name: 'stage_id', type: 'int', nullable: true })
  stage_id!: number | null;

  @Column({ name: 'supply_type', type: 'varchar', nullable: true })
  supply_type!: 'nhap_lenh' | 'mua_ngoai' | null;

  @Column({ name: 'supplier_name', type: 'varchar', nullable: true })
  supplier_name!: string | null;

  @Column({ type: 'varchar', default: 'active' })
  status!: 'active' | 'inactive';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => Process, { nullable: true })
  @JoinColumn({ name: 'process_id' })
  process!: Process | null;

  @ManyToOne(() => Stage, { nullable: true })
  @JoinColumn({ name: 'stage_id' })
  stage!: Stage | null;

  @ManyToOne(() => ProductionOrder, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent!: ProductionOrder | null;
}
