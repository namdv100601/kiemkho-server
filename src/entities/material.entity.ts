import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Stage } from './stage.entity';

@Entity('materials')
@Unique(['stage_id', 'name'])
export class Material {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'stage_id', type: 'int' })
  stage_id!: number;

  @Column({ type: 'varchar', nullable: true })
  code!: string | null;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', default: 'tấm', nullable: true })
  unit!: string | null;

  @ManyToOne(() => Stage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stage_id' })
  stage!: Stage;
}
