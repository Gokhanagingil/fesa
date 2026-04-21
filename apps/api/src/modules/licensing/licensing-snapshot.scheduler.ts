import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { LicensingService } from './licensing.service';

/**
 * Wave 23 — Billing & Licensing Operationalization Pack v1.
 *
 * In-process daily snapshot scheduler. We deliberately do NOT pull in
 * `@nestjs/schedule` — the API runs as a single Nest instance in the
 * current deployment shape and a `setInterval` keeps the surface area
 * tiny, dependency-free, and trivial to disable per environment.
 *
 * Behaviour:
 *   - Disabled by default in tests (`NODE_ENV === 'test'`).
 *   - Disabled when `LICENSING_SNAPSHOT_SCHEDULER=disabled`.
 *   - Otherwise runs every `LICENSING_SNAPSHOT_INTERVAL_MS` (default
 *     24h) AND once shortly after boot so a freshly-restarted API
 *     produces a snapshot row promptly when state has changed.
 *   - Append-only and idempotent: the underlying writer skips when the
 *     active-athlete count and band have not changed since the last
 *     snapshot in the recent window.
 */
@Injectable()
export class LicensingSnapshotScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(LicensingSnapshotScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private bootstrapTimer: NodeJS.Timeout | null = null;

  constructor(private readonly licensing: LicensingService) {}

  onApplicationBootstrap(): void {
    if (this.shouldSkip()) {
      this.logger.log('Scheduled usage snapshots disabled for this environment.');
      return;
    }
    const intervalMs = this.intervalMs();
    this.bootstrapTimer = setTimeout(() => {
      this.runOnce('boot').catch((err) => {
        this.logger.warn(
          `Initial snapshot pass failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }, this.bootDelayMs());

    this.timer = setInterval(() => {
      this.runOnce('scheduled').catch((err) => {
        this.logger.warn(
          `Scheduled snapshot pass failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    }, intervalMs);
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
    this.logger.log(
      `Scheduled usage snapshots active (interval ${intervalMs}ms).`,
    );
  }

  onApplicationShutdown(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.bootstrapTimer) {
      clearTimeout(this.bootstrapTimer);
      this.bootstrapTimer = null;
    }
  }

  private shouldSkip(): boolean {
    if ((process.env.NODE_ENV ?? '').toLowerCase() === 'test') return true;
    if ((process.env.LICENSING_SNAPSHOT_SCHEDULER ?? '').toLowerCase() === 'disabled') {
      return true;
    }
    return false;
  }

  private intervalMs(): number {
    const raw = Number(process.env.LICENSING_SNAPSHOT_INTERVAL_MS ?? '');
    if (Number.isFinite(raw) && raw >= 60_000) return raw;
    return 24 * 60 * 60 * 1000;
  }

  private bootDelayMs(): number {
    const raw = Number(process.env.LICENSING_SNAPSHOT_BOOT_DELAY_MS ?? '');
    if (Number.isFinite(raw) && raw >= 0) return raw;
    return 30_000;
  }

  /**
   * Public so tests / health checks can trigger a single pass without
   * relying on wall-clock time.
   */
  async runOnce(source: 'boot' | 'scheduled' | 'manual'): Promise<{
    tenantsScanned: number;
    snapshotsWritten: number;
    source: 'boot' | 'scheduled' | 'manual';
  }> {
    const result = await this.licensing.runScheduledSnapshotPass();
    if (result.snapshotsWritten > 0) {
      this.logger.log(
        `Snapshot pass (${source}) wrote ${result.snapshotsWritten}/${result.tenantsScanned} rows.`,
      );
    }
    return { ...result, source };
  }
}
