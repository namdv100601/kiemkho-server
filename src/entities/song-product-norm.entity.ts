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



/** Định mức sản phẩm khâu Sóng (theo quy trình + loại sóng E…). */

@Entity('song_product_norms')

export class SongProductNorm {

  @PrimaryGeneratedColumn()

  id!: number;



  @Column({ name: 'process_id', type: 'int' })

  process_id!: number;



  /** Khâu (mặc định Sóng). */

  @Column({ name: 'stage_id', type: 'int', nullable: true })

  stage_id!: number | null;



  /** Ví dụ: Sóng E 820*533mm */

  @Column({ name: 'song_type', type: 'varchar' })

  song_type!: string;



  /** Nhóm mô tả, ví dụ: Hộp bia thường, xanh, Phú lâm */

  @Column({ type: 'varchar', nullable: true })

  name!: string | null;



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


