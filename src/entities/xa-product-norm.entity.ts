import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Process } from './process.entity';
import { Stage } from './stage.entity';

/** Định mức sản phẩm khâu Xả (theo quy trình + mẫu giấy). */
@Entity('xa_product_norms')
export class XaProductNorm {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'process_id', type: 'int' })
  process_id!: number;

  @Column({ name: 'stage_id', type: 'int', nullable: true })
  stage_id!: number | null;

  /** Tên mẫu SP, ví dụ: Duplex 230/940- hanchang */
  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'jsonb', nullable: true })
  payload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at!: Date;

  @ManyToOne(() => Process, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'process_id' })
  process!: Process;

  @ManyToOne(() => Stage, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'stage_id' })
  stage!: Stage | null;
}
