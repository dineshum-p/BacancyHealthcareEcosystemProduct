import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { NotificationResponse } from '@hep/shared-types';
import { TenantGuard } from '../tenant-context/tenant.guard';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { InternalServiceGuard } from '../auth/internal-service.guard';
import type { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

/**
 * Thin controller: validation via `CreateNotificationDto` + delegation to
 * `NotificationsService`. Guarded by `TenantGuard` -> `AccessTokenGuard` on
 * the two end-user-facing routes (AC1's `POST /notifications` per this
 * ticket's explicit auth-scoping decision -- an unauthenticated "send
 * arbitrary SMS/email" endpoint is a real abuse/cost vector -- and AC2's
 * `GET /notifications/:id` for consistency, since it exposes tenant-scoped
 * delivery data). The internal domain-event consumption path (AC4,
 * `UserRegisteredEventHandler`) calls `NotificationsService` directly and
 * never goes through this controller/these guards at all.
 *
 * `POST /notifications/internal` (BAC-12) is a THIRD, separately-guarded
 * route on this same controller -- see its own doc comment for why it
 * cannot reuse `AccessTokenGuard`.
 */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @UseGuards(TenantGuard, AccessTokenGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateNotificationDto,
  ): Promise<NotificationResponse> {
    return this.notificationsService.createForSchema(
      getTenantSchema(request),
      dto,
    );
  }

  /**
   * BAC-12: internal, service-to-service counterpart to `POST /notifications`
   * -- called ONLY by `services/tenant`'s onboarding orchestration
   * (`OnboardingService`) to queue a brand-new tenant's admin-invite email,
   * never by a browser. Guarded by `TenantGuard` (resolves + validates the
   * target tenant from `X-Tenant-Id`, same as every other route here) plus
   * `InternalServiceGuard` (a shared-secret check) INSTEAD of
   * `AccessTokenGuard`: the caller authenticated as a Super Admin against a
   * DIFFERENT tenant entirely (their own), so they have no bearer token
   * scoped to the brand-new tenant to present here. See
   * `InternalServiceGuard`'s doc comment for the full trust-boundary
   * rationale. Delegates to the exact same `NotificationsService.
   * createForSchema` pipeline as `POST /notifications` (BAC-9's queue/retry/
   * delivery logic is entirely reused, not duplicated).
   */
  @Post('internal')
  @UseGuards(TenantGuard, InternalServiceGuard)
  @HttpCode(HttpStatus.CREATED)
  createInternal(
    @Req() request: RequestWithTenant,
    @Body() dto: CreateNotificationDto,
  ): Promise<NotificationResponse> {
    return this.notificationsService.createForSchema(
      getTenantSchema(request),
      dto,
    );
  }

  @Get(':id')
  @UseGuards(TenantGuard, AccessTokenGuard)
  findOne(
    @Req() request: RequestWithTenant,
    @Param('id') id: string,
  ): Promise<NotificationResponse> {
    return this.notificationsService.findByIdForSchema(
      getTenantSchema(request),
      id,
    );
  }
}

/** `TenantGuard` always runs before the handler and always sets `request.tenant` on success (or throws). */
function getTenantSchema(request: RequestWithTenant): string {
  if (!request.tenant) {
    throw new Error(
      'request.tenant was not set -- protect this route with TenantGuard.',
    );
  }
  return request.tenant.schemaName;
}
