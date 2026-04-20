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
import { Tenant } from './tenant.entity';

/**
 * Parent Portal v1.1 — Club Updates layer.
 *
 * A deliberately small, parent-safe announcement model. The intent is "a
 * calm, helpful note from the club" — not a CMS, not a marketing channel,
 * not a comment thread. Clubs author short, scannable cards (title, one
 * paragraph of body, optional category and link) which appear in the
 * parent portal home as a subtle, supporting strip.
 *
 * Constraints we hold on purpose:
 *   - tenant-scoped at the column level (CASCADE on tenant delete);
 *   - no rich text or HTML — only plain text body, sanitised at the API;
 *   - no per-family targeting in v1 — every linked guardian sees the
 *     same list. Family-level personalisation belongs in family-actions,
 *     not in announcements;
 *   - publish window via `publishedAt` (set when staff publish) and
 *     optional `expiresAt` (parent UI hides expired updates);
 *   - a single `pinnedUntil` field is enough for "keep this on top for
 *     the next two weeks" without inventing an ordering grammar.
 */
@Entity('club_updates')
@Index(['tenantId', 'publishedAt'])
@Index(['tenantId', 'status'])
export class ClubUpdate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  /**
   * `announcement` — generic short note from the club.
   * `event`         — fixture, camp or program highlight.
   * `reminder`      — gentle seasonal reminder (registration, kit, etc).
   *
   * Kept as a small string union so we can render a calm pill in the
   * portal without enum churn. The set is enforced at the API DTO layer.
   */
  @Column({ type: 'varchar', length: 32, default: 'announcement' })
  category!: 'announcement' | 'event' | 'reminder';

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status!: 'draft' | 'published' | 'archived';

  @Column({ type: 'varchar', length: 140 })
  title!: string;

  /** Plain-text body, max 600 chars. No HTML rendering on the parent side. */
  @Column({ type: 'varchar', length: 600 })
  body!: string;

  /** Optional safe link (https:// or repo-root path) — e.g. fixture page. */
  @Column({ type: 'varchar', length: 512, nullable: true })
  linkUrl!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  linkLabel!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  pinnedUntil!: Date | null;

  /**
   * Parent Portal v1.2 — Targeted announcements.
   *
   * Audience is intentionally simple: every card matches one of four
   * scopes (`all`, `sport_branch`, `group`, `team`). When the scope is
   * not `all` exactly one targeting id is set, and the parent portal
   * intersects the card's audience against the parent's own derived
   * audience set (the union of every linked athlete's branch / group /
   * team membership). This is small enough to stay calm — no audience
   * builder, no lists of ids — but already strong enough for the most
   * common parent-relevant filters clubs ask for.
   */
  @Column({ type: 'varchar', length: 32, default: 'all' })
  audienceScope!: 'all' | 'sport_branch' | 'group' | 'team';

  @Column({ type: 'uuid', nullable: true })
  audienceSportBranchId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  audienceGroupId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  audienceTeamId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
