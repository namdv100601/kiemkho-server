import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Stage } from './stage.entity';

@Entity('products')
@Unique(['stage_id', 'name'])
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'stage_id', type: 'int' })
  stage_id!: number;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  unit!: string | null;

  @ManyToOne(() => Stage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stage_id' })
  stage!: Stage;
}
