import { Inject, Injectable } from '@nestjs/common';
import type {
  OnboardTenantResponse,
  ProvisioningStepStatus,
} from '@hep/shared-types';
import { TenantsService } from '../tenants/tenants.service';
import { TenantsRepository } from '../tenants/tenants.repository';
import { toTenantResponseDto } from '../tenants/dto/tenant-response.dto';
import { OnboardTenantDto } from './dto/onboard-tenant.dto';
import type { AuthServiceClient } from './clients/auth-service.client';
import { AUTH_SERVICE_CLIENT } from './clients/auth-service.client';
import type { NotificationServiceClient } from './clients/notification-service.client';
import { NOTIFICATION_SERVICE_CLIENT } from './clients/notification-service.client';

/**
 * Orchestrates BAC-12's `POST /tenants/onboard`: provision the tenant (reuse
 * BAC-3's `TenantsService.create`), seed its first `clinic_admin`
 * (`services/auth`, over real HTTP), then queue that admin an invite
 * (`services/notification`, over real HTTP). Returns the tenant plus each
 * step's outcome in one response (AC1/AC3), and PERSISTS that same outcome
 * onto the tenant row so `GET /tenants`/`GET /tenants/:id` can report it
 * later too.
 *
 * ARCHITECTURE (see also `docs/HEP_ARCHITECTURE.md`): this is a real,
 * synchronous inter-service HTTP call chain -- a deliberate departure from
 * every prior ticket (BAC-8/9/10/11), which duplicated guard/audit CODE per
 * service rather than calling another service over the network. Onboarding
 * a tenant is exactly the "sync REST for user-facing flows" case the
 * architecture doc calls for: it is a single Super Admin console action
 * that must show a real, immediate result (AC1), not a fire-and-forget
 * domain event -- and no real event-bus publisher exists anywhere in this
 * repo to fire one through anyway (see `services/notification`'s
 * `events/README.md`). `services/auth`'s `POST /auth/admin-seed` and
 * `services/notification`'s `POST /notifications/internal` both exist
 * SPECIFICALLY for this orchestration (see their own doc comments for why
 * neither reuses an existing end-user-facing endpoint) and are both guarded
 * by a shared-secret `InternalServiceGuard`, not `AccessTokenGuard` -- the
 * calling Super Admin's own bearer token is scoped to THEIR tenant, not the
 * brand-new one being created, so it cannot be forwarded as-is.
 *
 * PARTIAL-FAILURE POLICY (MVP, deliberately simple -- no distributed
 * transaction/saga/compensation):
 *
 *   1. If tenant provisioning itself fails (e.g. duplicate slug, schema
 *      provisioning error), this method throws and NOTHING downstream is
 *      attempted -- same "left pending, inspectable, retry-safe on slug"
 *      contract `TenantsService.create` already documents. No provisioning
 *      -result columns are ever written for a tenant that never reached
 *      this point.
 *   2. Once the tenant is ACTIVE, admin-seeding is attempted. If it fails
 *      (auth service down, unexpected error, etc.), the invite step is
 *      SKIPPED (`'skipped'`, not attempted) -- there is no admin account yet
 *      to usefully notify. The tenant is left ACTIVE but with
 *      `adminSeedStatus: 'failed'`/`inviteStatus: 'skipped'` persisted, so
 *      the tenant list page can flag it for manual follow-up (AC3).
 *      Automatic retry of a half-onboarded tenant is out of scope for this
 *      ticket (documented here, not silently omitted), same scope call
 *      `TenantsService.create`'s own doc comment already made for stuck
 *      `PENDING` tenants.
 *   3. If admin-seeding SUCCEEDS but the invite call fails, the tenant is
 *      left ACTIVE with a real, usable `clinic_admin` account
 *      (`adminSeedStatus: 'succeeded'`) but `inviteStatus: 'failed'` -- the
 *      admin exists but was never notified. This is the only step BAC-9's
 *      own retry/backoff (`NotificationDeliveryWorker`) does NOT cover: that
 *      worker retries actual SMS/email DELIVERY once a notification is
 *      already queued in `services/notification`'s own database; it cannot
 *      help if the `POST /notifications/internal` HTTP call to queue it in
 *      the first place never landed. Retrying that queuing call is future
 *      work.
 *
 * In every case, `POST /tenants/onboard`'s response body always tells the
 * caller the truth (never a bare 201 implying full success) -- see
 * `OnboardTenantResponse`.
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly tenantsRepository: TenantsRepository,
    @Inject(AUTH_SERVICE_CLIENT)
    private readonly authServiceClient: AuthServiceClient,
    @Inject(NOTIFICATION_SERVICE_CLIENT)
    private readonly notificationServiceClient: NotificationServiceClient,
  ) {}

  async onboard(dto: OnboardTenantDto): Promise<OnboardTenantResponse> {
    // Step a: reuse BAC-3's provisioning as-is. A throw here (e.g. duplicate
    // slug -> ConflictException) propagates untouched -- see this class's
    // doc comment, point 1.
    const tenant = await this.tenantsService.create({
      name: dto.name,
      slug: dto.slug,
      plan: dto.plan,
      ownerEmail: dto.adminEmail,
    });

    // Step b: seed the clinic_admin via a real HTTP call to services/auth.
    const adminSeedResult = await this.authServiceClient.seedClinicAdmin(
      tenant.id,
      dto.adminEmail,
    );

    // Step c: only attempt the invite if there is now a real account to
    // notify about (see this class's doc comment, point 2).
    const inviteResult: { outcome: ProvisioningStepStatus; error?: string } =
      adminSeedResult.outcome === 'succeeded'
        ? await this.notificationServiceClient.sendAdminInvite(
            tenant.id,
            dto.adminEmail,
            tenant.name,
          )
        : { outcome: 'skipped' };

    const adminSeedStatus: ProvisioningStepStatus = adminSeedResult.outcome;
    const inviteStatus: ProvisioningStepStatus = inviteResult.outcome;

    // Step d: persist the same outcome onto the tenant row so it survives
    // beyond this single response (AC3).
    const updatedTenant = await this.tenantsRepository.updateProvisioningResult(
      tenant.id,
      { adminSeedStatus, inviteStatus },
    );

    return {
      tenant: toTenantResponseDto(
        updatedTenant ?? { ...tenant, adminSeedStatus, inviteStatus },
      ),
      adminSeed: { status: adminSeedStatus, message: adminSeedResult.error },
      invite: { status: inviteStatus, message: inviteResult.error },
    };
  }
}
