import { Global, Module } from '@nestjs/common';

/** Cross-cutting providers (future: request context, tenant resolution helpers). */
@Global()
@Module({
  providers: [],
  exports: [],
})
export class CoreModule {}
