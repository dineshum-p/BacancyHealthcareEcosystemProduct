import { Module } from '@nestjs/common';
import { TenantContextModule } from '../tenant-context/tenant-context.module';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { PricingService } from '../pricing/pricing.service';
import { SuperAdminGuard } from './super-admin.guard';
import { AUTH_SERVICE_CLIENT } from './clients/auth-service.client';
import { HttpAuthServiceClient } from './clients/http-auth-service.client';
import { NOTIFICATION_SERVICE_CLIENT } from './clients/notification-service.client';
import { HttpNotificationServiceClient } from './clients/http-notification-service.client';

/**
 * BAC-12: wires the Super Admin console's tenant-listing/onboarding
 * endpoints together.
 *
 * `TenantContextModule`/`AuthModule`/`TenantsModule` are imported directly
 * for the same reason `AuditLogsModule` imports them: `@UseGuards(TenantGuard,
 * AccessTokenGuard, SuperAdminGuard)` makes Nest instantiate those guards
 * using THIS module's own injector, so their constructor dependencies must
 * be visible here too.
 *
 * `AUTH_SERVICE_CLIENT`/`NOTIFICATION_SERVICE_CLIENT` are bound to their
 * real, `fetch`-backed implementations here (production wiring); tests
 * construct `OnboardingService` directly with fake clients instead of going
 * through this module at all (see `onboarding.service.spec.ts`).
 */
@Module({
  imports: [TenantContextModule, AuthModule, TenantsModule],
  controllers: [OnboardingController],
  providers: [
    OnboardingService,
    PricingService,
    SuperAdminGuard,
    { provide: AUTH_SERVICE_CLIENT, useClass: HttpAuthServiceClient },
    {
      provide: NOTIFICATION_SERVICE_CLIENT,
      useClass: HttpNotificationServiceClient,
    },
  ],
})
export class OnboardingModule {}
