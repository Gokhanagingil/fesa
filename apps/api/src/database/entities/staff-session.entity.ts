import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StaffUser } from './staff-user.entity';

@Entity('staff_sessions')
@Index(['tokenHash'], { unique: true })
@Index(['staffUserId'])
@Index(['expiresAt'])
export class StaffSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  staffUserId!: string;

  @ManyToOne(() => StaffUser, (staffUser) => staffUser.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffUserId' })
  staffUser!: StaffUser;

  @Column({ type: 'varchar', length: 128 })
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
