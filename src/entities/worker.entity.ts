import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Stage } from './stage.entity';

@Entity('workers')
export class Worker {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'full_name', type: 'varchar' })
  full_name!: string;

  @Column({ type: 'varchar', nullable: true })
  code!: string | null;

  @Column({ type: 'int', default: 1 })
  active!: number;

  @OneToMany(() => StageWorker, (sw) => sw.worker)
  stageWorkers!: StageWorker[];
}

@Entity('stage_workers')
@Unique(['stage_id', 'worker_id'])
export class StageWorker {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'stage_id', type: 'int' })
  stage_id!: number;

  @Column({ name: 'worker_id', type: 'int' })
  worker_id!: number;

  @ManyToOne(() => Stage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stage_id' })
  stage!: Stage;

  @ManyToOne(() => Worker, (w) => w.stageWorkers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'worker_id' })
  worker!: Worker;
}
