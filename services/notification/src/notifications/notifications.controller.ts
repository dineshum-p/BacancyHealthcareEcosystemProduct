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
import type { RequestWithTenant } from '../tenant-context/request-with-tenant.interface';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

/**
 * Thin controller: validation via `CreateNotificationDto` + delegation to
 * `NotificationsService`. Guarded by `TenantGuard` -> `AccessTokenGuard` on
 * BOTH routes (AC1's `POST /notifications` per this ticket's explicit
 * auth-scoping decision -- an unauthenticated "send arbitrary SMS/email"
 * endpoint is a real abuse/cost vector -- and AC2's `GET /notifications/:id`
 * for consistency, since it exposes tenant-scoped delivery data). The
 * internal domain-event consumption path (AC4,
 * `UserRegisteredEventHandler`) calls `NotificationsService` directly and
 * never goes through this controller/these guards at all.
 */
@UseGuards(TenantGuard, AccessTokenGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
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

  @Get(':id')
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
