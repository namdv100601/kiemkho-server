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

  /** null = áp dụng cho toàn bộ khâu */
  @Column({ name: 'stage_id', type: 'int', nullable: true })
  stage_id!: number | null;

  @Column({ type: 'varchar', nullable: true })
  code!: string | null;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  unit!: string | null;

  @ManyToOne(() => Stage, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'stage_id' })
  stage!: Stage | null;
}
