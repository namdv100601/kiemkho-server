import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Stage } from './stage.entity';

@Entity('norms')
export class Norm {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'stage_id', type: 'int' })
  stage_id!: number;

  @Column({ name: 'product_name', type: 'varchar' })
  product_name!: string;

  @Column({ name: 'norm_value', type: 'float', default: 0 })
  norm_value!: number;

  @Column({ type: 'varchar', default: 'SP/h', nullable: true })
  unit!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @ManyToOne(() => Stage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stage_id' })
  stage!: Stage;
}
