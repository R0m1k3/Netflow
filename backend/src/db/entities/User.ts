import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, Index } from 'typeorm';
import { UserSettings } from './UserSettings';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'integer', unique: true, nullable: true })
  @Index()
  plexId?: number;

  @Column({ type: 'varchar', length: 255 })
  username!: string;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  email?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  password?: string;

  @Column({ type: 'text', nullable: true })
  thumb?: string;

  @Column({ type: 'text', nullable: true })
  title?: string;

  @Column({ type: 'text', nullable: true, select: false })
  plexToken?: string;

  // Manual configuration for Plex (Host, Port, Token)
  @Column({ type: 'json', nullable: true, select: false })
  plexConfig?: {
    host: string;
    port: number;
    protocol: 'http' | 'https';
    token: string;
    manual: boolean; // Flag to indicate if this config should override auto-discovery
  };

  @Column({ type: 'boolean', default: false })
  hasPassword!: boolean;

  @Column({ type: 'json', nullable: true })
  subscription?: {
    active: boolean;
    status: string;
    plan?: string;
  };

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToOne(() => UserSettings, settings => settings.user)
  settings?: UserSettings;
}