import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Stage } from './stage.entity';
import { User } from './user.entity';

@Entity('entry_templates')
export class EntryTemplate {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ name: 'stage_id', type: 'int' })
  stage_id!: number;

  @Column({ type: 'varchar', nullable: true })
  shift!: string | null;

  @Column({ name: 'payload_json', type: 'jsonb' })
  payload_json!: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  created_by!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @ManyToOne(() => Stage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stage_id' })
  stage!: Stage;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator!: User | null;
}
