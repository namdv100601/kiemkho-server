import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Stage } from './stage.entity';

@Entity('processes')
export class Process {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', unique: true })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @OneToMany(() => ProcessStage, (ps) => ps.process)
  processStages!: ProcessStage[];
}

@Entity('process_stages')
@Unique(['process_id', 'stage_id'])
export class ProcessStage {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'process_id', type: 'int' })
  process_id!: number;

  @Column({ name: 'stage_id', type: 'int' })
  stage_id!: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order!: number;

  @ManyToOne(() => Process, (p) => p.processStages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'process_id' })
  process!: Process;

  @ManyToOne(() => Stage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stage_id' })
  stage!: Stage;
}
