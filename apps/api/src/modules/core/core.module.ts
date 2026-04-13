import { Global, Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { TenantContextService } from './tenant-context.service';
import { TenantGuard } from './tenant.guard';

/** Cross-cutting providers (tenant resolution for pre-auth development). */
@Global()
@Module({
  imports: [TenantModule],
  providers: [TenantContextService, TenantGuard],
  exports: [TenantContextService, TenantGuard, TenantModule],
})
export class CoreModule {}
