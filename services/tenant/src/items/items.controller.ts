import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../tenant-context/tenant.guard';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { Audited } from '../audit-logs/audited.decorator';
import { CreateItemDto } from './dto/create-item.dto';
import { Item } from './item.entity';
import { ItemsService } from './items.service';

/**
 * Thin controller: validation via `CreateItemDto` + delegation to
 * `ItemsService`. Guarded by `TenantGuard` so every request is bound to a
 * resolved, active tenant before any query runs.
 *
 * `AccessTokenGuard` is applied only to `create()`, not the whole controller
 * (BAC-8 review, MAJOR): `create()` is the one route `@Audited('item')`
 * records, and AC1 requires a real `actorUserId` on that entry, which is
 * only possible once a verified caller identity exists on the request.
 * `list()` is a read that nothing audits, so it stays as it was (`TenantGuard`
 * only) rather than requiring a token for no audit benefit -- keeping the
 * least-privilege surface consistent with what AC1 actually needs.
 */
@UseGuards(TenantGuard)
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  list(): Promise<Item[]> {
    return this.itemsService.list();
  }

  /**
   * BAC-8, AC1/AC4: `@Audited('item')` records this creation. Guarded by
   * `AccessTokenGuard` (in addition to the controller's `TenantGuard`) so
   * `request.user.userId` is populated by the time `AuditLogInterceptor`
   * runs, giving this audit entry a real `actorUserId` instead of `null`
   * (`before: null` because a creation has no prior state).
   */
  @Audited('item')
  @Post()
  @UseGuards(AccessTokenGuard)
  create(@Body() dto: CreateItemDto): Promise<Item> {
    return this.itemsService.create(dto);
  }
}
